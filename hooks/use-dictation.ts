"use client";

import * as React from "react";

export type DictationLang = "en-US" | "am-ET";

export interface Dictation {
  listening: boolean;
  notice: string | null;
  lang: DictationLang;
  supported: boolean;
  toggle: () => void;
  setLang: (lang: DictationLang) => void;
  dismissNotice: () => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed":
    "Microphone access was blocked. Allow it from your browser's address bar, then try again.",
  "service-not-allowed": "Microphone access was blocked by your browser settings.",
  "no-speech": "I did not catch that — try again and speak just after the mic turns red.",
  "audio-capture": "No microphone was found on this device.",
  network: "Dictation needs a network connection to transcribe.",
  aborted: "Dictation was cancelled.",
};

/**
 * Browser dictation, with its failures made visible.
 *
 * Every way this can fail — no Speech API, blocked permission, no microphone,
 * an insecure origin — previously produced the same symptom: the button did
 * nothing at all and said nothing about why. Each one now returns a `notice`
 * the caller can render.
 *
 * @param onTranscript called with the final text once the speaker stops
 * @param onInterim    called as the text builds, so the input can fill live
 */
export function useDictation(
  onTranscript: (text: string) => void,
  onInterim?: (text: string) => void,
): Dictation {
  const [listening, setListening] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [lang, setLang] = React.useState<DictationLang>("en-US");

  const recognitionRef = React.useRef<any>(null);
  const onTranscriptRef = React.useRef(onTranscript);
  const onInterimRef = React.useRef(onInterim);

  // Kept in refs so a re-render never leaves the live recogniser calling a
  // stale closure.
  onTranscriptRef.current = onTranscript;
  onInterimRef.current = onInterim;

  const supported =
    typeof window !== "undefined" &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Release the microphone if the component goes away mid-sentence.
  React.useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // Already gone.
      }
    },
    [],
  );

  const toggle = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        setListening(false);
      }
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice("Dictation needs Chrome, Edge or Safari. You can still type your question.");
      return;
    }

    // The Speech API refuses on an insecure origin and reports it only to the
    // console, which is invisible to the person clicking the button.
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setNotice("Dictation needs a secure (https) connection.");
      return;
    }

    let recognition: any;

    try {
      recognition = new SpeechRecognition();
    } catch {
      setNotice("Dictation could not start in this browser.");
      return;
    }

    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      let transcript = "";
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }

      onInterimRef.current?.(transcript);

      if (isFinal && transcript.trim()) {
        try {
          recognition.stop();
        } catch {
          // Already stopping.
        }
        onTranscriptRef.current(transcript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      setNotice(ERRORS[event?.error as string] ?? "Dictation stopped unexpectedly. You can type instead.");
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setNotice(null);
    setListening(true);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setNotice("Dictation is already running.");
    }
  };

  return {
    listening,
    notice,
    lang,
    supported,
    toggle,
    setLang: (next: DictationLang) => {
      setLang(next);
      setNotice(null);
    },
    dismissNotice: () => setNotice(null),
  };
}
