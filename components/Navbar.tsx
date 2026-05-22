"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import Image from "next/image";
import LanguageSwitcher from "@/components/LanguageSwithcher";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "library", href: "/" },
  { key: "addNew", href: "/books/new" },
  { key: "pricing", href: "/subscriptions" },
] as const;

const Navbar = () => {
  const pathName = usePathname();
  const t = useTranslations("Navbar");

  const isAuthPage = pathName.startsWith("/sign-in") || pathName.startsWith("/sign-up");

  const logo = (
    <>
      <Image src="/assets/logo.png" alt={t("brand")} width={43} height={26} />
      <span className="logo-text">{t("brand")}</span>
    </>
  );

  return (
    <header className="w-full fixed z-50 bg-(--bg-primary)">
      <div className="wrapper navbar-height py-4 flex justify-between items-center">
        {isAuthPage ? (
          <div className="flex gap-0.5 items-center">{logo}</div>
        ) : (
          <Link href="/" className="flex gap-0.5 items-center">
            {logo}
          </Link>
        )}

        <nav className="w-fit flex gap-7.5 items-center">
          {!isAuthPage &&
            navItems.map(({ key, href }) => {
              const isActive = pathName === href || (href !== "/" && pathName.startsWith(href));

              return (
                <Link
                  href={href}
                  key={key}
                  className={cn(
                    "nav-link-base",
                    isActive ? "nav-link-active" : "text-black hover:opacity-70",
                  )}
                >
                  {t(key)}
                </Link>
              );
            })}

          <div className="flex gap-4 items-center">
            <LanguageSwitcher />

            {!isAuthPage && (
              <>
                <Show when="signed-out">
                  <Link href="/sign-in" className="nav-link-base">
                    {t("signIn")}
                  </Link>
                </Show>

                <Show when="signed-in">
                  <div className="nav-user-link">
                    <UserButton showName />
                  </div>
                </Show>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
