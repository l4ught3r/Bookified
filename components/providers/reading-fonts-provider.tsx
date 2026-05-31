"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_READING_FONT_ID } from "@/lib/books/reading-fonts";
import {
  getReadingTypographySettingsSnapshot,
  READER_STORAGE_EVENT,
} from "@/lib/books/reader-storage";
import {
  ALL_READING_FONT_IDS,
  isLazyLoadableReadingFontId,
  readingFontVariableClasses,
} from "@/lib/fonts/reading-variables";
import { cn } from "@/lib/utils";

type ReadingFontsContextValue = {
  ensureFontIds: (fontIds: string[]) => void;
  preloadPickerFonts: () => void;
};

const ReadingFontsContext = createContext<ReadingFontsContextValue | null>(null);

export function useReadingFonts() {
  const context = useContext(ReadingFontsContext);
  if (!context) {
    throw new Error("useReadingFonts must be used within ReadingFontsProvider");
  }
  return context;
}

export function ReadingFontsProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [loadedIds, setLoadedIds] = useState<Set<string>>(
    () => new Set([DEFAULT_READING_FONT_ID]),
  );

  const ensureFontIds = useCallback((fontIds: string[]) => {
    setLoadedIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const fontId of fontIds) {
        if (!isLazyLoadableReadingFontId(fontId)) continue;
        if (!next.has(fontId)) {
          next.add(fontId);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, []);

  const preloadPickerFonts = useCallback(() => {
    ensureFontIds(ALL_READING_FONT_IDS);
  }, [ensureFontIds]);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = getReadingTypographySettingsSnapshot();
      const fontId = stored?.fontId ?? DEFAULT_READING_FONT_ID;
      ensureFontIds([fontId]);
    };

    syncFromStorage();
    window.addEventListener(READER_STORAGE_EVENT, syncFromStorage);
    return () => window.removeEventListener(READER_STORAGE_EVENT, syncFromStorage);
  }, [ensureFontIds]);

  const variableClasses = useMemo(
    () => readingFontVariableClasses(loadedIds),
    [loadedIds],
  );

  const value = useMemo(
    () => ({ ensureFontIds, preloadPickerFonts }),
    [ensureFontIds, preloadPickerFonts],
  );

  return (
    <ReadingFontsContext.Provider value={value}>
      <div className={cn(variableClasses, className)}>{children}</div>
    </ReadingFontsContext.Provider>
  );
}
