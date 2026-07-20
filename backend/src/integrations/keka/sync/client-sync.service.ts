import { Injectable, Logger } from '@nestjs/common';
import { PartyType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KEKA_INTEGRATION } from '../../../timesheets/timesheets.constants';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord, resolveFailedSyncRecord } from '../utils/failed-sync-record.util';
import {
  KekaCreateClientBillingAddress,
  KekaCreateClientPayload,
  KekaCurrency,
  KekaPsaClient,
  KekaPsaClientAddress,
} from '../keka.types';

/** Stored on FailedSyncRecord so outbound client create can be retried. */
export type OutboundClientCreatePayload = {
  name: string;
  code: string;
  billingCurrencyId: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  billingAddress?: KekaCreateClientBillingAddress | null;
};

export type ClientSyncResult = {
  synced: number;
  failed: number;
};

type StringResponse = {
  succeeded?: boolean;
  data?: string | null;
  message?: string | null;
  errors?: string[] | null;
};

@Injectable()
export class ClientSyncService {
  private readonly logger = new Logger(ClientSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  /**
   * Inbound: essential Keka PSA client fields → local Customer.
   * Does not push PMO → Keka (outbound create is createClientInKeka).
   */
  async syncClients(): Promise<ClientSyncResult> {
    const clients = await this.kekaClient.getAllPages<KekaPsaClient>(
      '/psa/clients',
    );

    const syncedAt = new Date();
    let synced = 0;
    let failed = 0;

    for (const client of clients) {
      const kekaClientId = client.id?.trim();
      if (!kekaClientId) {
        failed += 1;
        await this.logFailure('unknown', client, 'Client record is missing id');
        continue;
      }

      try {
        await this.upsertFromKeka(client, syncedAt);
        await this.logSuccess(kekaClientId, client);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown client sync error';
        this.logger.warn(`Client sync failed for ${kekaClientId}: ${message}`);
        await this.logFailure(kekaClientId, client, message);
      }
    }

    return { synced, failed };
  }

  /**
   * Lookup currencies for Keka PSA client billing.
   * Docs: https://developers.keka.com/reference/get_hris-currencies
   */
  async listCurrencies(): Promise<
    Array<{ id: string; code: string; name: string }>
  > {
    const currencies = await this.kekaClient.getAllPages<KekaCurrency>(
      '/hris/currencies',
    );

    return currencies
      .map((currency) => {
        const id = currency.id?.trim();
        if (!id) return null;
        return {
          id,
          code: currency.code?.trim() || id,
          name: currency.name?.trim() || currency.code?.trim() || id,
        };
      })
      .filter((row): row is { id: string; code: string; name: string } =>
        Boolean(row),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Retry outbound client create for a local Customer that has no kekaClientId.
   * Requires billingCurrencyId from the FailedSyncRecord payload (not stored on Customer).
   */
  async retryOutboundClientCreate(
    customerId: string,
    options?: { resolvedBy?: string | null },
  ): Promise<{ success: boolean; kekaClientId: string | null; error?: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        displayName: true,
        companyName: true,
        notes: true,
        primaryEmail: true,
        primaryPhone: true,
        kekaClientId: true,
        kekaClientCode: true,
      },
    });

    if (!customer) {
      return {
        success: false,
        kekaClientId: null,
        error: `Customer ${customerId} not found`,
      };
    }

    if (customer.kekaClientId?.trim()) {
      await resolveFailedSyncRecord(this.prisma, {
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId: customerId,
        resolvedBy: options?.resolvedBy,
      });
      return { success: true, kekaClientId: customer.kekaClientId.trim() };
    }

    const failure = await this.prisma.failedSyncRecord.findFirst({
      where: {
        integration: KEKA_INTEGRATION,
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId: customerId,
        isResolved: false,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
      },
      orderBy: { lastAttempted: 'desc' },
      select: { payload: true },
    });

    const stored = this.parseOutboundCreatePayload(failure?.payload);
    const name =
      stored?.name?.trim() ||
      customer.companyName?.trim() ||
      customer.displayName?.trim() ||
      '';
    const code =
      stored?.code?.trim() ||
      customer.kekaClientCode?.trim() ||
      this.buildClientCode(name || 'CLIENT', customer.id);
    const billingCurrencyId = stored?.billingCurrencyId?.trim() || '';

    if (!name || !billingCurrencyId) {
      const errorMsg =
        'Cannot retry Keka client create: name or billingCurrencyId missing from failed sync payload';
      await this.logOutboundFailure(customerId, stored ?? { customerId }, errorMsg);
      return { success: false, kekaClientId: null, error: errorMsg };
    }

    const createPayload: OutboundClientCreatePayload = {
      name,
      code,
      billingCurrencyId,
      description: stored?.description ?? customer.notes,
      email: stored?.email ?? customer.primaryEmail,
      phone: stored?.phone ?? customer.primaryPhone,
      website: stored?.website ?? null,
      billingAddress: stored?.billingAddress ?? null,
    };

    try {
      const kekaClientId = await this.createClientInKeka({
        name: createPayload.name,
        code: createPayload.code,
        description: createPayload.description,
        email: createPayload.email,
        phone: createPayload.phone,
        website: createPayload.website,
        billingInfo: {
          billingCurrencyId: createPayload.billingCurrencyId,
          ...(createPayload.billingAddress
            ? { billingAddress: createPayload.billingAddress }
            : {}),
        },
      });

      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          kekaClientId,
          kekaClientCode: createPayload.code,
          kekaSyncedAt: new Date(),
        },
      });

      await this.logOutboundSuccess(
        customerId,
        { ...createPayload, kekaClientId },
        options?.resolvedBy,
      );

      return { success: true, kekaClientId };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Keka client create failed';
      await this.logOutboundFailure(customerId, createPayload, errorMsg);
      return { success: false, kekaClientId: null, error: errorMsg };
    }
  }

  /**
   * Outbound: create client in Keka (POST /psa/clients).
   * Required by Keka: name, code, billingInfo.billingCurrencyId.
   * Docs: https://developers.keka.com/reference/post_psa-clients-1
   */
  async createClientInKeka(
    payload: KekaCreateClientPayload,
  ): Promise<string> {
    const billingCurrencyId = payload.billingInfo?.billingCurrencyId?.trim();
    if (!billingCurrencyId) {
      throw new Error(
        'Keka client create requires billingInfo.billingCurrencyId',
      );
    }

    const address = payload.billingInfo?.billingAddress;
    const cleanedAddress = address
      ? {
          ...(address.addressLine1?.trim()
            ? { addressLine1: address.addressLine1.trim() }
            : {}),
          ...(address.addressLine2?.trim()
            ? { addressLine2: address.addressLine2.trim() }
            : {}),
          ...(address.countryCode?.trim()
            ? { countryCode: address.countryCode.trim() }
            : {}),
          ...(address.city?.trim() ? { city: address.city.trim() } : {}),
          ...(address.state?.trim() ? { state: address.state.trim() } : {}),
          ...(address.zip?.trim() ? { zip: address.zip.trim() } : {}),
        }
      : null;

    const body: KekaCreateClientPayload = {
      name: payload.name.trim(),
      code: payload.code.trim(),
      billingInfo: {
        billingCurrencyId,
        ...(cleanedAddress && Object.keys(cleanedAddress).length > 0
          ? { billingAddress: cleanedAddress }
          : {}),
      },
      ...(payload.description?.trim()
        ? { description: payload.description.trim() }
        : {}),
      ...(payload.email?.trim() ? { email: payload.email.trim() } : {}),
      ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
      ...(payload.website?.trim() ? { website: payload.website.trim() } : {}),
    };

    if (!body.name || !body.code) {
      throw new Error('Keka client create requires name and code');
    }

    const response = await this.kekaClient.post<StringResponse>(
      '/psa/clients',
      body,
    );

    const kekaClientId = response.data?.trim();
    if (!kekaClientId) {
      const detail =
        response.message ||
        response.errors?.join(', ') ||
        'Keka did not return a client id';
      throw new Error(detail);
    }

    return kekaClientId;
  }

  buildClientCode(name: string, fallbackId?: string): string {
    const base = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8);
    const suffix = (fallbackId ?? Date.now().toString(36))
      .replace(/-/g, '')
      .slice(0, 4)
      .toUpperCase();
    return `${base || 'CLIENT'}${suffix}`.slice(0, 20);
  }

  private async upsertFromKeka(client: KekaPsaClient, syncedAt: Date) {
    const kekaClientId = client.id!.trim();
    const name = client.name?.trim() || `Keka client ${kekaClientId.slice(0, 8)}`;
    const code = client.code?.trim() || null;
    const primaryContact = (client.clientContacts ?? []).find(
      (c) => c.email?.trim() || c.phone?.trim() || c.name?.trim(),
    );
    const email = primaryContact?.email?.trim() || null;
    const phone = primaryContact?.phone?.trim() || null;
    const address = this.formatAddress(client.billingAddress);
    const country = client.billingAddress?.countryCode?.trim() || null;

    const existing = await this.prisma.customer.findUnique({
      where: { kekaClientId },
      select: { id: true, primaryEmail: true },
    });

    const safeEmail = await this.resolveUniqueEmail(
      email,
      existing?.id ?? null,
    );

    if (existing) {
      await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          type: PartyType.Company,
          displayName: name,
          companyName: name,
          notes: client.description?.trim() || null,
          country,
          address,
          primaryPhone: phone,
          ...(safeEmail !== undefined ? { primaryEmail: safeEmail } : {}),
          kekaClientCode: code,
          kekaSyncedAt: syncedAt,
          status: 'Active',
        },
      });
      return existing.id;
    }

    // Match by code/name if already created locally without keka id
    const byCode = code
      ? await this.prisma.customer.findFirst({
          where: {
            OR: [
              { kekaClientCode: code },
              { registrationNumber: code },
            ],
            kekaClientId: null,
          },
          select: { id: true },
        })
      : null;
    const byName =
      byCode ??
      (await this.prisma.customer.findFirst({
        where: {
          displayName: { equals: name, mode: 'insensitive' },
          kekaClientId: null,
        },
        select: { id: true },
      }));

    if (byName) {
      await this.prisma.customer.update({
        where: { id: byName.id },
        data: {
          type: PartyType.Company,
          displayName: name,
          companyName: name,
          notes: client.description?.trim() || null,
          country,
          address,
          primaryPhone: phone,
          primaryEmail: await this.resolveUniqueEmail(email, byName.id),
          kekaClientId,
          kekaClientCode: code,
          kekaSyncedAt: syncedAt,
          status: 'Active',
        },
      });
      return byName.id;
    }

    await this.prisma.customer.create({
      data: {
        type: PartyType.Company,
        displayName: name,
        companyName: name,
        notes: client.description?.trim() || null,
        country,
        address,
        primaryPhone: phone,
        primaryEmail: safeEmail,
        kekaClientId,
        kekaClientCode: code,
        kekaSyncedAt: syncedAt,
        status: 'Active',
      },
    });
  }

  private formatAddress(addr?: KekaPsaClientAddress | null): string | null {
    if (!addr) return null;
    const parts = [
      addr.addressLine1,
      addr.addressLine2,
      addr.city,
      addr.state,
      addr.zip,
      addr.countryCode,
    ]
      .map((p) => p?.trim())
      .filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  /** Avoid unique primaryEmail conflicts across customers. */
  private async resolveUniqueEmail(
    email: string | null,
    excludeCustomerId: string | null,
  ): Promise<string | null | undefined> {
    if (!email) {
      return excludeCustomerId ? undefined : null;
    }

    const clash = await this.prisma.customer.findFirst({
      where: {
        primaryEmail: email,
        ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
      },
      select: { id: true },
    });

    if (clash) {
      return excludeCustomerId ? undefined : null;
    }
    return email;
  }

  private parseOutboundCreatePayload(
    payload: Prisma.JsonValue | null | undefined,
  ): OutboundClientCreatePayload | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    const row = payload as Record<string, unknown>;
    const billingCurrencyId =
      typeof row.billingCurrencyId === 'string' ? row.billingCurrencyId : '';
    const name = typeof row.name === 'string' ? row.name : '';
    const code = typeof row.code === 'string' ? row.code : '';
    if (!billingCurrencyId && !name && !code) {
      return null;
    }

    const billingAddressRaw = row.billingAddress;
    let billingAddress: KekaCreateClientBillingAddress | null = null;
    if (
      billingAddressRaw &&
      typeof billingAddressRaw === 'object' &&
      !Array.isArray(billingAddressRaw)
    ) {
      const addr = billingAddressRaw as Record<string, unknown>;
      billingAddress = {
        addressLine1:
          typeof addr.addressLine1 === 'string' ? addr.addressLine1 : null,
        addressLine2:
          typeof addr.addressLine2 === 'string' ? addr.addressLine2 : null,
        countryCode:
          typeof addr.countryCode === 'string' ? addr.countryCode : null,
        city: typeof addr.city === 'string' ? addr.city : null,
        state: typeof addr.state === 'string' ? addr.state : null,
        zip: typeof addr.zip === 'string' ? addr.zip : null,
      };
    }

    return {
      name,
      code,
      billingCurrencyId,
      description: typeof row.description === 'string' ? row.description : null,
      email: typeof row.email === 'string' ? row.email : null,
      phone: typeof row.phone === 'string' ? row.phone : null,
      website: typeof row.website === 'string' ? row.website : null,
      billingAddress,
    };
  }

  async logOutboundFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        errorMsg,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.CLIENT,
      entityId,
      direction: KEKA_SYNC_DIRECTION.OUTBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
  }

  async logOutboundSuccess(
    entityId: string,
    payload: unknown,
    resolvedBy?: string | null,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await resolveFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.CLIENT,
      entityId,
      resolvedBy,
    });
  }

  private async logSuccess(entityId: string, payload: unknown): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await resolveFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.CLIENT,
      entityId,
    });
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ) {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        errorMsg,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.CLIENT,
      entityId,
      direction: KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
  }
}
