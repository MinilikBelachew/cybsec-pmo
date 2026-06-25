export const toDateString = (date?: Date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateLabel = (dateStr?: string) => {
  if (!dateStr) return "Select date";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Select date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
