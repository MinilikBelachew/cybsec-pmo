const flags: Record<string, boolean> = {
  enableDarkMode: true,
  enableNotifications: true,
  enableAnalytics: process.env.NODE_ENV === "production",
  enableBetaFeatures: false,
};

export function isEnabled(flag: string): boolean {
  return flags[flag] ?? false;
}
