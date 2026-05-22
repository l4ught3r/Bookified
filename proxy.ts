import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

function getLocaleFromPathname(pathname: string) {
  const segment = pathname.split("/")[1];

  if (routing.locales.includes(segment as "en" | "ru")) {
    return segment;
  }

  return routing.defaultLocale;
}

function isHomePath(pathname: string) {
  return pathname === "/" || pathname === "/en" || pathname === "/ru";
}

function isSignInPath(pathname: string) {
  return /^\/(en|ru)\/sign-in(\/.*)?$/.test(pathname);
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  const locale = getLocaleFromPathname(pathname);

  if (!userId && isHomePath(pathname)) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, req.url));
  }

  if (!userId && !isSignInPath(pathname)) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, req.url));
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
