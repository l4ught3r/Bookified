"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@teispace/next-themes";
import { BookOpen, BookOpenText, ChevronLeft, Moon, Plus, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { ClerkAuthControls } from "@/components/auth/clerk-auth";
import LanguageSwitcher from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import {
  getReaderNavigationPathSnapshot,
  subscribeReaderNavigationPath,
} from "@/lib/books/reader-storage";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

export function TopNavbar() {
  const t = useTranslations("nav");
  const tReader = useTranslations("reader");
  const tCommon = useTranslations("common");
  const pathName = usePathname();
  const isMobileLayout = useIsMobileLayout();
  const isReaderRoute = pathName === "/" || pathName.startsWith("/reader");
  const showMobileReaderBackButton = isMobileLayout && isReaderRoute;
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
        {showMobileReaderBackButton ? (
          <Button variant="ghost" className="h-10 gap-0.5 rounded-xl px-2 sm:px-3" asChild>
            <Link href="/library" aria-label={tReader("backToLibrary")}>
              <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">{t("library")}</span>
            </Link>
          </Button>
        ) : (
          <Link
            href="/library"
            aria-label={tCommon("brand")}
            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-2 sm:px-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary sm:h-9 sm:w-9 sm:rounded-xl">
              <BookOpen className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
            </div>
            <span className="truncate font-display text-sm font-semibold tracking-tight min-[480px]:text-base sm:text-lg lg:hidden xl:inline xl:text-xl">
              {tCommon("brand")}
            </span>
          </Link>
        )}
      </div>

      <nav
        className="absolute left-1/2 hidden max-w-[min(100%,28rem)] -translate-x-1/2 items-center gap-0.5 lg:flex xl:max-w-none xl:gap-1"
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
                "group relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors xl:gap-2 xl:rounded-xl xl:px-4 xl:py-2 xl:text-sm",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-lg transition-colors xl:rounded-xl",
                  isActive ? "bg-secondary" : "bg-transparent group-hover:bg-secondary/50",
                )}
              />
              <item.icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1.5 lg:gap-1 xl:gap-2">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="h-8 w-8 rounded-lg hover:bg-secondary sm:h-11 sm:w-11 sm:rounded-xl"
          aria-label={t("toggleTheme")}
        >
          {mounted && resolvedTheme === "light" ? (
            <Sun className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
          ) : mounted ? (
            <Moon className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
          ) : (
            <span className="inline-block h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
        <div className="shrink-0">
          <ClerkAuthControls />
        </div>
      </div>
    </header>
  );
}
