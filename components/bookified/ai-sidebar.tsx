"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  Check,
  Copy,
  Mic,
  PanelRightClose,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

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
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [visibleMessages, showGreeting, prefersReducedMotion, isLoading, errorMessage]);

  useEffect(() => {
    if (!initialPrompt || !isOpen) return;
    textareaRef.current?.focus();
  }, [initialPrompt, isOpen]);

  const hasInput = inputValue.trim().length > 0;

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) {
      return;
    }

    recognitionRef.current?.stop();

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

  const handleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    type SpeechRecognitionInstance = {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    const SpeechRecognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = locale === "ru" ? "ru-RU" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) {
        return;
      }

      setTypedInput((current) => {
        const base = current ?? (initialPrompt ? t("fragmentPrefix", { text: initialPrompt }) : "");
        return base ? `${base} ${transcript}` : transcript;
      });
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const clearChat = () => {
    recognitionRef.current?.stop();
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
          "relative flex h-full shrink-0 flex-col overflow-hidden border-l border-border/50 bg-card",
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
          <header className="relative z-20 shrink-0 border-b border-border/50 p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                      {t("title")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
                  </div>
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearChat}
                    aria-label={t("clearChat")}
                    className="h-11 w-11 shrink-0 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("clearChat")}</TooltipContent>
              </Tooltip>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggle}
                aria-label={t("hidePanel")}
                className="h-11 w-11 shrink-0 rounded-xl"
              >
                <PanelRightClose className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
            <div className={cn("flex flex-col", showGreeting && "min-h-full")}>
              {showGreeting ? (
                <div className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center">
                  <EmptyGreeting
                    content={greetingText}
                    suggestedPrompts={showSuggestedPrompts ? suggestedPrompts : undefined}
                    onSuggestedPrompt={handleSuggestedPrompt}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleMessages.map((message) => (
                    <MessageBlock
                      key={message.id}
                      message={message}
                      isStreaming={isUiMessageStreaming(message)}
                      regenerateDisabled={isLoading}
                      onRegenerate={handleRegenerate}
                    />
                  ))}
                </div>
              )}

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

          <footer className="shrink-0 p-4 pt-0">
            <div className="flex items-end gap-1 rounded-[1.75rem] border border-border/40 bg-secondary/60 px-3 py-2 shadow-sm">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                disabled={isLoading}
                rows={1}
                className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50"
              />
              {hasInput ? (
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isLoading}
                  size="icon"
                  aria-label={t("send")}
                  className="mb-0.5 h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleVoiceInput}
                  disabled={isLoading}
                  aria-label={isListening ? t("stopRecording") : t("voiceInput")}
                  aria-pressed={isListening}
                  className={cn(
                    "mb-0.5 h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground",
                    isListening && "text-primary",
                  )}
                >
                  {isListening ? (
                    <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                  ) : (
                    <Mic className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              )}
            </div>
            <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
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
            className="h-11 w-11 rounded-xl"
          >
            <PanelRightClose className="h-4 w-4 rotate-180 text-muted-foreground" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
        </div>
      )}
      </aside>
    </>
  );
}

function EmptyGreeting({
  content,
  suggestedPrompts,
  onSuggestedPrompt,
}: {
  content: string;
  suggestedPrompts?: { label: string; prompt: string }[];
  onSuggestedPrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex w-full max-w-[280px] flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{content}</p>
      </div>

      {suggestedPrompts?.length ? (
        <div className="flex w-full flex-col gap-2">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSuggestedPrompt(item.prompt)}
              className="w-full rounded-xl border border-border/50 bg-secondary/60 px-3 py-2.5 text-sm font-medium text-foreground/85 transition-colors hover:border-primary/35 hover:bg-primary/10"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        <MessageMeta isUser={false} />
        <div className="rounded-2xl rounded-tl-md border border-border/50 bg-secondary px-3.5 py-2.5 shadow-sm">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
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
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-3 w-3" aria-hidden />
        </span>
      ) : null}
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-widest",
          isUser ? "text-primary" : "text-muted-foreground",
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
              ? "rounded-tr-md border border-primary/25 bg-primary/10"
              : "rounded-tl-md border border-border/50 bg-secondary",
          )}
        >
          {content}
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
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
