import { SetupWizardPage } from "@/domains/setup/components/setup-wizard-page";

export const metadata = {
  title: "Platform Setup — CyberSec PMO",
  description: "First-time production configuration wizard",
};

export default function SetupRoute() {
  return <SetupWizardPage />;
}
