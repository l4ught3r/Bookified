import type { ReactNode } from "react";
import { enUS, ruRU } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { routing } from "@/lib/i18n/routing";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <ClerkProvider localization={locale === "ru" ? ruRU : enUS} signInUrl={`/${locale}/sign-in`}>
      <NextIntlClientProvider messages={messages}>
        <Navbar />
        {children}
      </NextIntlClientProvider>
    </ClerkProvider>
  );
}
