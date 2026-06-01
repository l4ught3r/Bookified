"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/nextjs";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  AudioLines,
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
import { AuthSignInButton } from "@/components/auth/clerk-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGeminiLiveVoice } from "@/hooks/use-gemini-live-voice";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import type { AiChatLocale } from "@/lib/ai/book-context";
import {
  getUiMessageText,
  isUiMessageStreaming,
  storedToUiMessages,
  uiMessagesToStored,
} from "@/lib/ai/chat-messages";
import { isEphemeralVoiceLabel } from "@/lib/ai/voice-chat-labels";
import { clearAiChat, loadAiChat, saveAiChat } from "@/lib/books/ai-chat-storage";
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
  const tCommon = useTranslations("common");
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const showAuthGate = isAuthLoaded && !isSignedIn;
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

  const greetingText = hasBookContext
    ? t("greetingWithBook", { title: bookTitle! })
    : t("greeting");

  const [typedInput, setTypedInput] = useState<string | null>(null);
  const [prevInitialPrompt, setPrevInitialPrompt] = useState(initialPrompt);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (initialPrompt === prevInitialPrompt) {
      return;
    }
    setPrevInitialPrompt(initialPrompt);
    setTypedInput(null);
  }, [initialPrompt, prevInitialPrompt]);

  const inputValue =
    typedInput !== null
      ? typedInput
      : initialPrompt
        ? t("fragmentPrefix", { text: initialPrompt })
        : "";

  const selectedTextForSession = initialPrompt?.trim() || undefined;

  const getChatMessages = useCallback(() => chatMessages, [chatMessages]);

  const handleLiveSessionEnd = useCallback(
    (messages: UIMessage[]) => {
      queueMicrotask(() => {
        setMessages(messages);
        if (bookId) {
          saveAiChat(bookId, uiMessagesToStored(messages));
        }
      });
    },
    [bookId, setMessages],
  );

  const {
    isActive: isLiveVoiceActive,
    isConnecting: isLiveVoiceConnecting,
    isVoiceToggleLocked: liveVoiceToggleLocked,
    canUserSpeak: liveCanUserSpeak,
    error: liveVoiceError,
    voiceWarning: liveVoiceWarning,
    sessionMessages,
    toggle: toggleLiveVoice,
    stop: stopLiveVoice,
  } = useGeminiLiveVoice({
    bookId,
    chapterOrder,
    locale,
    selectedText: selectedTextForSession,
    getChatMessages,
    onSessionEnd: handleLiveSessionEnd,
  });

  const stopLiveVoiceRef = useRef(stopLiveVoice);
  stopLiveVoiceRef.current = stopLiveVoice;

  useEffect(() => {
    if (!showAuthGate) {
      return;
    }

    recognitionRef.current?.stop();
    stopLiveVoiceRef.current();
  }, [showAuthGate]);

  const isChatLoading = status === "submitted" || status === "streaming";
  const isLoading = isChatLoading || isLiveVoiceConnecting;
  const hasStreamStarted = status === "streaming";
  const showChatThinking = isChatLoading && !hasStreamStarted;
  const showLiveConnecting = isLiveVoiceConnecting;
  const liveVoiceErrorMessage = liveVoiceError
    ? liveVoiceError === "offline"
      ? t("errorOffline")
      : liveVoiceError === "openai"
        ? t("errorOpenAiConfig")
        : liveVoiceError === "location"
          ? t("errorVoiceLocation")
          : liveVoiceError === "browserStt"
            ? t("errorVoiceBrowserStt")
            : t("errorVoiceDialog")
    : null;
  const liveVoiceWarningMessage =
    liveVoiceWarning === "transcriptionFailed" ? t("voiceWarningTranscriptionFailed") : null;
  const errorMessage =
    localError ??
    liveVoiceErrorMessage ??
    (chatError ? resolveChatErrorMessage(chatError, t) : null);

  const displayMessages = sessionMessages ?? chatMessages;

  const visibleMessages = useMemo(
    () =>
      displayMessages.filter((message) => {
        const text = getUiMessageText(message).trim();
        if (!text) {
          return false;
        }
        return message.role !== "user" || !isEphemeralVoiceLabel(text);
      }),
    [displayMessages],
  );

  const showGreeting = visibleMessages.length === 0 && !isLiveVoiceActive && !isLiveVoiceConnecting;
  const showSuggestedPrompts = showGreeting && !isLoading && !errorMessage;
  const showLiveConnectingInFooter = showLiveConnecting && visibleMessages.length > 0;
  const showLiveConnectingInChat = showLiveConnecting && visibleMessages.length === 0;
  const showLiveVoiceFooterHint = isLiveVoiceActive && !isLiveVoiceConnecting;
  const showLiveSpeakHint = showLiveVoiceFooterHint && liveCanUserSpeak;
  const showLiveAiSpeakingHint = showLiveVoiceFooterHint && !liveCanUserSpeak;
  const speakHintReducedMotion = usePrefersReducedMotion();

  const prevBookIdRef = useRef(bookId);
  useEffect(() => {
    if (prevBookIdRef.current === bookId) {
      return;
    }
    prevBookIdRef.current = bookId;
    stopLiveVoiceRef.current();
  }, [bookId]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopLiveVoiceRef.current();
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
    if (!trimmed || isLoading || isLiveVoiceActive) {
      return;
    }

    recognitionRef.current?.stop();
    stopLiveVoice();

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
      await sendMessage({ text: trimmed }, { body: { chapterOrder, locale, selectedText } });
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
      await sendMessage({ text: lastFailedUserMessage }, { body: { chapterOrder, locale } });
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
    if (isLiveVoiceActive || isLiveVoiceConnecting) {
      return;
    }

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
            <header className="relative z-40 shrink-0 border-b border-border/50 bg-card p-4">
              <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  aria-label={t("hidePanel")}
                  className="h-11 w-11 shrink-0 justify-self-start rounded-xl"
                >
                  <PanelRightClose className="h-4 w-4 text-muted-foreground" />
                </Button>

                <div className="flex min-w-0 flex-col items-center text-center">
                  <div className="flex max-w-full items-center justify-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                        {t("title")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{t("subtitle")}</p>
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
                      disabled={showAuthGate}
                      aria-label={t("clearChat")}
                      className="h-11 w-11 shrink-0 justify-self-end rounded-xl"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("clearChat")}</TooltipContent>
                </Tooltip>
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  showAuthGate && "pointer-events-none select-none blur-[5px]",
                )}
              >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
                <div
                  className={cn(
                    "flex flex-col",
                    (showGreeting || showLiveConnectingInChat) && "min-h-full",
                  )}
                >
                  {showLiveConnectingInChat ? (
                    <div className="flex flex-1 flex-col items-center justify-center">
                      <VoiceConnectingPanel label={t("voiceDialogConnectingLabel")} />
                    </div>
                  ) : showGreeting ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center">
                      <EmptyGreeting
                        content={greetingText}
                        suggestedPrompts={showSuggestedPrompts ? suggestedPrompts : undefined}
                        onSuggestedPrompt={handleSuggestedPrompt}
                      />
                    </div>
                  ) : null}

                  {!showGreeting && visibleMessages.length > 0 ? (
                    <div className="space-y-2">
                      {visibleMessages.map((message) => (
                        <MessageBlock
                          key={message.id}
                          message={message}
                          isStreaming={isUiMessageStreaming(message)}
                          regenerateDisabled={
                            isLoading || isLiveVoiceActive || isLiveVoiceConnecting
                          }
                          onRegenerate={handleRegenerate}
                        />
                      ))}
                    </div>
                  ) : null}

                  {showChatThinking ? <ThinkingBubble label={t("thinking")} /> : null}

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
                {liveVoiceWarningMessage ? (
                  <p
                    className="mb-3 text-center text-xs leading-relaxed text-amber-700 dark:text-amber-500"
                    role="status"
                  >
                    {liveVoiceWarningMessage}
                  </p>
                ) : null}
                {showLiveConnectingInFooter ? (
                  <VoiceConnectingPanel
                    label={t("voiceDialogConnectingLabel")}
                    className="mb-4 gap-3 py-1"
                  />
                ) : null}
                {showLiveSpeakHint ? (
                  <VoiceSpeakHint
                    label={t("voiceDialogSpeakPlaceholder")}
                    listening
                    reducedMotion={speakHintReducedMotion}
                  />
                ) : null}
                {showLiveAiSpeakingHint ? (
                  <VoiceSpeakHint
                    label={t("voiceDialogAiSpeaking")}
                    listening={false}
                    reducedMotion={speakHintReducedMotion}
                  />
                ) : null}
                <div className="flex items-end gap-1 rounded-[1.75rem] border border-border/40 bg-secondary/60 px-3 py-2 shadow-sm">
                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setTypedInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("placeholder")}
                    aria-label={t("placeholder")}
                    disabled={isLoading || isLiveVoiceActive}
                    rows={1}
                    className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50"
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
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleLiveVoice()}
                        disabled={
                          !bookId ||
                          isChatLoading ||
                          (liveVoiceToggleLocked && !isLiveVoiceActive && !isLiveVoiceConnecting)
                        }
                        aria-label={
                          isLiveVoiceActive || isLiveVoiceConnecting
                            ? t("stopVoiceDialog")
                            : t("voiceDialog")
                        }
                        aria-pressed={isLiveVoiceActive || isLiveVoiceConnecting}
                        className={cn(
                          "mb-0.5 h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground",
                          (isLiveVoiceActive || isLiveVoiceConnecting) && "text-primary",
                        )}
                      >
                        {isLiveVoiceActive || isLiveVoiceConnecting ? (
                          <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                        ) : (
                          <AudioLines className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleVoiceInput}
                        disabled={isLoading || isLiveVoiceActive || isLiveVoiceConnecting}
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
                    </>
                  )}
                </div>
                <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                  {isLiveVoiceActive
                    ? liveCanUserSpeak
                      ? t("voiceDialogActive")
                      : t("voiceDialogWaitForAi")
                    : t("disclaimer")}
                </p>
              </footer>
              </div>

              {showAuthGate ? (
                <AiSidebarAuthGate
                  title={t("signInGateTitle")}
                  description={t("signInGateDescription")}
                  signInLabel={tCommon("signIn")}
                />
              ) : null}
            </div>
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

function AiSidebarAuthGate({
  title,
  description,
  signInLabel,
}: {
  title: string;
  description: string;
  signInLabel: string;
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-background/10 p-6 backdrop-blur-xs"
      role="region"
      aria-label={title}
    >
      <div className="bg-background/90 dark:bg-secondary/80 rounded-2xl p-4 shadow-xl ring-1 ring-border/50">
        {" "}
        <div className="max-w-68 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <AuthSignInButton>
            <Button type="button" className="mt-5 w-full rounded-xl">
              {signInLabel}
            </Button>
          </AuthSignInButton>
        </div>
      </div>
    </div>
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

function VoiceSpeakHint({
  label,
  listening,
  reducedMotion,
}: {
  label: string;
  listening: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div
      className="mb-4 flex flex-col items-center justify-center gap-3 py-1"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center">
        {listening && !reducedMotion ? (
          <>
            <span
              className="absolute inset-0 rounded-full bg-primary/25 animate-ping"
              style={{ animationDuration: "2s" }}
            />
            <span className="absolute inset-2 rounded-full border border-primary/35 bg-primary/10 animate-pulse" />
          </>
        ) : null}
        <span
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-md",
            listening
              ? "text-primary ring-2 ring-primary/40"
              : "text-muted-foreground ring-1 ring-border/50",
          )}
        >
          {listening ? (
            <Mic className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          ) : (
            <AudioLines className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          )}
        </span>
      </div>
      <p
        className={cn(
          "text-lg font-semibold tracking-tight",
          listening ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
    </div>
  );
}

function VoiceConnectingPanel({ label, className }: { label: string; className?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn("flex flex-col items-center justify-center gap-5", className)}>
      <div className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center">
        {!prefersReducedMotion ? (
          <>
            <span
              className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
            <span className="absolute inset-2 rounded-full border border-primary/25 bg-primary/10 animate-pulse" />
          </>
        ) : null}
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-background/90 text-primary shadow-md ring-1 ring-primary/30 backdrop-blur-sm">
          <AudioLines className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </span>
      </div>

      <p
        className="text-[15px] font-semibold tracking-tight text-foreground"
        role="status"
        aria-live="polite"
      >
        {label}
      </p>
    </div>
  );
}

function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        <MessageMeta isUser={false} />
        <div className="rounded-2xl rounded-tl-md border border-border/50 bg-secondary px-3 py-2 shadow-sm">
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
    <div className={cn("mb-0.5 flex items-center gap-1", isUser ? "justify-end" : "justify-start")}>
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
            "rounded-2xl px-3 py-2 text-sm leading-snug whitespace-pre-wrap shadow-sm",
            isUser
              ? "rounded-tr-md border border-primary/25 bg-primary/10"
              : "rounded-tl-md border border-border/50 bg-secondary",
          )}
        >
          {content}
          {isStreaming && content ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
          ) : null}
        </div>

        {!isUser && content ? (
          <div
            className={cn("mt-1 flex items-center gap-0.5 transition-opacity", actionReveal)}
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
