import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { fontSans, fontMono } from '@/config/fonts.config';
import { Metadata } from 'next';
import "../globals.css";
import { AppProviders } from '@/providers/app-providers';

import { siteConfig } from '@/config/site.config';

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const { locale } = resolvedParams;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AppProviders>
            {children}
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
