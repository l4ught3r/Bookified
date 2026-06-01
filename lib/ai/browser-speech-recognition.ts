import type { AiChatLocale } from "@/lib/ai/book-context";

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function getBrowserSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function getSpeechRecognitionLang(locale: AiChatLocale): string {
  return locale === "ru" ? "ru-RU" : "en-US";
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export type VoiceSessionSpeechRecognition = {
  start: () => void;
  stop: () => void;
  /** Pause after an utterance; keeps the instance for the next turn. */
  pause: () => void;
  resume: () => void;
};

/** Continuous browser STT for live voice mode (Chrome/Edge; partial Safari support). */
export function createVoiceSessionSpeechRecognition(
  locale: AiChatLocale,
  callbacks: {
    onTranscript: (text: string, isFinal: boolean) => void;
    onError: () => void;
  },
): VoiceSessionSpeechRecognition | null {
  const Ctor = getBrowserSpeechRecognitionCtor();
  if (!Ctor) {
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = getSpeechRecognitionLang(locale);
  recognition.interimResults = true;
  const ios = isIosSafari();
  recognition.continuous = !ios;

  let shouldListen = false;
  let stopped = false;
  let finalizedTranscript = "";

  recognition.onresult = (event) => {
    let interimTranscript = "";
    let hasFinal = false;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) {
        continue;
      }

      const segment = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalizedTranscript += segment;
        hasFinal = true;
      } else {
        interimTranscript += segment;
      }
    }

    const trimmed = (finalizedTranscript + interimTranscript).trim();
    if (trimmed) {
      callbacks.onTranscript(trimmed, hasFinal);
    }
  };

  recognition.onerror = () => {
    callbacks.onError();
  };

  recognition.onend = () => {
    if (stopped || !shouldListen) {
      return;
    }

    if (ios) {
      window.setTimeout(() => {
        if (!stopped && shouldListen) {
          try {
            recognition.start();
          } catch {
            callbacks.onError();
          }
        }
      }, 200);
    }
  };

  const beginListening = () => {
    finalizedTranscript = "";
    try {
      recognition.start();
    } catch {
      callbacks.onError();
    }
  };

  return {
    start() {
      stopped = false;
      shouldListen = true;
      beginListening();
    },
    stop() {
      stopped = true;
      shouldListen = false;
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      }
    },
    pause() {
      shouldListen = false;
      finalizedTranscript = "";
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
    resume() {
      if (stopped) {
        return;
      }
      shouldListen = true;
      beginListening();
    },
  };
}
