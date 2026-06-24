import { LandingPage } from "@/domains/marketing";

export const metadata = {
  title: "Secure Enterprise PMO Platform",
  description: "Advanced cybersecurity project portfolio management and workspace automation.",
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LandingPage locale={locale} />;
}
