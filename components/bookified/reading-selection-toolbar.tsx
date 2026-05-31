"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ReadingSelectionToolbarProps = {
  selectedText: string;
  selectionPosition: { x: number; y: number } | null;
  selectionToolbarRef: React.RefObject<HTMLDivElement | null>;
  onToolbarPointerDown: (event: React.MouseEvent | React.PointerEvent) => void;
  onAskAboutSelection: () => void;
};

export function ReadingSelectionToolbar({
  selectedText,
  selectionPosition,
  selectionToolbarRef,
  onToolbarPointerDown,
  onAskAboutSelection,
}: ReadingSelectionToolbarProps) {
  const t = useTranslations("reader");
  const [copiedSelection, setCopiedSelection] = useState<string | null>(null);
  const copied = copiedSelection === selectedText;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopiedSelection(selectedText);
      window.setTimeout(() => setCopiedSelection(null), 2000);
    } catch {
      setCopiedSelection(null);
    }
  }, [selectedText]);

  if (typeof document === "undefined" || !selectedText || !selectionPosition) {
    return null;
  }

  return createPortal(
    <TooltipProvider>
      <div
        ref={selectionToolbarRef}
        className="fixed z-50 flex items-center gap-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-xl select-none animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
        style={{
          left: selectionPosition.x,
          top: selectionPosition.y,
          transform: "translate(0%, -100%)",
        }}
        role="toolbar"
        aria-label={t("selectionActions")}
        onMouseDown={onToolbarPointerDown}
        onPointerDown={onToolbarPointerDown}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-lg"
              onClick={() => void handleCopy()}
              aria-label={copied ? t("copied") : t("copy")}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? t("copied") : t("copy")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-lg text-ai-accent hover:text-ai-accent"
              onClick={onAskAboutSelection}
              aria-label={t("askAi")}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("askAi")}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>,
    document.body,
  );
}
