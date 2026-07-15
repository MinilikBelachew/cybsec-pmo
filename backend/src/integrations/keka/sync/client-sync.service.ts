import { Injectable, Logger } from '@nestjs/common';
import { PartyType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord } from '../utils/failed-sync-record.util';
import {
  KekaCreateClientPayload,
  KekaPsaClient,
  KekaPsaClientAddress,
} from '../keka.types';

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
   * Outbound: create client in Keka (POST /psa/clients).
   * Required by Keka: name, code.
   * Docs: https://developers.keka.com/reference/post_psa-clients-1
   */
  async createClientInKeka(
    payload: KekaCreateClientPayload,
  ): Promise<string> {
    const body: KekaCreateClientPayload = {
      name: payload.name.trim(),
      code: payload.code.trim(),
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

  private async logSuccess(entityId: string, payload: unknown) {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.CLIENT,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
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
