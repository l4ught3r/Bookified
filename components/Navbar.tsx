"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Library", href: "/" },
  { label: "Add New", href: "/books/new" },
  { label: "Pricing", href: "/subscriptions" },
];

const Navbar = () => {
  const pathName = usePathname();
  const isAuthPage =
    pathName.startsWith("/sign-in") || pathName.startsWith("/sign-up");

  const logo = (
    <>
      <Image src="/assets/logo.png" alt="Bookfied" width={43} height={26} />
      <span className="logo-text">Bookified</span>
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
            navItems.map(({ label, href }) => {
              const isActive =
                pathName === href || (href !== "/" && pathName.startsWith(href));

              return (
                <Link
                  href={href}
                  key={label}
                  className={cn(
                    "nav-link-base",
                    isActive ? "nav-link-active" : "text-black hover:opacity-70",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          {!isAuthPage && (
            <div className="flex gap-7.5 items-center">
              <Show when="signed-out">
                <SignInButton mode="modal" />
              </Show>
              <Show when="signed-in">
                <div className="nav-user-link">
                  <UserButton showName />
                </div>
              </Show>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
