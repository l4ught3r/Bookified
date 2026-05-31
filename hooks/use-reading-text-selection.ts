"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

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

type SelectionState = {
  text: string;
  position: { x: number; y: number };
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

      const endRect = getSelectionEndClientRect(range);
      if (!endRect) return;

      setSelection({
        text,
        position: {
          x: endRect.right,
          y: endRect.top - 8,
        },
        anchorKey: resetKey,
      });
    };

    const handleSelectionChange = () => {
      if (toolbarInteractingRef.current) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        hideSelectionToolbar();
      }
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
  }, [enabled, hideSelectionToolbar, resetKey, rootRef]);

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
