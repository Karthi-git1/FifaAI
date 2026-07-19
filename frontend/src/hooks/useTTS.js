import { useState, useEffect, useRef, useCallback } from "react";

/**
 * TTS hook with browser-gesture unlock.
 * Modern browsers require a user gesture (click/tap) before
 * speechSynthesis.speak() will actually produce audio.
 * This hook exposes `unlocked` + `unlock()` so the UI can
 * show a one-time "Tap to enable voice" button.
 */
export function useTTS(enabled) {
  const synthRef = useRef(window.speechSynthesis);
  const [unlocked, setUnlocked] = useState(false);
  const pendingRef = useRef(null); // queued text to speak after unlock
  const retryTimer = useRef(null);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      synthRef.current?.cancel();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  /**
   * Call this from a click/tap handler to satisfy the browser gesture
   * requirement. Optionally speaks a greeting immediately.
   */
  const unlock = useCallback((greetingText, lang = "en-US") => {
    if (!synthRef.current) return;
    // A silent utterance to "warm up" the engine via user gesture
    const silent = new SpeechSynthesisUtterance("");
    silent.volume = 0;
    synthRef.current.speak(silent);
    setUnlocked(true);

    // If there's pending text or a greeting, speak it now
    const textToSpeak = greetingText || pendingRef.current;
    if (textToSpeak && enabled) {
      synthRef.current.cancel();
      const utt = new SpeechSynthesisUtterance(textToSpeak);
      utt.lang = lang;
      utt.rate = 0.95;
      utt.pitch = 1.1;
      synthRef.current.speak(utt);
      pendingRef.current = null;
    }
  }, [enabled]);

  /**
   * Speak text aloud. If not yet unlocked, queues the text
   * so it can be spoken once unlock() is called.
   */
  const speak = useCallback((text, lang = "en-US") => {
    if (!enabled || !synthRef.current) return;

    if (!unlocked) {
      // Queue for after unlock
      pendingRef.current = text;
      return;
    }

    // Always cancel previous to avoid stuck utterances
    synthRef.current.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.95;
    utt.pitch = 1.1;

    // Stuck-utterance watchdog: if still speaking after 30s, cancel & retry once
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      if (synthRef.current?.speaking) {
        synthRef.current.cancel();
        // Retry once
        const retry = new SpeechSynthesisUtterance(text);
        retry.lang = lang;
        retry.rate = 0.95;
        retry.pitch = 1.1;
        synthRef.current.speak(retry);
      }
    }, 10000);

    utt.onend = () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };

    synthRef.current.speak(utt);
  }, [enabled, unlocked]);

  const cancel = useCallback(() => {
    synthRef.current?.cancel();
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  return { speak, cancel, unlocked, unlock };
}
