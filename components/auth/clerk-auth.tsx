"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";
import type { ruRU } from "@clerk/localizations";
import { ClerkProvider, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import { CircleUserIcon, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useIsMobileLayout, useMediaQuery } from "@/hooks/use-media-query";
import { useClerkRedirectUrl } from "@/lib/auth/use-clerk-redirect-url";
import { clearReaderSession } from "@/lib/books/reader-storage";
import { cn } from "@/lib/utils";

const clerkAppearanceVariables = {
  colorPrimary: "var(--clerk-color-primary)",
  colorPrimaryForeground: "var(--clerk-color-primary-foreground)",
  colorForeground: "var(--clerk-color-foreground)",
  colorBackground: "var(--clerk-color-background)",
  colorMuted: "var(--clerk-color-muted)",
  colorMutedForeground: "var(--clerk-color-muted-foreground)",
  colorInput: "var(--clerk-color-input)",
  colorInputForeground: "var(--clerk-color-input-foreground)",
  colorBorder: "var(--clerk-color-border)",
  colorRing: "var(--clerk-color-ring)",
  colorModalBackdrop: "var(--clerk-color-modal-backdrop)",
  colorNeutral: "var(--clerk-color-neutral)",
  colorDanger: "var(--clerk-color-danger)",
  colorSuccess: "var(--clerk-color-success)",
  colorShadow: "var(--clerk-color-shadow)",
  borderRadius: "var(--clerk-border-radius)",
  fontFamily: "var(--clerk-font-family)",
} as const;

const clerkUserButtonAppearance = {
  variables: clerkAppearanceVariables,
  elements: {
    userButtonPopoverCard: {
      backgroundColor: "var(--popover)",
      color: "var(--foreground)",
      boxShadow: "0 8px 32px var(--shadow-soft)",
    },
    userButtonPopoverMain: {
      backgroundColor: "var(--popover)",
      color: "var(--foreground)",
    },
    userButtonPopoverActionButton: {
      color: "var(--foreground)",
    },
    userButtonPopoverActionButtonIcon: {
      color: "var(--muted-foreground)",
    },
    userButtonPopoverFooter: {
      backgroundColor: "var(--popover)",
    },
  },
} as const;

const clerkAppearance = {
  variables: clerkAppearanceVariables,
  signIn: { variables: clerkAppearanceVariables },
  signUp: { variables: clerkAppearanceVariables },
  userButton: clerkUserButtonAppearance,
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
  const showSignInLabel = useMediaQuery("(min-width: 1280px)");

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center overflow-hidden",
        showSignInLabel ? "w-30 justify-end" : "w-8 justify-center",
        !isLoaded && "justify-center",
      )}
    >
      {!isLoaded ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : isSignedIn ? (
        <div className="nav-user-link min-w-0">
          <UserButton showName={!isMobileLayout} appearance={clerkUserButtonAppearance} />
        </div>
      ) : (
        <AuthSignInButton>
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 rounded-full px-2 py-2 transition-[background-color,transform] duration-200 hover:bg-(--user-hover-bg) active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-11 sm:px-3"
            aria-label={t("signIn")}
          >
            <CircleUserIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            {showSignInLabel ? (
              <span className="text-sm font-medium">{t("signIn")}</span>
            ) : null}
          </button>
        </AuthSignInButton>
      )}
    </div>
  );
}
