import { useEffect, useRef, useCallback } from "react";

/*
 * useWakeWord — always-on background listener for "Hey/Hi/Hello Pippo"
 *
 * Runs a separate SpeechRecognition instance in continuous mode.
 * When a wake phrase is detected it calls onWake() and stops itself
 * so the main mic can take over. The caller restarts it after the
 * main session ends.
 *
 * Rules:
 * - Never interferes with the main recognition session.
 * - Stops itself the moment a wake word fires.
 * - Restarts automatically after a short delay unless destroyed.
 */

const WAKE_PHRASES = ["hey pippo", "hi pippo", "hello pippo"];

export function useWakeWord({ onWake, lang = "en-US", enabled = true }) {
  const recRef     = useRef(null);
  const activeRef  = useRef(false);   // is the wake listener running?
  const pausedRef  = useRef(false);   // paused while main mic is open
  const langRef    = useRef(lang);
  const onWakeRef  = useRef(onWake);
  const restartRef = useRef(null);

  useEffect(() => { langRef.current  = lang;    }, [lang]);
  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);

  const startWakeListener = useCallback(() => {
    if (!enabled) return;
    if (pausedRef.current) return;
    if (activeRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Abort any old instance first
    try { recRef.current?.abort(); } catch (_) { /* ignore */ }

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;
    rec.lang            = langRef.current;

    rec.onstart = () => {
      activeRef.current = true;
      console.log("[WakeWord] Wake word listener active.");
    };

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript.toLowerCase().trim();
        const matched = WAKE_PHRASES.some(phrase => transcript.includes(phrase));
        if (matched) {
          console.log("[WakeWord] Wake word detected:", transcript);
          // Stop wake listener — main mic takes over
          activeRef.current = false;
          try { rec.abort(); } catch (_) { /* ignore */ }
          onWakeRef.current?.();
          return;
        }
      }
    };

    rec.onerror = (e) => {
      activeRef.current = false;
      if (e.error === "aborted") return; // intentional stop
      console.warn("[WakeWord] Error:", e.error);
      // Auto-restart after brief pause on recoverable errors
      if (e.error === "no-speech" || e.error === "network") {
        scheduleRestart();
      }
    };

    rec.onend = () => {
      activeRef.current = false;
      if (!pausedRef.current) {
        scheduleRestart();
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.warn("[WakeWord] Could not start:", err.message);
      activeRef.current = false;
    }
  }, [enabled]); // eslint-disable-line

  const scheduleRestart = useCallback(() => {
    if (restartRef.current) clearTimeout(restartRef.current);
    restartRef.current = setTimeout(() => {
      if (!pausedRef.current) startWakeListener();
    }, 1500);
  }, [startWakeListener]);

  // Pause wake listener while main mic is active (call from NavigationScreen)
  const pause = useCallback(() => {
    pausedRef.current = true;
    activeRef.current = false;
    if (restartRef.current) clearTimeout(restartRef.current);
    try { recRef.current?.abort(); } catch (_) { /* ignore */ }
    console.log("[WakeWord] Paused (main mic active).");
  }, []);

  // Resume wake listener after main mic session ends
  const resume = useCallback(() => {
    pausedRef.current = false;
    console.log("[WakeWord] Resuming after main mic.");
    scheduleRestart();
  }, [scheduleRestart]);

  // Start on mount
  useEffect(() => {
    if (enabled) startWakeListener();
    return () => {
      pausedRef.current = true;
      if (restartRef.current) clearTimeout(restartRef.current);
      try { recRef.current?.abort(); } catch (_) { /* ignore */ }
    };
  }, [enabled, startWakeListener]);

  return { pause, resume };
}
