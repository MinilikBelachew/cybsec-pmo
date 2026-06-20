import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences."
      />
      <EmptyState
        title="Settings coming soon"
        description="This section is currently under development."
      />
    </>
  );
}
