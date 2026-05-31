"use client";

import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AnimatedOverlayProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  labelledBy?: string;
  describedBy?: string;
};

export function AnimatedOverlay({
  open,
  children,
  className,
  panelClassName,
  labelledBy,
  describedBy,
}: AnimatedOverlayProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

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
      <div className="absolute inset-0 bg-overlay" />
      <div
        className={cn(
          "relative w-full max-w-md",
          !prefersReducedMotion &&
            "animate-in fade-in zoom-in-95 duration-200 ease-out",
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
