import { useState, useRef, useCallback, useEffect } from "react";

/*
 * useVoiceInput — fixed Speech Recognition hook
 *
 * Root causes fixed:
 * 1. SpeechRecognition instance is created ONCE and stored in a stable ref.
 *    It is never recreated on re-render so no stale-instance race conditions.
 * 2. onResult callback is stored in a ref so the recognition handler always
 *    calls the LATEST version without needing to re-attach event listeners.
 * 3. interim results are enabled so text appears in the input box in real-time.
 * 4. lang updates are applied to the existing instance without recreation.
 * 5. Proper error / end handling so the mic state never gets stuck.
 */
export function useVoiceInput({ onResult, onInterim, onError, lang = "en-US" }) {
  const [listening, setListening]   = useState(false);
  const [supported, setSupported]   = useState(false);

  // Stable refs — never trigger re-creation of the recognition instance
  const recRef       = useRef(null);
  const onResultRef  = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef   = useRef(onError);
  const langRef      = useRef(lang);

  // Keep callback refs fresh on every render — no need to recreate recognition
  useEffect(() => { onResultRef.current  = onResult;  }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current   = onError;   }, [onError]);

  // Update lang on the existing instance when it changes
  useEffect(() => {
    langRef.current = lang;
    if (recRef.current) recRef.current.lang = lang;
  }, [lang]);

  // Create recognition instance ONCE on mount
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn("[VoiceInput] SpeechRecognition not supported in this browser.");
      setSupported(false);
      return;
    }
    console.log("[VoiceInput] SpeechRecognition supported — initializing.");
    setSupported(true);

    const rec = new SR();
    rec.continuous      = false;   // one utterance per press (wake word uses its own instance)
    rec.interimResults  = true;    // stream partial results into the input box
    rec.maxAlternatives = 1;
    rec.lang            = langRef.current;

    rec.onstart = () => {
      console.log("[VoiceInput] Recognition started — mic is open.");
      setListening(true);
    };

    rec.onspeechstart = () => {
      console.log("[VoiceInput] Speech detected.");
    };

    rec.onresult = (e) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      if (interim) {
        console.log("[VoiceInput] Interim:", interim);
        onInterimRef.current?.(interim);
      }
      if (final) {
        console.log("[VoiceInput] Final transcript:", final);
        onResultRef.current?.(final.trim());
      }
    };

    rec.onerror = (e) => {
      console.error("[VoiceInput] Recognition error:", e.error);
      setListening(false);
      // Don't surface no-speech or aborted — those are normal
      if (e.error !== "no-speech" && e.error !== "aborted") {
        onErrorRef.current?.(e.error);
      }
    };

    rec.onend = () => {
      console.log("[VoiceInput] Recognition ended.");
      setListening(false);
    };

    recRef.current = rec;

    return () => {
      try { rec.abort(); } catch (_) { /* ignore */ }
    };
  }, []); // ← empty deps: create ONCE, never recreate

  const start = useCallback(() => {
    if (!recRef.current) {
      console.warn("[VoiceInput] start() called but recognition not initialized.");
      return;
    }
    if (listening) {
      console.log("[VoiceInput] Already listening — ignoring start().");
      return;
    }
    try {
      recRef.current.lang = langRef.current;
      recRef.current.start();
      console.log("[VoiceInput] start() called.");
    } catch (err) {
      console.error("[VoiceInput] start() error:", err.message);
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try {
      recRef.current.stop();
      console.log("[VoiceInput] stop() called.");
    } catch (err) {
      console.error("[VoiceInput] stop() error:", err.message);
    }
  }, []);

  return { listening, start, stop, supported };
}
