"use client";

import { useEffect, useState } from "react";
import { useBookStore } from "@/lib/store/useBookStore";

type UseLibraryBooksOptions = {
  isAuthLoaded: boolean;
  isSignedIn: boolean;
};

export function useLibraryBooks({ isAuthLoaded, isSignedIn }: UseLibraryBooksOptions) {
  const books = useBookStore((state) => state.libraryBooks);
  const hydrateLibraryFromLocalDb = useBookStore((state) => state.hydrateLibraryFromLocalDb);
  const revalidateLibraryInBackground = useBookStore((state) => state.revalidateLibraryInBackground);

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    let cancelled = false;

    (async () => {
      await hydrateLibraryFromLocalDb();
      if (!cancelled) {
        setIsHydrated(true);
      }

      if (isSignedIn) {
        await revalidateLibraryInBackground();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateLibraryFromLocalDb, isAuthLoaded, isSignedIn, revalidateLibraryInBackground]);

  return {
    books,
    loading: !isHydrated,
  };
}
