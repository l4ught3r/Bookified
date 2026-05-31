"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  BookOpen,
  Check,
  Copy,
  MoreHorizontal,
  PanelRightClose,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { AiChatLocale } from "@/lib/ai/book-context";
import {
  getUiMessageText,
  isUiMessageStreaming,
  storedToUiMessages,
  uiMessagesToStored,
} from "@/lib/ai/chat-messages";
import { clearAiChat, loadAiChat, saveAiChat } from "@/lib/books/ai-chat-storage";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AISidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  initialPrompt?: string;
  onClearPrompt: () => void;
  bookId?: string;
  bookTitle?: string;
  bookAuthor?: string;
  chapterTitle?: string;
  chapterOrder?: number;
  locale?: AiChatLocale;
}

function resolveChatErrorMessage(error: Error, t: (key: string) => string): string {
  const message = error.message.toLowerCase();

  if (message.includes("failed to fetch") || message.includes("network")) {
    return t("errorOffline");
  }

  if (message.includes("429") || message.includes("rate")) {
    return t("errorRateLimit");
  }

  return t("errorGeneric");
}

export function AISidebar({
  isOpen,
  onToggle,
  initialPrompt,
  onClearPrompt,
  bookId,
  bookTitle,
  chapterTitle,
  chapterOrder,
  locale = "en",
}: AISidebarProps) {
  const t = useTranslations("ai");
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobileLayout = useIsMobileLayout();
  const showMobileOverlay = isMobileLayout && isOpen;
  const hasBookContext = Boolean(bookTitle?.trim());

  useLockBodyScroll(showMobileOverlay);

  useEffect(() => {
    if (!showMobileOverlay) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMobileOverlay, onToggle]);

  const initialUiMessages = useMemo(() => {
    if (!bookId) {
      return [];
    }

    return storedToUiMessages(loadAiChat(bookId));
  }, [bookId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: bookId ? `/api/books/${bookId}/chat` : "/api/books/invalid/chat",
      }),
    [bookId],
  );

  const {
    messages: chatMessages,
    sendMessage,
    regenerate,
    setMessages,
    status,
    error: chatError,
    stop,
    clearError,
  } = useChat({
    id: bookId ? `ai-${bookId}` : "ai-empty",
    messages: initialUiMessages,
    transport,
    onFinish: ({ messages, isError, isAbort }) => {
      if (!bookId || isError || isAbort) {
        return;
      }

      saveAiChat(bookId, uiMessagesToStored(messages));
    },
  });

  const suggestedPrompts = useMemo(
    () => [
      { label: t("prompts.contextTitle"), prompt: t("prompts.contextPrompt") },
      { label: t("prompts.summaryTitle"), prompt: t("prompts.summaryPrompt") },
      { label: t("prompts.charactersTitle"), prompt: t("prompts.charactersPrompt") },
    ],
    [t],
  );

  const greetingText = hasBookContext ? t("greetingWithBook", { title: bookTitle! }) : t("greeting");

  const [typedInput, setTypedInput] = useState<string | null>(null);
  const [prevInitialPrompt, setPrevInitialPrompt] = useState(initialPrompt);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (initialPrompt !== prevInitialPrompt) {
    setPrevInitialPrompt(initialPrompt);
    setTypedInput(null);
  }

  const inputValue =
    typedInput !== null
      ? typedInput
      : initialPrompt
        ? t("fragmentPrefix", { text: initialPrompt })
        : "";

  const isLoading = status === "submitted" || status === "streaming";
  const hasStreamStarted = status === "streaming";
  const errorMessage =
    localError ?? (chatError ? resolveChatErrorMessage(chatError, t) : null);

  const visibleMessages = useMemo(
    () =>
      chatMessages.filter(
        (message) =>
          message.role === "user" ||
          getUiMessageText(message).length > 0 ||
          isUiMessageStreaming(message),
      ),
    [chatMessages],
  );

  const showGreeting = visibleMessages.length === 0;
  const showSuggestedPrompts = showGreeting && !isLoading && !errorMessage;

  useEffect(() => {
    if (!initialPrompt || !isOpen) return;
    textareaRef.current?.focus();
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [visibleMessages, showGreeting, prefersReducedMotion, isLoading, errorMessage]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) {
      return;
    }

    if (!bookId) {
      setLocalError(t("errorGeneric"));
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLocalError(t("errorOffline"));
      return;
    }

    const selectedText = initialPrompt?.trim() || undefined;

    setLocalError(null);
    setLastFailedUserMessage(null);
    clearError();
    setTypedInput(null);
    onClearPrompt();

    try {
      await sendMessage(
        { text: trimmed },
        { body: { chapterOrder, locale, selectedText } },
      );
    } catch {
      setLastFailedUserMessage(trimmed);
    }
  };

  const handleRetry = async () => {
    if (!lastFailedUserMessage) {
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await sendMessage(
        { text: lastFailedUserMessage },
        { body: { chapterOrder, locale } },
      );
      setLastFailedUserMessage(null);
    } catch {
      // error state handled by useChat
    }
  };

  const handleRegenerate = async (assistantMessageId: string) => {
    if (isLoading || !bookId) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLocalError(t("errorOffline"));
      return;
    }

    setLocalError(null);
    setLastFailedUserMessage(null);
    clearError();

    try {
      await regenerate({
        messageId: assistantMessageId,
        body: { chapterOrder, locale },
      });
    } catch {
      // error state handled by useChat
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setTypedInput(prompt);
    textareaRef.current?.focus();
  };

  const clearChat = () => {
    void stop();
    clearError();
    setLocalError(null);
    setLastFailedUserMessage(null);
    setTypedInput(null);
    onClearPrompt();
    setMessages([]);

    if (bookId) {
      clearAiChat(bookId);
    }
  };

  return (
    <>
      {showMobileOverlay ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
          aria-label={t("hidePanel")}
          onClick={onToggle}
        />
      ) : null}

      <aside
        className={cn(
          "relative flex h-full shrink-0 flex-col overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground",
          isMobileLayout
            ? isOpen
              ? "fixed inset-y-0 right-0 z-50 w-[min(100vw,380px)] shadow-xl lg:static lg:z-auto lg:w-[min(100vw,380px)] lg:shadow-none"
              : "w-0 border-0 lg:w-11 lg:border-l"
            : isOpen
              ? "w-[min(100vw,380px)]"
              : "w-11",
        )}
        aria-label={t("title")}
        aria-hidden={isMobileLayout && !isOpen ? true : undefined}
      >
        {isOpen ? (
          <div
            className={cn(
              "absolute inset-0 flex flex-col",
              isMobileLayout ? "w-[min(100vw,380px)]" : "w-[min(100vw,380px)]",
            )}
          >
          <header className="shrink-0 border-b border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onToggle}
                aria-label={t("hidePanel")}
                className="mt-0.5 shrink-0 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-primary">
                      {t("title")}
                    </p>
                    <p className="text-xs text-sidebar-foreground/70">{t("subtitle")}</p>
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 rounded-lg"
                    aria-label={t("moreActions")}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-lg">
                  <DropdownMenuItem onClick={clearChat} className="rounded-md">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("clearChat")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {hasBookContext ? (
              <div className="mt-2 w-full rounded-xl border border-sidebar-border bg-sidebar px-2 py-2">
                <div className="flex items-start gap-2">
                  <BookOpen
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sidebar-primary"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-sidebar-foreground">
                      {bookTitle}
                    </p>
                    <p className="line-clamp-2 text-sm leading-snug text-sidebar-foreground/90">
                      {t("chapterLabel")}: {chapterTitle?.trim() || t("noChapterSelected")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2.5 w-full rounded-xl border border-dashed border-sidebar-border px-3 py-2.5 text-sm text-sidebar-foreground/65">
                {t("subtitle")}
              </p>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-4">
              {showGreeting ? <GreetingBlock content={greetingText} /> : null}

              {visibleMessages.map((message) => (
                <MessageBlock
                  key={message.id}
                  message={message}
                  isStreaming={isUiMessageStreaming(message)}
                  regenerateDisabled={isLoading}
                  onRegenerate={handleRegenerate}
                />
              ))}

              {isLoading && !hasStreamStarted ? <ThinkingBubble label={t("thinking")} /> : null}

              {errorMessage ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                  {lastFailedUserMessage ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-lg"
                      onClick={() => void handleRetry()}
                    >
                      {t("retry")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {showSuggestedPrompts ? (
            <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
              <p className="mb-2 text-xs font-medium text-sidebar-foreground/65">{t("tryAsking")}</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSuggestedPrompt(item.prompt)}
                    className="min-h-10 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-left text-xs font-medium text-sidebar-accent-foreground transition-colors hover:border-sidebar-primary/40 hover:bg-sidebar-primary/10"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <footer className="shrink-0 border-t border-sidebar-border bg-sidebar-accent/30 p-3">
            <div className="flex items-stretch gap-2 rounded-xl border border-sidebar-border bg-sidebar p-1.5 shadow-sm">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                disabled={isLoading}
                rows={2}
                className="max-h-32 min-h-[52px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-sidebar-foreground shadow-none placeholder:text-sidebar-foreground/50 focus-visible:ring-sidebar-ring/50"
              />
              <Button
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                aria-label={t("send")}
                title={t("send")}
                className="h-auto min-h-[52px] min-w-[52px] w-11 shrink-0 self-stretch rounded-lg bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-sidebar-foreground/60">
              {t("disclaimer")}
            </p>
          </footer>
        </div>
      ) : (
        <div className="absolute inset-0 hidden w-11 flex-col items-center gap-3 py-4 lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={t("showPanel")}
            className="h-11 w-11 rounded-lg"
          >
            <PanelRightClose className="h-4 w-4 rotate-180 text-sidebar-foreground/70" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
        </div>
      )}
      </aside>
    </>
  );
}

function GreetingBlock({ content }: { content: string }) {
  const t = useTranslations("ai");

  return (
    <div className="flex justify-start">
      <article className="max-w-[92%]" aria-label={t("assistantLabel")}>
        <MessageMeta isUser={false} />
        <div className="rounded-2xl rounded-tl-md border border-sidebar-primary/20 bg-sidebar-primary/10 px-3.5 py-2.5 text-sm leading-snug whitespace-pre-wrap text-sidebar-accent-foreground shadow-sm">
          {content}
        </div>
      </article>
    </div>
  );
}

function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        <MessageMeta isUser={false} />
        <div className="rounded-2xl rounded-tl-md border border-sidebar-border bg-sidebar-accent px-3.5 py-2.5 shadow-sm">
          <p className="text-sm text-sidebar-foreground/70" role="status" aria-live="polite">
            {label}
            <span className="inline-flex w-4 animate-pulse">…</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageMeta({ isUser }: { isUser: boolean }) {
  const t = useTranslations("ai");

  return (
    <div
      className={cn("mb-1.5 flex items-center gap-1.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
          <Sparkles className="h-3 w-3" aria-hidden />
        </span>
      ) : null}
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-widest",
          isUser ? "text-sidebar-primary" : "text-sidebar-foreground/65",
        )}
      >
        {isUser ? t("userLabel") : t("assistantLabel")}
      </span>
    </div>
  );
}

function MessageBlock({
  message,
  isStreaming = false,
  regenerateDisabled = false,
  onRegenerate,
}: {
  message: UIMessage;
  isStreaming?: boolean;
  regenerateDisabled?: boolean;
  onRegenerate?: (messageId: string) => void;
}) {
  const t = useTranslations("ai");
  const isUser = message.role === "user";
  const content = getUiMessageText(message);
  const [copied, setCopied] = useState(false);
  const actionReveal =
    "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cn("group max-w-[92%]", isUser ? "items-end" : "items-start")}
        aria-label={isUser ? t("userLabel") : t("assistantLabel")}
      >
        <MessageMeta isUser={isUser} />

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-snug whitespace-pre-wrap shadow-sm",
            isUser
              ? "rounded-tr-md border border-sidebar-primary/25 bg-sidebar-primary/12 text-sidebar-foreground"
              : "rounded-tl-md border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          {content}
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sidebar-primary align-middle" />
          ) : null}
        </div>

        {!isUser && content ? (
          <div
            className={cn("mt-1.5 flex items-center gap-0.5 transition-opacity", actionReveal)}
            role="toolbar"
            aria-label={t("moreActions")}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md"
              aria-label={copied ? t("copied") : t("copy")}
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md"
              aria-label={t("regenerate")}
              title={t("regenerate")}
              disabled={regenerateDisabled || isStreaming}
              onClick={() => onRegenerate?.(message.id)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
      </article>
    </div>
  );
}
