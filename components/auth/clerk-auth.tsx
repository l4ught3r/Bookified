"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";
import type { ruRU } from "@clerk/localizations";
import { ClerkProvider, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import { CircleUserIcon, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import { useClerkRedirectUrl } from "@/lib/auth/use-clerk-redirect-url";
import { clearReaderSession } from "@/lib/books/reader-storage";
import { cn } from "@/lib/utils";

const clerkAppearance = {
  variables: {
    colorPrimary: "#C9A962",
    colorForeground: "var(--clerk-fg)",
    colorBackground: "var(--clerk-bg)",
    colorModalBackdrop: "var(--clerk-modal-bg)",
  },
} as const;

type ClerkAuthProviderProps = {
  children: ReactNode;
  localization: typeof ruRU;
};

function ReaderAuthSync() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      return;
    }

    clearReaderSession();
  }, [isLoaded, isSignedIn]);

  return null;
}

export function ClerkAuthProvider({ children, localization }: ClerkAuthProviderProps) {
  const redirectUrl = useClerkRedirectUrl();
  const locale = useLocale();
  const signOutUrl = `/${locale}`;
  const clerkUi = ui as ComponentProps<typeof ClerkProvider>["ui"];

  return (
    <ClerkProvider
      ui={clerkUi}
      localization={localization}
      afterSignOutUrl={signOutUrl}
      signInFallbackRedirectUrl={redirectUrl}
      signUpFallbackRedirectUrl={redirectUrl}
      appearance={clerkAppearance}
    >
      <ReaderAuthSync />
      {children}
    </ClerkProvider>
  );
}

type AuthSignInButtonProps = React.ComponentProps<typeof SignInButton>;

export function AuthSignInButton({ mode = "modal", ...props }: AuthSignInButtonProps) {
  const redirectUrl = useClerkRedirectUrl();

  return (
    <SignInButton
      {...props}
      mode={mode}
      forceRedirectUrl={props.forceRedirectUrl ?? redirectUrl}
      signUpForceRedirectUrl={props.signUpForceRedirectUrl ?? redirectUrl}
    />
  );
}

type AuthSignInPromptProps = {
  message: string;
  className?: string;
};

export function AuthSignInPrompt({ message, className }: AuthSignInPromptProps) {
  const t = useTranslations("common");

  return (
    <div
      className={
        className ??
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/50 bg-secondary/30 px-4 py-4 sm:flex-row"
      }
    >
      <p className="text-center text-sm text-muted-foreground sm:text-left">{message}</p>
      <AuthSignInButton>
        <Button className="shrink-0 rounded-xl">{t("signIn")}</Button>
      </AuthSignInButton>
    </div>
  );
}

export function ClerkAuthControls() {
  const t = useTranslations("common");
  const { isLoaded, isSignedIn } = useAuth();
  const isMobileLayout = useIsMobileLayout();

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center overflow-hidden",
        isMobileLayout ? "w-8 justify-center" : "w-30 justify-end",
        !isLoaded && "justify-center",
      )}
    >
      {!isLoaded ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : isSignedIn ? (
        <div className="nav-user-link min-w-0">
          <UserButton showName={!isMobileLayout} />
        </div>
      ) : (
        <AuthSignInButton>
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 rounded-full px-2 py-2 transition-[background-color,transform] duration-200 hover:bg-(--user-hover-bg) active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-11 sm:px-3"
            aria-label={t("signIn")}
          >
            <CircleUserIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="hidden text-sm font-medium sm:inline">{t("signIn")}</span>
          </button>
        </AuthSignInButton>
      )}
    </div>
  );
}
