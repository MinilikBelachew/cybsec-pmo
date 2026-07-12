/**
 * Build an inclusive date window for Keka time APIs.
 * Leave max = 90 days. Attendance max = 60 days on this tenant.
 */
export function buildKekaDateWindow(options?: {
  pastDays?: number;
  totalDays?: number;
}): { from: string; to: string } {
  const pastDays = options?.pastDays ?? 30;
  const totalDays = options?.totalDays ?? 90;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - pastDays);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + (totalDays - 1));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
