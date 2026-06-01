"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useIsMobileLayout } from "@/hooks/use-media-query";

export type SelectionToolbarPlacement = "above-end" | "below-bounds-end";

function isRangeWithinRoot(root: HTMLElement, range: Range): boolean {
  const container = range.commonAncestorContainer;
  return root === container || root.contains(container);
}

function getSelectionEndClientRect(range: Range): DOMRect | null {
  const endRange = range.cloneRange();
  endRange.collapse(false);

  const rects = endRange.getClientRects();
  if (rects.length > 0) {
    return rects[rects.length - 1] ?? null;
  }

  const rect = endRange.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0 ? null : rect;
}

/** Union of line boxes — stable bottom-right for multi-line selections. */
function getSelectionBoundsClientRect(range: Range): DOMRect | null {
  const rects = range.getClientRects();
  if (rects.length === 0) {
    const rect = range.getBoundingClientRect();
    return rect.width === 0 && rect.height === 0 ? null : rect;
  }

  let top = Number.POSITIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (!Number.isFinite(top)) {
    return null;
  }

  return new DOMRect(left, top, right - left, bottom - top);
}

const TOOLBAR_ESTIMATE_WIDTH = 100;
const TOOLBAR_ESTIMATE_HEIGHT = 52;
const TOOLBAR_GAP_PX = 10;

function clampToolbarAnchor(
  x: number,
  y: number,
  placement: SelectionToolbarPlacement,
): { x: number; y: number } {
  const pad = 8;
  const maxX = window.innerWidth - pad;
  const maxY = window.innerHeight - pad;

  if (placement === "below-bounds-end") {
    return {
      x: Math.min(Math.max(x, pad + TOOLBAR_ESTIMATE_WIDTH), maxX),
      y: Math.min(Math.max(y, pad), maxY - TOOLBAR_ESTIMATE_HEIGHT),
    };
  }

  return {
    x: Math.min(Math.max(x, pad), maxX),
    y: Math.min(Math.max(y, pad + TOOLBAR_ESTIMATE_HEIGHT), maxY),
  };
}

type SelectionState = {
  text: string;
  position: { x: number; y: number; placement: SelectionToolbarPlacement };
  anchorKey: string | number | undefined;
};

type UseReadingTextSelectionOptions = {
  enabled?: boolean;
  onAskAI?: (text: string) => void;
  /** Clears toolbar when content changes (e.g. chapter or PDF page). */
  resetKey?: string | number;
};

export function useReadingTextSelection(
  rootRef: RefObject<HTMLElement | null>,
  { enabled = true, onAskAI, resetKey }: UseReadingTextSelectionOptions = {},
) {
  const isMobileLayout = useIsMobileLayout();
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const toolbarInteractingRef = useRef(false);

  const selectionActive =
    enabled && selection !== null && selection.anchorKey === resetKey;

  const selectedText = selectionActive ? selection.text : "";
  const selectionPosition = selectionActive ? selection.position : null;

  const hideSelectionToolbar = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const showToolbarAfterSelection = () => {
      if (toolbarInteractingRef.current) return;

      const root = rootRef.current;
      if (!root) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        return;
      }

      const range = sel.getRangeAt(0);
      if (!isRangeWithinRoot(root, range)) {
        return;
      }

      const text = sel.toString().trim();
      if (!text) return;

      const placement: SelectionToolbarPlacement = isMobileLayout
        ? "below-bounds-end"
        : "above-end";

      let x = 0;
      let y = 0;

      if (placement === "below-bounds-end") {
        const bounds = getSelectionBoundsClientRect(range);
        if (!bounds) return;
        x = bounds.right;
        y = bounds.bottom + TOOLBAR_GAP_PX;
      } else {
        const endRect = getSelectionEndClientRect(range);
        if (!endRect) return;
        x = endRect.right;
        y = endRect.top - TOOLBAR_GAP_PX;
      }

      const clamped = clampToolbarAnchor(x, y, placement);

      setSelection({
        text,
        position: {
          x: clamped.x,
          y: clamped.y,
          placement,
        },
        anchorKey: resetKey,
      });
    };

    const handleSelectionChange = () => {
      if (toolbarInteractingRef.current) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        hideSelectionToolbar();
        return;
      }

      window.requestAnimationFrame(showToolbarAfterSelection);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (selectionToolbarRef.current?.contains(target)) {
        toolbarInteractingRef.current = true;
        return;
      }

      const root = rootRef.current;
      if (root?.contains(target)) return;

      hideSelectionToolbar();
    };

    const handlePointerUp = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && selectionToolbarRef.current?.contains(target)) {
        toolbarInteractingRef.current = false;
        return;
      }

      toolbarInteractingRef.current = false;
      window.requestAnimationFrame(showToolbarAfterSelection);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideSelectionToolbar();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, hideSelectionToolbar, isMobileLayout, resetKey, rootRef]);

  const handleToolbarPointerDown = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault();
    toolbarInteractingRef.current = true;
  }, []);

  const handleAskAboutSelection = useCallback(() => {
    if (!selectedText || !onAskAI) return;
    onAskAI(selectedText);
  }, [onAskAI, selectedText]);

  return {
    selectedText,
    selectionPosition,
    selectionToolbarRef,
    handleToolbarPointerDown,
    handleAskAboutSelection,
    hideSelectionToolbar,
  };
}
