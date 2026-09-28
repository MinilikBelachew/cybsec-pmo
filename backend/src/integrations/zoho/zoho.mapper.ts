export type ZohoDealRecord = {
  id: string;
  Deal_Name?: string;
  Stage?: string;
  Amount?: number | string | null;
  Description?: string | null;
  Closing_Date?: string | null;
  Account_Name?: { name?: string; id?: string } | string | null;
};

export type MappedCrmOpportunity = {
  zohoOpportunityId: string;
  name: string | null;
  accountName: string | null;
  expectedRevenue: number | null;
  stage: string | null;
  description: string | null;
  closingDate: string | null;
};

function parseAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function accountNameFrom(
  value: ZohoDealRecord['Account_Name'],
): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  return value.name?.trim() || null;
}

export function mapZohoDealToOpportunity(
  deal: ZohoDealRecord,
): MappedCrmOpportunity {
  return {
    zohoOpportunityId: String(deal.id),
    name: deal.Deal_Name?.trim() || null,
    accountName: accountNameFrom(deal.Account_Name),
    expectedRevenue: parseAmount(deal.Amount),
    stage: deal.Stage?.trim() || null,
    description: deal.Description?.trim() || null,
    closingDate: deal.Closing_Date?.trim() || null,
  };
}

export function isClosedWonStage(stage: string | null | undefined): boolean {
  if (!stage) {
    return false;
  }
  const normalized = stage.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === 'closed won' || normalized === 'closedwon';
}

export function sourceOrderIdForDeal(zohoOpportunityId: string): string {
  return `zoho-deal:${zohoOpportunityId}`;
}

export type ZohoBooksSalesOrderRecord = {
  salesorder_id: string | number;
  salesorder_number?: string | null;
  status?: string | null;
  order_status?: string | null;
  customer_name?: string | null;
  customer_id?: string | number | null;
  reference_number?: string | null;
  date?: string | null;
  shipment_date?: string | null;
  total?: number | string | null;
  currency_code?: string | null;
  notes?: string | null;
  zcrm_potential_id?: string | null;
};

export type MappedBooksSalesOrder = {
  zohoSalesOrderId: string;
  salesOrderNumber: string | null;
  status: string | null;
  customerName: string | null;
  referenceNumber: string | null;
  orderDate: string | null;
  shipmentDate: string | null;
  total: number | null;
  currency: string | null;
  notes: string | null;
  zohoCrmPotentialId: string | null;
};

/**
 * Tracker “confirmed order”: not draft/void/cancelled.
 * Zoho Books marks drafts as open once confirmed; later stages stay confirmed.
 */
export function isConfirmedSalesOrderStatus(
  status: string | null | undefined,
  orderStatus?: string | null | undefined,
): boolean {
  const candidates = [status, orderStatus]
    .map((s) => s?.trim().toLowerCase().replace(/\s+/g, '_') ?? '')
    .filter(Boolean);

  if (candidates.length === 0) {
    return false;
  }

  const blocked = new Set(['draft', 'void', 'cancelled', 'canceled', 'onhold', 'pending']);
  if (candidates.some((s) => blocked.has(s))) {
    return false;
  }

  const confirmed = new Set([
    'open',
    'confirmed',
    'approved',
    'partially_invoiced',
    'invoiced',
    'closed',
    'fulfilled',
    'partially_shipped',
    'shipped',
  ]);

  return candidates.some(
    (s) =>
      confirmed.has(s) ||
      s.includes('confirm') ||
      s.includes('open') ||
      s.includes('invoic') ||
      s.includes('ship'),
  );
}

export function sourceOrderIdForSalesOrder(zohoSalesOrderId: string): string {
  return `zoho-so:${zohoSalesOrderId}`;
}

export function mapZohoBooksSalesOrder(
  order: ZohoBooksSalesOrderRecord,
): MappedBooksSalesOrder {
  return {
    zohoSalesOrderId: String(order.salesorder_id),
    salesOrderNumber: order.salesorder_number?.trim() || null,
    status: order.status?.trim() || order.order_status?.trim() || null,
    customerName: order.customer_name?.trim() || null,
    referenceNumber: order.reference_number?.trim() || null,
    orderDate: order.date?.trim() || null,
    shipmentDate: order.shipment_date?.trim() || null,
    total: parseAmount(order.total),
    currency: order.currency_code?.trim() || null,
    notes: order.notes?.trim() || null,
    zohoCrmPotentialId: order.zcrm_potential_id
      ? String(order.zcrm_potential_id)
      : null,
  };
}
