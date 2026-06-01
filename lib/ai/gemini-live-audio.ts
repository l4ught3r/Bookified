const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;

export function resamplePcm16(
  pcm16: ArrayBuffer,
  sourceRate: number,
  targetRate: number,
): ArrayBuffer {
  const int16 = new Int16Array(pcm16);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = (int16[i] ?? 0) / 32768;
  }
  return float32ToPcm16(resampleFloat32(float32, sourceRate, targetRate));
}

export function float32ToPcm16(samples: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return int16.buffer;
}

export function resampleFloat32(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  if (sourceRate === targetRate) {
    return samples;
  }

  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const sourceIndex = Math.min(samples.length - 1, Math.floor(i * ratio));
    output[i] = samples[sourceIndex] ?? 0;
  }

  return output;
}

export function mergePcm16Chunks(chunks: Uint8Array[]): ArrayBuffer | null {
  if (chunks.length === 0) {
    return null;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class PcmAudioPlayer {
  private context: AudioContext;
  private nextStartTime = 0;
  private readonly activeSources = new Set<AudioBufferSourceNode>();
  private onPlaybackIdle: (() => void) | null = null;

  constructor() {
    this.context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  }

  setOnPlaybackIdle(callback: (() => void) | null): void {
    this.onPlaybackIdle = callback;
  }

  hasPendingPlayback(): boolean {
    return (
      this.activeSources.size > 0 || this.context.currentTime < this.nextStartTime - 0.05
    );
  }

  private notifyIfIdle(): void {
    if (!this.hasPendingPlayback()) {
      this.onPlaybackIdle?.();
    }
  }

  async resume(): Promise<void> {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  enqueuePcm16(pcmBuffer: ArrayBuffer): void {
    const int16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = (int16[i] ?? 0) / 32768;
    }

    const audioBuffer = this.context.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      this.notifyIfIdle();
    };

    const startAt = Math.max(this.context.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;
  }

  /** Stops all queued and playing chunks (barge-in). */
  stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.notifyIfIdle();
  }

  close(): void {
    this.stopPlayback();
    void this.context.close();
  }
}

export type MicCaptureHandle = {
  stop: () => void;
};

export function startMicrophoneCapture(
  onChunk: (pcm16: ArrayBuffer) => void,
): MicCaptureHandle {
  let stopped = false;
  let inputContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let processor: ScriptProcessorNode | null = null;

  const start = async () => {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    inputContext = new AudioContext();
    await inputContext.resume();

    const source = inputContext.createMediaStreamSource(mediaStream);
    processor = inputContext.createScriptProcessor(4096, 1, 1);
    const silentGain = inputContext.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (stopped) {
        return;
      }

      const channel = event.inputBuffer.getChannelData(0);
      const resampled = resampleFloat32(channel, inputContext!.sampleRate, INPUT_SAMPLE_RATE);
      onChunk(float32ToPcm16(resampled));
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(inputContext.destination);
  };

  void start();

  return {
    stop: () => {
      stopped = true;
      processor?.disconnect();
      processor = null;
      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      void inputContext?.close();
      inputContext = null;
    },
  };
}
