"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const locales = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
] as const;

const LanguageSwitcher = () => {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <div className="flex items-center rounded-full border border-black/10 p-1">
      {locales.map(({ code, label }) => {
        const isActive = locale === code;

        return (
          <Link
            key={code}
            href={href}
            locale={code}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full transition-colors",
              isActive ? "bg-black text-white" : "text-black hover:bg-black/5",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
