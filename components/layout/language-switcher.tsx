"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const locales = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
] as const;

const LanguageSwitcher = () => {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <div
      className="flex items-center rounded-lg bg-secondary p-0.5 sm:rounded-xl sm:p-1"
      role="group"
      aria-label={t("language")}
    >
      {locales.map(({ code, label }) => {
        const isActive = locale === code;

        return (
          <Link
            key={code}
            href={href}
            locale={code}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-colors sm:h-11 sm:min-w-11 sm:rounded-lg sm:px-2.5 sm:text-sm",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Globe className="mr-0.5 hidden h-3.5 w-3.5 sm:mr-1 sm:inline" aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
