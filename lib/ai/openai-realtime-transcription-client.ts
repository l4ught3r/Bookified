"use client";

import {
  arrayBufferToBase64,
  resamplePcm16,
} from "@/lib/ai/gemini-live-audio";
import { WHISPER_INPUT_SAMPLE_RATE } from "@/lib/ai/openai-realtime-transcription";

const REALTIME_WEBSOCKET_URL = "wss://api.openai.com/v1/realtime";

const GEMINI_MIC_SAMPLE_RATE = 16_000;

export type WhisperTranscriptHandlers = {
  onDelta: (itemId: string, delta: string) => void;
  onCompleted: (itemId: string, transcript: string) => void;
  onError: (message: string) => void;
};

type RealtimeServerEvent = {
  type?: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
};

function waitForWebSocketOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("OpenAI transcription WebSocket failed to connect"));
    };

    const cleanup = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
  });
}

export class OpenAIRealtimeTranscriptionClient {
  private socket: WebSocket | null = null;
  private closed = false;
  private reportedError = false;

  async connect(clientSecret: string, handlers: WhisperTranscriptHandlers): Promise<void> {
    this.closed = false;
    this.reportedError = false;
    // Model is set in the client_secret session config — no ?model= for transcription sessions.
    const socket = new WebSocket(REALTIME_WEBSOCKET_URL, [
      "realtime",
      `openai-insecure-api-key.${clientSecret}`,
    ]);

    socket.onmessage = (event) => {
      if (this.closed) {
        return;
      }

      let payload: RealtimeServerEvent;
      try {
        payload = JSON.parse(String(event.data)) as RealtimeServerEvent;
      } catch {
        return;
      }

      if (payload.type === "conversation.item.input_audio_transcription.delta") {
        const itemId = payload.item_id;
        const delta = payload.delta ?? "";
        if (itemId && delta) {
          handlers.onDelta(itemId, delta);
        }
        return;
      }

      if (payload.type === "conversation.item.input_audio_transcription.completed") {
        const itemId = payload.item_id;
        const transcript = payload.transcript?.trim() ?? "";
        if (itemId && transcript) {
          handlers.onCompleted(itemId, transcript);
        }
        return;
      }

      if (payload.type === "error") {
        this.reportErrorOnce(
          handlers,
          payload.error?.message ?? "OpenAI transcription error",
        );
      }
    };

    socket.onerror = () => {
      this.reportErrorOnce(handlers, "OpenAI transcription connection error");
    };

    await waitForWebSocketOpen(socket);
    this.socket = socket;
  }

  /** Flushes buffered audio for transcription (required when turn_detection is disabled). */
  commitAudioBuffer(): void {
    if (this.closed || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  }

  appendPcm16FromMic(pcm16At16kHz: ArrayBuffer): void {
    if (this.closed || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const pcm24 = resamplePcm16(pcm16At16kHz, GEMINI_MIC_SAMPLE_RATE, WHISPER_INPUT_SAMPLE_RATE);
    this.socket.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: arrayBufferToBase64(pcm24),
      }),
    );
  }

  close(): void {
    this.closed = true;
    if (!this.socket) {
      return;
    }

    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
    this.socket = null;
  }

  private reportErrorOnce(handlers: WhisperTranscriptHandlers, message: string): void {
    if (this.closed || this.reportedError) {
      return;
    }
    this.reportedError = true;
    this.close();
    handlers.onError(message);
  }
}
