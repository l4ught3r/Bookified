"use client";

import { FocusScope } from "@radix-ui/react-focus-scope";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AnimatedOverlayProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  onEscape?: () => void;
};

export function AnimatedOverlay({
  open,
  children,
  className,
  panelClassName,
  labelledBy,
  describedBy,
  onEscape,
}: AnimatedOverlayProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onEscape]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-100 flex items-center justify-center p-4",
        !prefersReducedMotion && "animate-in fade-in duration-200",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <div className="absolute inset-0 bg-overlay" aria-hidden />
      <FocusScope
        trapped
        loop
        onMountAutoFocus={(event) => {
          event.preventDefault();
          const focusable = panelRef.current?.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          focusable?.focus();
        }}
      >
        <div
          ref={panelRef}
          className={cn(
            "relative w-full max-w-md",
            !prefersReducedMotion &&
              "animate-in fade-in zoom-in-95 duration-200 ease-out",
            panelClassName,
          )}
        >
          {children}
        </div>
      </FocusScope>
    </div>
  );
}
