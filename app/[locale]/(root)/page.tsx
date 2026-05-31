"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ReaderEmptyState } from "@/components/bookified/reader-view";
import { clearReaderSession, getReaderNavigationPath } from "@/lib/books/reader-storage";
import { useRouter } from "@/lib/i18n/navigation";

export default function ReaderHomePage() {
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const readerPath = isLoaded ? getReaderNavigationPath() : null;
  const shouldRedirect =
    isLoaded && isSignedIn && readerPath !== null && readerPath !== "/";

  useEffect(() => {
    if (shouldRedirect && readerPath) {
      router.replace(readerPath);
    }
  }, [shouldRedirect, readerPath, router]);

  useEffect(() => {
    if (isLoaded && !shouldRedirect && !isSignedIn) {
      clearReaderSession();
    }
  }, [isLoaded, shouldRedirect, isSignedIn]);

  if (!isLoaded || shouldRedirect) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  return <ReaderEmptyState />;
}
