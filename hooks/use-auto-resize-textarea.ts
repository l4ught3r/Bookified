"use client";

import { useCallback, useLayoutEffect, type RefObject } from "react";

const DEFAULT_MAX_HEIGHT_PX = 160;

/** Grows a textarea with its content up to maxHeightPx (iOS Safari needs explicit height). */
export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeightPx = DEFAULT_MAX_HEIGHT_PX,
) {
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeightPx ? "auto" : "hidden";
  }, [ref, maxHeightPx]);

  useLayoutEffect(() => {
    resize();
    const id = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(id);
  }, [value, resize]);

  return resize;
}
