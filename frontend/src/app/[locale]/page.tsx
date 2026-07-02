import { LandingPage } from "@/domains/marketing";

export const metadata = {
  title: "CYBSEC PMO",
  description: "Cybersec PMO Platform",
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LandingPage locale={locale} />;
}
