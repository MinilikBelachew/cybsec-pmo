import { EmergencyLoginPage } from "@/domains/auth/components/emergency-login-page";

export const metadata = {
  title: "Emergency access — PMO",
  description: "Break-glass emergency sign-in",
};

export default function EmergencyLoginRoute() {
  return <EmergencyLoginPage />;
}
