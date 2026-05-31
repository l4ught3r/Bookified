import type { ReactNode } from "react";
import { enUS, ruRU } from "@clerk/localizations";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClerkAuthProvider } from "@/components/auth/clerk-auth";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SetHtmlLang } from "@/components/layout/set-html-lang";
import { SkipToMain } from "@/components/layout/skip-to-main";
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
    <NextIntlClientProvider messages={messages}>
      <ClerkAuthProvider localization={locale === "ru" ? ruRU : enUS}>
        <SetHtmlLang />
        <SkipToMain />
        {children}
        <MobileBottomNav />
      </ClerkAuthProvider>
    </NextIntlClientProvider>
  );
}
