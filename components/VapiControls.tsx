"use client";

import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";
import Transcript from "@/components/Transcript";
import useVapi, { CallStatus } from "@/hooks/useVapi";
import { useRouter } from "@/lib/i18n/navigation";
import { IBook } from "@/types";

const VOICE_KEYS = ["dave", "daniel", "chris", "rachel", "sarah"] as const;

const VapiControls = ({ book }: { book: IBook }) => {
  const t = useTranslations("Vapi");
  const voiceT = useTranslations("Voice");
  const {
    status,
    isActive,
    messages,
    currentMessage,
    currentUserMessage,
    duration,
    start,
    stop,
    clearError,
    limitError,
    isBillingError,
    maxDurationSeconds,
  } = useVapi(book);
  const router = useRouter();

  useEffect(() => {
    if (limitError) {
      toast.error(limitError);
      if (isBillingError) {
        router.push("/subscriptions");
      } else {
        router.push("/");
      }
      clearError();
    }
  }, [isBillingError, limitError, router, clearError]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusDisplay = (callStatus: CallStatus | "idle") => {
    switch (callStatus) {
      case "connecting":
        return { label: t("status.connecting"), color: "vapi-status-dot-connecting" };
      case "starting":
        return { label: t("status.starting"), color: "vapi-status-dot-starting" };
      case "listening":
        return { label: t("status.listening"), color: "vapi-status-dot-listening" };
      case "thinking":
        return { label: t("status.thinking"), color: "vapi-status-dot-thinking" };
      case "speaking":
        return { label: t("status.speaking"), color: "vapi-status-dot-speaking" };
      default:
        return { label: t("status.ready"), color: "vapi-status-dot-ready" };
    }
  };

  const statusDisplay = getStatusDisplay(status);

  const personaKey = (book.persona || "daniel").toLowerCase();
  const voiceName = VOICE_KEYS.includes(personaKey as (typeof VOICE_KEYS)[number])
    ? voiceT(`${personaKey}.name`)
    : book.persona || voiceT("daniel.name");

  return (
    <>
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="vapi-header-card">
          <div className="vapi-cover-wrapper">
            <Image
              src={book.coverURL || "/images/book-placeholder.png"}
              alt={book.title}
              width={120}
              height={180}
              className="vapi-cover-image"
              style={{ width: "auto", height: "auto" }}
            />
            <div className="vapi-mic-wrapper relative">
              {isActive && (status === "speaking" || status === "thinking") && (
                <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
              )}
              <button
                type="button"
                onClick={isActive ? stop : start}
                disabled={status === "connecting"}
                aria-label={isActive ? t("status.listening") : t("status.ready")}
                className={`vapi-mic-btn shadow-md w-[60px]! h-[60px]! z-10 ${isActive ? "vapi-mic-btn-active" : "vapi-mic-btn-inactive"}`}
              >
                {isActive ? (
                  <Mic className="size-7 text-white" />
                ) : (
                  <MicOff className="size-7 text-[#212a3b]" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#212a3b] mb-1">
                {book.title}
              </h1>
              <p className="text-[#3d485e] font-medium">{t("byAuthor", { author: book.author })}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="vapi-status-indicator">
                <span className={`vapi-status-dot ${statusDisplay.color}`} />
                <span className="vapi-status-text">{statusDisplay.label}</span>
              </div>

              <div className="vapi-status-indicator">
                <span className="vapi-status-text">{t("voice", { name: voiceName })}</span>
              </div>

              <div className="vapi-status-indicator">
                <span className="vapi-status-text">
                  {formatDuration(duration)}/{formatDuration(maxDurationSeconds)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="vapi-transcript-wrapper">
          <div className="transcript-container min-h-[400px]">
            <Transcript
              messages={messages}
              currentMessage={currentMessage}
              currentUserMessage={currentUserMessage}
            />
          </div>
        </div>
      </div>
    </>
  );
};
export default VapiControls;
