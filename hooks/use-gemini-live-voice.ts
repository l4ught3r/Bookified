"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { UIMessage } from "ai";
import type { AiChatLocale } from "@/lib/ai/book-context";
import {
  createVoiceSessionSpeechRecognition,
  getBrowserSpeechRecognitionCtor,
  type VoiceSessionSpeechRecognition,
} from "@/lib/ai/browser-speech-recognition";
import { sanitizeBrowserTranscript } from "@/lib/ai/browser-transcript";
import {
  isEphemeralVoiceLabel,
  isInvalidBatchTranscript,
  stripEphemeralVoiceMessages,
  voiceMessagePlaceholder,
} from "@/lib/ai/voice-chat-labels";
import {
  FALLBACK_GEMINI_LIVE_MODEL,
  GEMINI_LIVE_API_VERSION,
  getLiveAudioTranscriptionConfig,
  getLiveRealtimeInputConfig,
  isGeminiLiveQuotaOrAvailabilityError,
  type GeminiLiveModelTier,
} from "@/lib/ai/gemini-live";
import {
  arrayBufferToBase64,
  PcmAudioPlayer,
  startMicrophoneCapture,
} from "@/lib/ai/gemini-live-audio";
import {
  commitTranscript,
  extractPcm16FromServerMessage,
  markStreamingMessagesDone,
  mergeTranscriptFragment,
  messagesEqual,
  upsertMessage,
  type RecentUserCommit,
} from "@/lib/ai/gemini-live-messages";

type LiveSessionResponse = {
  token: string;
  model: string;
  modelTier?: GeminiLiveModelTier;
};

function isFallbackLiveSession(payload: LiveSessionResponse): boolean {
  return payload.modelTier === "fallback" || payload.model === FALLBACK_GEMINI_LIVE_MODEL;
}

export type VoiceWarning = "transcriptionFailed" | null;

type UseGeminiLiveVoiceParams = {
  bookId?: string;
  chapterOrder?: number;
  locale?: AiChatLocale;
  selectedText?: string;
  getChatMessages: () => UIMessage[];
  onSessionEnd: (messages: UIMessage[]) => void;
};

export function useGeminiLiveVoice({
  bookId,
  chapterOrder,
  locale = "en",
  selectedText,
  getChatMessages,
  onSessionEnd,
}: UseGeminiLiveVoiceParams) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceWarning, setVoiceWarning] = useState<VoiceWarning>(null);
  const [canUserSpeak, setCanUserSpeak] = useState(true);
  const [sessionMessages, setSessionMessages] = useState<UIMessage[] | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const playerRef = useRef<PcmAudioPlayer | null>(null);
  const micRef = useRef<ReturnType<typeof startMicrophoneCapture> | null>(null);
  const browserSpeechRef = useRef<VoiceSessionSpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const endingRef = useRef(false);
  const liveSessionGenerationRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const voiceToggleLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isVoiceToggleLocked, setIsVoiceToggleLocked] = useState(false);

  const useBrowserSttRef = useRef(false);
  const browserSessionTranscriptRef = useRef("");

  const assistantOutputStartedRef = useRef(false);
  const assistantTurnCompleteRef = useRef(false);
  const userSpeechBlockedRef = useRef(false);

  const userDraftRef = useRef("");
  const assistantDraftRef = useRef("");
  const activeUserBubbleIdRef = useRef<string | null>(null);
  const userTurnCommittedRef = useRef(false);
  const userUtteranceFinalizingRef = useRef(false);
  const assistantMessageIdRef = useRef<string | null>(null);
  const suppressPlaybackRef = useRef(false);
  const recentUserCommitRef = useRef<RecentUserCommit | null>(null);

  const bookIdRef = useRef(bookId);
  const localeRef = useRef(locale);
  bookIdRef.current = bookId;
  localeRef.current = locale;

  const getChatMessagesRef = useRef(getChatMessages);
  const onSessionEndRef = useRef(onSessionEnd);
  getChatMessagesRef.current = getChatMessages;
  onSessionEndRef.current = onSessionEnd;

  const applySessionUpdate = useCallback((updater: (messages: UIMessage[]) => UIMessage[]) => {
    setSessionMessages((previous) => {
      const base = previous ?? getChatMessagesRef.current();
      const next = updater(base);
      if (messagesEqual(base, next)) {
        return previous ?? base;
      }
      return next;
    });
  }, []);

  const commitUserDraft = useCallback((messages: UIMessage[], text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isEphemeralVoiceLabel(trimmed) || isInvalidBatchTranscript(trimmed)) {
      return messages;
    }

    const messageId = activeUserBubbleIdRef.current ?? crypto.randomUUID();
    const result = commitTranscript(messages, messageId, "user", trimmed);
    recentUserCommitRef.current = {
      messageId,
      text: trimmed,
      committedAt: Date.now(),
    };
    userDraftRef.current = "";
    userTurnCommittedRef.current = true;
    return result.messages;
  }, []);

  const finalizeAssistantDraft = useCallback((messages: UIMessage[]) => {
    let next = messages;

    if (assistantDraftRef.current.trim()) {
      if (!assistantMessageIdRef.current) {
        assistantMessageIdRef.current = crypto.randomUUID();
      }
      const assistantResult = commitTranscript(
        next,
        assistantMessageIdRef.current,
        "assistant",
        assistantDraftRef.current,
      );
      next = assistantResult.messages;
      assistantDraftRef.current = "";
      assistantMessageIdRef.current = null;
    }

    return markStreamingMessagesDone(next);
  }, []);

  const finalizeDrafts = useCallback(
    (messages: UIMessage[]) => {
      const userText = sanitizeBrowserTranscript(
        userDraftRef.current || browserSessionTranscriptRef.current,
      );
      let next = stripEphemeralVoiceMessages(messages);
      if (userText && !isEphemeralVoiceLabel(userText)) {
        next = commitUserDraft(next, userText);
      }
      next = finalizeAssistantDraft(next);
      return stripEphemeralVoiceMessages(next);
    },
    [commitUserDraft, finalizeAssistantDraft],
  );

  const stopBrowserSpeech = useCallback(() => {
    browserSpeechRef.current?.stop();
    browserSpeechRef.current = null;
  }, []);

  const pauseBrowserSpeech = useCallback(() => {
    browserSpeechRef.current?.pause();
  }, []);

  const resumeBrowserSpeech = useCallback(() => {
    browserSpeechRef.current?.resume();
  }, []);

  const blockUserSpeech = useCallback(() => {
    userSpeechBlockedRef.current = true;
    setCanUserSpeak(false);
    if (useBrowserSttRef.current) {
      pauseBrowserSpeech();
    }
  }, [pauseBrowserSpeech]);

  const tryUnblockUserSpeech = useCallback(() => {
    if (!userSpeechBlockedRef.current) {
      return;
    }

    if (!assistantTurnCompleteRef.current) {
      return;
    }

    if (playerRef.current?.hasPendingPlayback()) {
      return;
    }

    userSpeechBlockedRef.current = false;
    assistantOutputStartedRef.current = false;
    assistantTurnCompleteRef.current = false;
    setCanUserSpeak(true);

    if (useBrowserSttRef.current && browserSpeechRef.current) {
      resumeBrowserSpeech();
    }
  }, [resumeBrowserSpeech]);

  const updateBrowserUserBubble = useCallback(
    (rawText: string) => {
      const text = sanitizeBrowserTranscript(rawText);
      if (!text) {
        return;
      }

      browserSessionTranscriptRef.current = text;

      if (!activeUserBubbleIdRef.current) {
        activeUserBubbleIdRef.current = crypto.randomUUID();
      }

      const bubbleId = activeUserBubbleIdRef.current;
      applySessionUpdate((messages) => upsertMessage(messages, bubbleId, "user", text, true));
    },
    [applySessionUpdate],
  );

  const commitBrowserUserTurn = useCallback(() => {
    const text = sanitizeBrowserTranscript(browserSessionTranscriptRef.current);
    if (!text) {
      return false;
    }

    applySessionUpdate((messages) => {
      let next = commitUserDraft(messages, text);
      next = markStreamingMessagesDone(next);
      return next;
    });
    setVoiceWarning(null);
    return true;
  }, [applySessionUpdate, commitUserDraft]);

  const startBrowserSpeech = useCallback(() => {
    stopBrowserSpeech();
    browserSessionTranscriptRef.current = "";

    const recognition = createVoiceSessionSpeechRecognition(localeRef.current, {
      onTranscript: (text) => {
        if (
          !activeRef.current ||
          !useBrowserSttRef.current ||
          userSpeechBlockedRef.current ||
          userTurnCommittedRef.current ||
          userUtteranceFinalizingRef.current
        ) {
          return;
        }

        updateBrowserUserBubble(text);
      },
      onError: () => {
        if (!useBrowserSttRef.current) {
          return;
        }

        useBrowserSttRef.current = false;
        stopBrowserSpeech();

        const hasText =
          browserSessionTranscriptRef.current.trim().length > 0 ||
          userDraftRef.current.trim().length > 0;

        if (!hasText) {
          setVoiceWarning("transcriptionFailed");
        }
      },
    });

    if (!recognition) {
      return;
    }

    browserSpeechRef.current = recognition;
    recognition.start();
  }, [stopBrowserSpeech, updateBrowserUserBubble]);

  const commitFallbackUserTranscript = useCallback(
    (text: string, showWarning: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return false;
      }

      applySessionUpdate((messages) => {
        let next = commitUserDraft(messages, trimmed);
        next = markStreamingMessagesDone(next);
        return next;
      });

      if (showWarning) {
        setVoiceWarning("transcriptionFailed");
      } else {
        setVoiceWarning(null);
      }

      return true;
    },
    [applySessionUpdate, commitUserDraft],
  );

  const removeActiveUserBubble = useCallback(() => {
    const bubbleId = activeUserBubbleIdRef.current;
    if (!bubbleId) {
      return;
    }

    applySessionUpdate((messages) => messages.filter((message) => message.id !== bubbleId));
    activeUserBubbleIdRef.current = null;
  }, [applySessionUpdate]);

  const finalizeUserUtterance = useCallback(() => {
    if (commitBrowserUserTurn()) {
      return;
    }

    const browserDraft = sanitizeBrowserTranscript(browserSessionTranscriptRef.current);
    if (browserDraft) {
      commitFallbackUserTranscript(browserDraft, false);
      return;
    }

    removeActiveUserBubble();
    setVoiceWarning("transcriptionFailed");
  }, [commitBrowserUserTurn, commitFallbackUserTranscript, removeActiveUserBubble]);

  const resetForNextUserTurn = useCallback(() => {
    browserSessionTranscriptRef.current = "";
    userTurnCommittedRef.current = false;
    userUtteranceFinalizingRef.current = false;
    activeUserBubbleIdRef.current = null;
  }, []);

  const markAssistantOutputStarted = useCallback(() => {
    if (assistantOutputStartedRef.current) {
      return;
    }
    assistantOutputStartedRef.current = true;
    assistantTurnCompleteRef.current = false;
    userUtteranceFinalizingRef.current = true;

    blockUserSpeech();
    finalizeUserUtterance();
  }, [blockUserSpeech, finalizeUserUtterance]);

  const lockVoiceToggle = useCallback((durationMs = 700) => {
    setIsVoiceToggleLocked(true);
    if (voiceToggleLockTimerRef.current) {
      clearTimeout(voiceToggleLockTimerRef.current);
    }
    voiceToggleLockTimerRef.current = setTimeout(() => {
      setIsVoiceToggleLocked(false);
      voiceToggleLockTimerRef.current = null;
    }, durationMs);
  }, []);

  const cleanupSession = useCallback(() => {
    stopBrowserSpeech();
    micRef.current?.stop();
    micRef.current = null;
    intentionalCloseRef.current = true;
    sessionRef.current?.close();
    sessionRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    activeRef.current = false;
    useBrowserSttRef.current = false;
    browserSessionTranscriptRef.current = "";
    userDraftRef.current = "";
    assistantDraftRef.current = "";
    activeUserBubbleIdRef.current = null;
    userTurnCommittedRef.current = false;
    userUtteranceFinalizingRef.current = false;
    assistantMessageIdRef.current = null;
    suppressPlaybackRef.current = false;
    recentUserCommitRef.current = null;
    assistantOutputStartedRef.current = false;
    assistantTurnCompleteRef.current = false;
    userSpeechBlockedRef.current = false;
    setCanUserSpeak(true);
    setVoiceWarning(null);
    setIsActive(false);
    setIsConnecting(false);
    endingRef.current = false;
  }, [stopBrowserSpeech]);

  const endSession = useCallback(
    (options?: { connectionError?: boolean; errorCode?: string }) => {
      if (endingRef.current) {
        return;
      }

      endingRef.current = true;
      finalizeUserUtterance();

      setSessionMessages((current) => {
        if (current) {
          const merged = stripEphemeralVoiceMessages(finalizeDrafts(current));
          if (merged.length > 0) {
            queueMicrotask(() => onSessionEndRef.current(merged));
          }
        }
        return null;
      });

      cleanupSession();
      lockVoiceToggle();

      if (options?.errorCode) {
        setError(options.errorCode);
      } else if (options?.connectionError) {
        setError("connection");
      }
    },
    [cleanupSession, finalizeDrafts, finalizeUserUtterance, lockVoiceToggle],
  );

  const resolveLiveCloseError = useCallback((reason: string): string => {
    const lower = reason.toLowerCase();
    if (lower.includes("location") || lower.includes("not supported for the api")) {
      return "location";
    }
    return "connection";
  }, []);

  const handleServerMessage = useCallback(
    (message: LiveServerMessage) => {
      const serverContent = message.serverContent;
      if (!serverContent) {
        return;
      }

      if (serverContent.interrupted) {
        suppressPlaybackRef.current = true;
        playerRef.current?.stopPlayback();
        userUtteranceFinalizingRef.current = true;
        if (useBrowserSttRef.current) {
          pauseBrowserSpeech();
        }
        finalizeUserUtterance();
        userSpeechBlockedRef.current = false;
        assistantOutputStartedRef.current = false;
        assistantTurnCompleteRef.current = false;
        setCanUserSpeak(true);
        resetForNextUserTurn();
        if (useBrowserSttRef.current && browserSpeechRef.current) {
          resumeBrowserSpeech();
        }

        applySessionUpdate((messages) => {
          let next = messages;
          if (assistantDraftRef.current.trim() && assistantMessageIdRef.current) {
            const result = commitTranscript(
              messages,
              assistantMessageIdRef.current,
              "assistant",
              assistantDraftRef.current,
            );
            next = markStreamingMessagesDone(result.messages);
          } else {
            next = markStreamingMessagesDone(messages);
          }
          assistantDraftRef.current = "";
          assistantMessageIdRef.current = null;
          return next;
        });
      }

      const outputFragment = serverContent.outputTranscription?.text ?? "";
      if (outputFragment) {
        markAssistantOutputStarted();
        suppressPlaybackRef.current = false;
        assistantDraftRef.current = mergeTranscriptFragment(
          assistantDraftRef.current,
          outputFragment,
        );
        if (!assistantMessageIdRef.current) {
          assistantMessageIdRef.current = crypto.randomUUID();
        }

        applySessionUpdate((messages) =>
          upsertMessage(
            messages,
            assistantMessageIdRef.current!,
            "assistant",
            assistantDraftRef.current,
            !serverContent.turnComplete,
          ),
        );
      }

      if (serverContent.turnComplete) {
        suppressPlaybackRef.current = false;
        assistantTurnCompleteRef.current = true;
        applySessionUpdate((messages) => {
          const next = finalizeAssistantDraft(messages);
          assistantMessageIdRef.current = null;
          return next;
        });
        resetForNextUserTurn();
        tryUnblockUserSpeech();
      }

      const pcm = extractPcm16FromServerMessage(message);
      if (pcm && pcm.byteLength > 0 && !suppressPlaybackRef.current) {
        markAssistantOutputStarted();
        if (!assistantMessageIdRef.current) {
          assistantMessageIdRef.current = crypto.randomUUID();
          applySessionUpdate((messages) =>
            upsertMessage(
              messages,
              assistantMessageIdRef.current!,
              "assistant",
              assistantDraftRef.current,
              true,
            ),
          );
        }

        void playerRef.current?.resume();
        playerRef.current?.enqueuePcm16(pcm);
      }
    },
    [
      applySessionUpdate,
      finalizeAssistantDraft,
      finalizeUserUtterance,
      markAssistantOutputStarted,
      pauseBrowserSpeech,
      resetForNextUserTurn,
      resumeBrowserSpeech,
      tryUnblockUserSpeech,
    ],
  );

  const start = useCallback(async () => {
    if (!bookId || activeRef.current || startingRef.current) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("offline");
      return;
    }

    if (!getBrowserSpeechRecognitionCtor()) {
      setError("browserStt");
      return;
    }

    useBrowserSttRef.current = true;

    const sessionGeneration = ++liveSessionGenerationRef.current;
    intentionalCloseRef.current = false;

    startingRef.current = true;
    setError(null);
    setVoiceWarning(null);
    setIsConnecting(true);
    setSessionMessages([...getChatMessagesRef.current()]);
    resetForNextUserTurn();

    const requestLiveSession = async (
      modelTier?: GeminiLiveModelTier,
    ): Promise<LiveSessionResponse> => {
      const response = await fetch(`/api/books/${bookId}/live-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterOrder,
          locale,
          selectedText: selectedText?.trim() || undefined,
          ...(modelTier ? { modelTier } : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const errorMessage = payload?.error ?? "Failed to start live session";

        if (
          !modelTier &&
          isGeminiLiveQuotaOrAvailabilityError(errorMessage, response.status)
        ) {
          console.warn("[Gemini Live] live-session quota error, requesting fallback model");
          return requestLiveSession("fallback");
        }

        throw new Error(errorMessage);
      }

      return (await response.json()) as LiveSessionResponse;
    };

    const connectLiveSession = async (sessionPayload: LiveSessionResponse) => {
      const ai = new GoogleGenAI({
        apiKey: sessionPayload.token,
        httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
      });

      const player = new PcmAudioPlayer();
      player.setOnPlaybackIdle(() => {
        tryUnblockUserSpeech();
      });
      playerRef.current = player;
      await player.resume();

      return ai.live.connect({
        model: sessionPayload.model,
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: getLiveAudioTranscriptionConfig(),
          realtimeInputConfig: getLiveRealtimeInputConfig(),
        },
        callbacks: {
          onmessage: handleServerMessage,
          onerror: (event: ErrorEvent) => {
            if (sessionGeneration !== liveSessionGenerationRef.current) {
              return;
            }
            console.error("[Gemini Live]", event.message || event);
            endSession({ connectionError: true });
          },
          onclose: (event: CloseEvent) => {
            if (sessionGeneration !== liveSessionGenerationRef.current) {
              return;
            }

            if (intentionalCloseRef.current || event.code === 1000) {
              if (activeRef.current && !endingRef.current) {
                cleanupSession();
                lockVoiceToggle();
              }
              return;
            }

            if (activeRef.current) {
              console.error("[Gemini Live] connection closed:", event.code, event.reason);
              endSession({
                connectionError: true,
                errorCode: resolveLiveCloseError(event.reason ?? ""),
              });
              return;
            }

            cleanupSession();
          },
        },
      });
    };

    const activateLiveSession = async (session: Session) => {
      if (sessionGeneration !== liveSessionGenerationRef.current) {
        intentionalCloseRef.current = true;
        session.close();
        return;
      }

      sessionRef.current = session;
      activeRef.current = true;
      setIsActive(true);
      setIsConnecting(false);

      if (useBrowserSttRef.current) {
        startBrowserSpeech();
      }

      micRef.current = startMicrophoneCapture((pcm16) => {
        if (userSpeechBlockedRef.current) {
          return;
        }

        sessionRef.current?.sendRealtimeInput({
          audio: {
            data: arrayBufferToBase64(pcm16),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      });
    };

    try {
      let sessionPayload = await requestLiveSession();

      try {
        const session = await connectLiveSession(sessionPayload);
        await activateLiveSession(session);
      } catch (connectError) {
        const connectMessage =
          connectError instanceof Error ? connectError.message : String(connectError);

        if (
          isGeminiLiveQuotaOrAvailabilityError(connectMessage) &&
          !isFallbackLiveSession(sessionPayload)
        ) {
          console.warn(
            "[Gemini Live] primary connect failed, retrying with fallback model:",
            connectMessage,
          );
          cleanupSession();
          intentionalCloseRef.current = false;
          sessionPayload = await requestLiveSession("fallback");
          const session = await connectLiveSession(sessionPayload);
          await activateLiveSession(session);
        } else {
          throw connectError;
        }
      }
    } catch (startError) {
      setSessionMessages(null);
      cleanupSession();
      lockVoiceToggle();
      const message = startError instanceof Error ? startError.message : "Failed to start live session";
      console.error("[Gemini Live] failed to start:", message);
      setError(message.includes("GEMINI") ? "config" : "generic");
    } finally {
      startingRef.current = false;
    }
  }, [
    bookId,
    chapterOrder,
    locale,
    selectedText,
    handleServerMessage,
    cleanupSession,
    endSession,
    resetForNextUserTurn,
    resolveLiveCloseError,
    startBrowserSpeech,
    tryUnblockUserSpeech,
    lockVoiceToggle,
  ]);

  const stop = useCallback(() => {
    liveSessionGenerationRef.current += 1;
    endSession();
  }, [endSession]);

  const toggle = useCallback(() => {
    if (isVoiceToggleLocked && !isActive && !isConnecting) {
      return;
    }

    if (isActive || isConnecting) {
      stop();
      return;
    }

    void start();
  }, [isActive, isConnecting, isVoiceToggleLocked, start, stop]);

  return {
    isActive,
    isConnecting,
    isVoiceToggleLocked,
    canUserSpeak,
    error,
    voiceWarning,
    sessionMessages,
    toggle,
    stop,
  };
}
