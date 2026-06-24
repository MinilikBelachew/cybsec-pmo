import { z } from "zod";

/** Coerces form values to Date; rejects empty/missing values. */
export const requiredTaskDate = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.date({ message: "Date is required" })
);

export function taskEndDateAfterStartDate(data: {
  startDate?: Date;
  endDate?: Date;
}): boolean {
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}

export function defaultTaskDateRange() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  return { startDate, endDate };
}
