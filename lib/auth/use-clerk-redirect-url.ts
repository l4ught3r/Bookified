"use client";

import { useLocale } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";

export function useClerkRedirectUrl() {
  const pathname = usePathname();
  const locale = useLocale();

  return `/${locale}${pathname === "/" ? "" : pathname}`;
}
