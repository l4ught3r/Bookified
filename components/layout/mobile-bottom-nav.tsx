"use client";

import { useSyncExternalStore } from "react";
import { BookOpen, BookOpenText, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  getReaderNavigationPathSnapshot,
  subscribeReaderNavigationPath,
} from "@/lib/books/reader-storage";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathName = usePathname();
  const readerHref = useSyncExternalStore(
    subscribeReaderNavigationPath,
    getReaderNavigationPathSnapshot,
    () => "/",
  );

  const navItems = [
    { key: "library", href: "/library", label: t("library"), icon: BookOpen },
    { key: "reader", href: readerHref, label: t("reader"), icon: BookOpenText },
    { key: "add-book", href: "/add-book", label: t("addBook"), icon: Plus },
  ] as const;

  const isReaderRoute = pathName === "/" || pathName.startsWith("/reader");

  if (isReaderRoute) {
    return null;
  }

  return (
    <nav
      aria-label={t("mobileNavigation")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
        {navItems.map((item) => {
          const isActive =
            item.key === "reader"
              ? pathName === "/" || pathName.startsWith("/reader")
              : pathName === item.href || pathName.startsWith(`${item.href}/`);

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
