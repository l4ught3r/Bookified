import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// API routes: Clerk only (auth headers). Skip next-intl — multipart uploads break otherwise.
function shouldSkipIntl(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/trpc") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/__clerk") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  );
}

export default clerkMiddleware(async (_auth, request) => {
  if (shouldSkipIntl(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
