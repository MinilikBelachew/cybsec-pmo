export type ZohoDealRecord = {
  id: string;
  Deal_Name?: string;
  Stage?: string;
  Amount?: number | string | null;
  Account_Name?: { name?: string; id?: string } | string | null;
};

export type MappedCrmOpportunity = {
  zohoOpportunityId: string;
  name: string | null;
  accountName: string | null;
  expectedRevenue: number | null;
  stage: string | null;
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
  };
}
