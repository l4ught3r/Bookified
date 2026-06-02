"use client";

import { FocusScope } from "@radix-ui/react-focus-scope";
import type { ReactElement, RefObject } from "react";

type FocusTrapScopeProps = {
  children: ReactElement;
  initialFocusRef: RefObject<HTMLElement | null>;
};

/** Traps focus inside a single child element (uses Radix `asChild`). */
export function FocusTrapScope({ children, initialFocusRef }: FocusTrapScopeProps) {
  return (
    <FocusScope
      trapped
      loop
      asChild
      onMountAutoFocus={(event) => {
        event.preventDefault();
        initialFocusRef.current?.focus();
      }}
    >
      {children}
    </FocusScope>
  );
}
