import { useEffect, useRef, useState } from "react";

// Brave ships Chromium (so webkitSpeechRecognition exists) but strips Google's
// speech API key, so every recognition attempt fails with a "network" error.
// Brave exposes navigator.brave.isBrave() — an async probe — to detect it.
interface BraveNavigator {
  brave?: { isBrave: () => Promise<boolean> };
}
async function detectBrave(): Promise<boolean> {
  const nav = navigator as unknown as BraveNavigator;
  try {
    return (await nav.brave?.isBrave()) === true;
  } catch {
    return false;
  }
}

// ─── Voice input (Web Speech API) ─────────────────────────────────
// Spec: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
export interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResult;
  };
}
export interface SpeechRecognitionErrorEvent {
  readonly error: string;
}
export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}
export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    | SpeechRecognitionConstructor
    | undefined;
}

// Map the spec's terse error codes to something a user can act on.
// "aborted" is intentionally silent — it fires when the user stops on purpose.
// `isBrave` reframes the otherwise-cryptic "network" error: in Brave it isn't
// a connectivity blip, it's that Brave disables speech recognition outright.
export function voiceErrorMessage(code: string, isBrave = false): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone blocked — allow mic access in your browser settings.";
    case "audio-capture":
      return "No microphone found.";
    case "no-speech":
      return "Didn't catch that — try speaking again.";
    case "network":
      return isBrave
        ? "Voice input isn't supported in Brave — use Chrome or Edge."
        : "Network error during speech recognition.";
    case "aborted":
      return null;
    default:
      return "Voice input failed — try again.";
  }
}

export interface VoiceInput {
  listening: boolean;
  supported: boolean;
  toggle: () => void;
  interim: string;
  error: string | null;
}

// Shared voice-to-text hook. `append` receives an updater that maps the
// current field value to the new one, so finalised transcripts add to
// existing text. Runs in continuous mode with interim results so the
// caller can show live partial words (`interim`) while the user speaks.
export function useVoiceInput(
  append: (updater: (prev: string) => string) => void,
): VoiceInput {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const braveRef = useRef(false);
  const supported = typeof window !== "undefined" && !!getSpeechRecognition();

  useEffect(() => {
    let active = true;
    detectBrave().then((brave) => {
      if (active) braveRef.current = brave;
    });
    return () => {
      active = false;
    };
  }, []);

  function toggle(): void {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setInterim("");
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    setError(null);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let pending = "";
      // Only walk results new since the last event (resultIndex).
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          const finalText = text.trim();
          if (finalText) {
            append((prev) => (prev ? `${prev} ${finalText}` : finalText));
          }
        } else {
          pending += text;
        }
      }
      setInterim(pending);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(voiceErrorMessage(e.error, braveRef.current));
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  return { listening, supported, toggle, interim, error };
}
