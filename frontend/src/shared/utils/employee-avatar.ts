export const EMPLOYEE_AVATAR_COLORS = [
  "bg-primary",
  "bg-violet-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-indigo-600",
] as const;

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % EMPLOYEE_AVATAR_COLORS.length;
  }
  return EMPLOYEE_AVATAR_COLORS[hash] ?? EMPLOYEE_AVATAR_COLORS[0];
}
