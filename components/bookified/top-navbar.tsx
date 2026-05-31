"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@teispace/next-themes";
import { BookOpen, BookOpenText, Moon, Plus, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { ClerkAuthControls } from "@/components/auth/clerk-auth";
import { Button } from "@/components/ui/button";
import {
  getReaderNavigationPathSnapshot,
  subscribeReaderNavigationPath,
} from "@/lib/books/reader-storage";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "@/components/layout/language-switcher";

export function TopNavbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathName = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-border/50 bg-card px-2 pt-[env(safe-area-inset-top)] sm:h-16 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center justify-start">
        <Link
          href="/library"
          className="flex min-w-0 max-w-full items-center gap-1.5 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-2 sm:px-2"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary sm:h-9 sm:w-9 sm:rounded-xl">
            <BookOpen className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
          </div>
          <span className="truncate font-display text-sm font-semibold tracking-tight min-[480px]:text-base sm:text-lg md:text-xl">
            {tCommon("brand")}
          </span>
        </Link>
      </div>

      <nav
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
        aria-label={t("library")}
      >
        {navItems.map((item) => {
          const isActive =
            item.key === "reader"
              ? pathName === "/" || pathName.startsWith("/reader")
              : pathName === item.href || pathName.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-xl transition-colors",
                  isActive ? "bg-secondary" : "bg-transparent group-hover:bg-secondary/50",
                )}
              />
              <item.icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1.5 md:gap-2">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="hidden h-9 w-9 rounded-lg hover:bg-secondary min-[480px]:inline-flex sm:h-11 sm:w-11 sm:rounded-xl"
          aria-label={t("toggleTheme")}
        >
          {mounted && resolvedTheme === "light" ? (
            <Sun className="h-5 w-5 text-muted-foreground" />
          ) : mounted ? (
            <Moon className="h-5 w-5 text-muted-foreground" />
          ) : (
            <span className="inline-block h-5 w-5" />
          )}
        </Button>
        <div className="shrink-0">
          <ClerkAuthControls />
        </div>
      </div>
    </header>
  );
}
