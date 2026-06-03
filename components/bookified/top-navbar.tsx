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

interface TopNavbarProps {
  immersiveHidden?: boolean;
}

export function TopNavbar({ immersiveHidden = false }: TopNavbarProps) {
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
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 w-full shrink-0 items-center border-b border-border/50 bg-card pt-[env(safe-area-inset-top)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] transition-[height,opacity,border-color,padding] duration-300 ease-in-out motion-reduce:transition-none sm:h-16 sm:pl-4 sm:pr-4",
        immersiveHidden &&
          "max-lg:h-0 max-lg:min-h-0 max-lg:overflow-hidden max-lg:border-b-0 max-lg:opacity-0 max-lg:pointer-events-none max-lg:pt-0",
      )}
    >
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
              <BookOpen className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" aria-hidden />
            </div>
            <span className="truncate font-display text-sm font-semibold tracking-tight min-[480px]:text-base sm:text-lg lg:hidden xl:inline xl:text-xl">
              {tCommon("brand")}
            </span>
          </Link>
        )}
      </div>

      <nav
        className="absolute left-1/2 hidden max-w-[min(100%,28rem)] -translate-x-1/2 items-center gap-0.5 lg:flex xl:max-w-none xl:gap-1"
        aria-label={t("mobileNavigation")}
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
