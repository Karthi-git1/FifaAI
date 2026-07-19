import { useState, useRef, useEffect, useCallback } from "react";
import { G, T } from "../theme";
import { useTTS } from "../hooks/useTTS";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useWakeWord } from "../hooks/useWakeWord";
import logo from "../assets/logo.png";
import Pippo2 from "../assets/Pippo2.png";
import Pippo3 from "../assets/Pippo3.png";
import Pippo4 from "../assets/Pippo4.png";

const API =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const LANG_CODE = {
  "English": "en-US", "Español": "es-ES", "Français": "fr-FR",
  "Deutsch": "de-DE", "Português": "pt-BR", "العربية": "ar-SA",
  "日本語": "ja-JP", "हिन्दी": "hi-IN", "தமிழ்": "ta-IN",
  "Italiano": "it-IT", "Nederlands": "nl-NL", "한국어": "ko-KR",
  "中文": "zh-CN", "Türkçe": "tr-TR", "Polski": "pl-PL",
  "Svenska": "sv-SE", "Русский": "ru-RU",
};

const FAN_CHIPS = [
  { label: "Find my seat",       icon: "📍", prompt: (p) => `Where is my seat? I'm in ${p.seat || "the stadium"}.` },
  { label: "Nearest exit",       icon: "🚶", prompt: (p) => `Where's the nearest exit from ${p.seat || "my location"}?` },
  { label: "Accessible route",   icon: "♿", prompt: (p) => `Show me a step-free accessible route to ${p.seat || "my seat"}.${p.accessibility ? " My need: "+p.accessibility : ""}` },
  { label: "Food & drinks",      icon: "🍔", prompt: () => "Where is the nearest food or drink stand? Tell me which is less crowded." },
  { label: "My gate wait",       icon: "🚪", prompt: (p) => `What's the current crowd wait at my gate? I'm in ${p.seat || "the stadium"}.` },
  { label: "Transport home",     icon: "🚌", prompt: () => "What's the best transport option to leave the stadium after the match?" },
  { label: "Nearest toilets",    icon: "🚻", prompt: () => "Where is the nearest toilet or restroom from my current location?" },
  { label: "Sustainability tip", icon: "🌿", prompt: () => "Give me a quick eco-friendly tip for my stadium visit today." },
];

function PippoAvatar({ state, showRing = false, hasAlert = false }) {
  const src = state === "listening" ? Pippo2
            : state === "thinking"  ? Pippo3
            : state === "happy"     ? Pippo4
            : logo;

  // Status ring colour logic:
  // red    → gate alert active (fan needs attention)
  // gold   → thinking / processing
  // gold   → listening (already has ripple rings, ring doubles up nicely)
  // emerald → happy / just answered
  // mint    → idle / online
  const ringColor = hasAlert          ? T.red
                  : state === "thinking"  ? T.gold
                  : state === "listening" ? T.gold
                  : state === "happy"     ? T.emerald
                  : T.mint;

  const ringAnim  = state === "thinking"  ? "breathe 1.5s ease-in-out infinite"
                  : state === "listening" ? "none"   // ripple rings handle it
                  : hasAlert              ? "sosGlow 2s ease-in-out infinite"
                  : "none";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Status ring — only on header avatar */}
      {showRing && (
        <div style={{
          position: "absolute",
          inset: -4,
          borderRadius: "50%",
          border: `2.5px solid ${ringColor}`,
          boxShadow: `0 0 8px ${ringColor}70, inset 0 0 4px ${ringColor}20`,
          animation: ringAnim,
          transition: "border-color 0.4s ease, box-shadow 0.4s ease",
          pointerEvents: "none",
          zIndex: 1,
        }} />
      )}

      {/* Online dot — bottom-right corner, only on header */}
      {showRing && (
        <div style={{
          position: "absolute",
          bottom: 0, right: 0,
          width: 11, height: 11,
          borderRadius: "50%",
          background: ringColor,
          border: `2px solid ${T.bg}`,
          boxShadow: `0 0 6px ${ringColor}`,
          zIndex: 2,
          transition: "background 0.4s ease",
          animation: state === "thinking" || hasAlert ? "blink 1.2s ease infinite" : "none",
        }} />
      )}

      <img
        src={src}
        alt="Pippo AI"
        style={{
          width: 52, height: 52,
          objectFit: "contain",
          filter: state === "thinking"
            ? `drop-shadow(0 0 16px ${T.gold})`
            : state === "happy"
              ? `drop-shadow(0 0 14px ${T.emerald}60)`
              : "drop-shadow(0 0 10px rgba(91,63,217,0.4))",
          transition: "all 0.3s ease",
          animation: state === "thinking" ? "breathe 1.5s ease-in-out infinite" :
                     state === "happy"    ? "quickBounce 0.6s ease" :
                     state === "idle"     ? "breathe 3s ease-in-out infinite" : "none",
          position: "relative", zIndex: 0,
        }}
      />

      {/* Listening ripple rings */}
      {state === "listening" && (
        <>
          <div style={{
            position: "absolute", inset: -6,
            borderRadius: "50%",
            border: `2px solid ${T.gold}`,
            animation: "ripple 1.2s ease-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: -14,
            borderRadius: "50%",
            border: `2px solid ${T.gold}60`,
            animation: "ripple 1.2s ease-out infinite 0.4s",
          }} />
        </>
      )}
    </div>
  );
}

function CrowdBadge({ level, wait, gate }) {
  // Only show wait time if we have a real numeric value, otherwise show status
  const hasWait = wait && wait !== "Live" && wait !== "…" && !wait.includes("Calculating");
  const statusColor = level === "high"     ? T.red
                    : level === "moderate" ? T.amber
                    : level === "offline"  ? T.offline
                    : T.mint;  // mint for live/open — clearly distinct from surface greens
  const statusLabel = level === "offline" ? "Offline"
                    : level === "loading"  ? "Connecting…"
                    : hasWait             ? `Wait: ${wait}`
                    : "Open";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderRadius: 12,
      background: T.card, border: `1px solid ${T.borderSolid}`,
      borderLeft: `4px solid ${statusColor}`,
      fontSize: 12, marginBottom: 10,
      boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: statusColor,
          display: "inline-block",
          boxShadow: `0 0 8px ${statusColor}`,
          animation: level !== "offline" && level !== "loading" ? "blink 2s ease infinite" : "none",
        }} />
        <strong style={{ color: T.text, fontSize: 13 }}>{gate}</strong>
        <span style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>· Live</span>
      </span>
      <span style={{
        color: statusColor, fontWeight: 700, fontSize: 12,
        background: `${statusColor}18`, padding: "3px 10px", borderRadius: 20,
        border: `1px solid ${statusColor}35`,
      }}>{statusLabel}</span>
    </div>
  );
}

function StadiumMap({ highlightGate, liveData }) {
  if (!highlightGate && !liveData) return null;

  const g = highlightGate ? highlightGate.toUpperCase() : "";

  const getGateLevel = (gateCode) => {
    if (!liveData || !liveData.gates) return null;
    const gateInfo = liveData.gates[`Gate ${gateCode}`];
    return gateInfo ? gateInfo.level : null;
  };

  const getStyle = (target) => {
    const level = getGateLevel(target);
    let baseColor = T.borderSolid;
    let baseFill = T.card2;

    if (level === "low") { baseColor = T.emerald; baseFill = `${T.emerald}22`; }
    else if (level === "moderate") { baseColor = T.gold; baseFill = `${T.gold}22`; }
    else if (level === "high") { baseColor = "#FF5555"; baseFill = "#FF555522"; }

    const isHighlighted = g.includes(target);
    return {
      fill: isHighlighted ? `${T.gold}44` : baseFill,
      stroke: isHighlighted ? T.gold : baseColor,
      strokeWidth: isHighlighted ? 2.5 : (level ? 1.5 : 1),
      filter: isHighlighted ? `drop-shadow(0 0 6px ${T.gold}90)` : "none",
      transition: "all 0.5s ease",
      animation: isHighlighted ? "pulseRing 2s ease-in-out infinite" : "none",
    };
  };

  return (
    <div style={{
      marginTop: 12, padding: 12,
      background: G.pitch,
      borderRadius: 16, border: `1px solid ${T.border}`,
      boxShadow: `inset 0 0 32px rgba(0,0,0,0.4)`,
      animation: "mapReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      overflow: "hidden",
      transformOrigin: "top",
    }}>
      <div style={{
        fontSize: 11, color: T.muted, marginBottom: 8,
        textAlign: "center", textTransform: "uppercase", letterSpacing: 1.5,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.teal, display: "inline-block", animation: "blink 1.5s infinite" }} />
        Live Stadium Map
      </div>
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: 164 }}>
        {/* Pitch background */}
        <rect x="58" y="38" width="84" height="124" rx="12" fill="#0D2B1A" stroke="#1E4D32" strokeWidth="1.5" />
        {/* Centre line */}
        <line x1="58" y1="100" x2="142" y2="100" stroke="#1E4D32" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Centre circle */}
        <circle cx="100" cy="100" r="14" fill="none" stroke="#1E4D32" strokeWidth="1.5" />
        {/* Centre spot */}
        <circle cx="100" cy="100" r="2" fill="#1E4D32" />
        {/* Penalty arcs */}
        <path d="M75,50 Q100,60 125,50" fill="none" stroke="#1E4D32" strokeWidth="1" />
        <path d="M75,150 Q100,140 125,150" fill="none" stroke="#1E4D32" strokeWidth="1" />

        {/* Gate A (Top) */}
        <rect x="72" y="10" width="56" height="22" rx="7" {...getStyle("A")} />
        <text x="100" y="21" fill={g.includes("A") ? T.gold : T.muted}
          fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle" letterSpacing="1">GATE A</text>

        {/* Gate B (Right) */}
        <rect x="152" y="72" width="22" height="56" rx="7" {...getStyle("B")} />
        <text x="163" y="100" fill={g.includes("B") ? T.gold : T.muted}
          fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
          transform="rotate(90, 163, 100)" letterSpacing="1">GATE B</text>

        {/* Gate C (Bottom) */}
        <rect x="72" y="168" width="56" height="22" rx="7" {...getStyle("C")} />
        <text x="100" y="179" fill={g.includes("C") ? T.gold : T.muted}
          fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle" letterSpacing="1">GATE C</text>

        {/* Gate D (Left) */}
        <rect x="26" y="72" width="22" height="56" rx="7" {...getStyle("D")} />
        <text x="37" y="100" fill={g.includes("D") ? T.gold : T.muted}
          fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
          transform="rotate(-90, 37, 100)" letterSpacing="1">GATE D</text>
      </svg>
    </div>
  );
}

/* Format a timestamp as "just now", "2 min ago", "10:45 AM" etc. */
function formatTime(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)  return "just now";
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 120) return "1 min ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg, isAccessible, onSpeak, liveData, profile }) {
  const isUser = msg.from === "user";
  const isDivider = msg.from === "divider";

  if (isDivider) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 0", animation: "slideUp 0.3s ease",
      }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{
          fontSize: 11, color: T.muted, textTransform: "uppercase",
          letterSpacing: 1.5, whiteSpace: "nowrap",
          padding: "4px 12px", borderRadius: 20,
          background: `${T.card2}`,
          border: `1px solid ${T.border}`,
        }}>{msg.text}</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
    );
  }

  const mapMatch = msg.text.match(/\[MAP_TARGET:\s*(Gate\s*[A-D])\]/i);
  const mapTarget = mapMatch ? mapMatch[1] : null;
  const waitMatch = msg.text.match(/\[WAIT:\s*(Gate\s*[A-D]),\s*(.*?)\]/i);
  const waitGate = waitMatch ? waitMatch[1] : null;
  const waitTime = waitMatch ? waitMatch[2] : null;
  let cleanText = msg.text.replace(/\[MAP_TARGET:\s*(Gate\s*[A-D])\]/ig, "").trim();
  cleanText = cleanText.replace(/\[WAIT:\s*(Gate\s*[A-D]),\s*(.*?)\]/ig, "").trim();

  // Detect emergency messages (SOS button tap or urgent query)
  const isEmergency = !isUser && (
    msg.text.includes("🆘") ||
    /emergency|first aid|security|exit|sos/i.test(msg.text.slice(0, 120))
  );

  // Parse markdown **bold** and *italic* into React spans
  function renderMarkdown(text) {
    const lines = text.split("\n");
    return lines.map((line, li) => {
      // Split on **bold** and *italic* patterns
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      const rendered = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      });
      return (
        <span key={li}>
          {rendered}
          {li < lines.length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 12,
      animation: "slideUp 0.3s ease",
    }}>
      {!isUser && (
        <div style={{ flexShrink: 0, marginBottom: 18 }}>
          <PippoAvatar state="idle" />
        </div>
      )}
      {isUser && (
        <div style={{
          flexShrink: 0, marginBottom: 18,
          width: 38, height: 38, borderRadius: "50%",
          background: `linear-gradient(135deg, ${T.mint}, ${T.emerald})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800, fontSize: 16,
          color: T.emeraldText,
          boxShadow: `0 0 12px ${T.mint}50`,
          border: `2px solid ${T.emerald}60`,
          flexDirection: "column",
          userSelect: "none",
        }}>
          {(profile?.name?.[0] || "U").toUpperCase()}
        </div>
      )}

      {/* Bubble + timestamp stacked */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        maxWidth: "80%",
      }}>
      <div style={{
        width: "100%",
        minWidth: isUser ? 32 : "auto",
        padding: isAccessible ? "16px 20px" : (isUser ? "10px 16px" : "14px 18px"),
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",

        // Emergency bubble: red-tinted card with red left border
        background: isEmergency
          ? "linear-gradient(135deg, rgba(180,20,30,0.22) 0%, rgba(10,20,16,0.95) 100%)"
          : isUser ? G.userBubble : T.card,

        border: isEmergency
          ? "1px solid rgba(220,50,50,0.6)"
          : isUser ? `1px solid ${T.gold}40` : `1px solid ${T.border}`,

        borderLeft: isEmergency ? "4px solid #FF3333" : undefined,

        fontSize: isAccessible ? 16 : (isEmergency ? 14 : 14),
        fontWeight: isUser ? 600 : 400,
        fontFamily: isUser ? "'Outfit', sans-serif" : "'Inter', sans-serif",
        lineHeight: 1.65,

        // Emergency text: always near-white for maximum readability
        color: isEmergency ? "#FFFFFF" : isUser ? T.emeraldText : T.text,

        whiteSpace: "pre-wrap",
        boxShadow: isEmergency
          ? "0 4px 24px rgba(220,50,50,0.25), 0 2px 8px rgba(0,0,0,0.4)"
          : isUser ? `0 4px 18px ${T.gold}30` : `0 2px 8px rgba(0,0,0,0.3)`,
      }}>
        {/* Emergency header strip */}
        {isEmergency && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: "1px solid rgba(255,80,80,0.3)",
          }}>
            <span style={{ fontSize: 16 }}>🆘</span>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
              textTransform: "uppercase", color: "#FF6666",
            }}>Emergency Response</span>
          </div>
        )}

        {/* Render markdown for all AI messages */}
        {isUser ? cleanText : renderMarkdown(cleanText)}

        {waitGate && !isUser && (
           <div style={{
             marginTop: 12, padding: "8px 14px", borderRadius: 12,
             background: `linear-gradient(135deg, ${T.bg2}, ${T.card})`,
             border: `1px solid ${T.amber}60`,
             display: "inline-flex", alignItems: "center", gap: 10,
             fontSize: 13, fontWeight: 600, color: T.text,
             animation: "slideUp 0.4s ease",
             boxShadow: `0 4px 12px rgba(0,0,0,0.3)`
           }}>
             <span style={{color: T.amber, fontSize: 16}}>⏳</span>
             <span>{waitGate}</span>
             <span style={{color: T.muted}}>•</span>
             <span style={{color: T.gold}}>{waitTime} wait</span>
           </div>
        )}
        {mapTarget && !isUser && <StadiumMap highlightGate={mapTarget} liveData={liveData} />}
        {!isUser && isAccessible && (
          <button
            onClick={() => onSpeak(msg.text)}
            title="Listen"
            style={{
              marginTop: 8, display: "block",
              background: `${T.a11y}22`, border: `1px solid ${T.a11y}`,
              borderRadius: 8, padding: "4px 12px",
              color: T.a11y, cursor: "pointer", fontSize: 12,
            }}>
            🔊 Listen
          </button>
        )}
      </div>
      {/* Timestamp */}
      {msg.ts && !isDivider && (
        <div style={{
          fontSize: 10, color: T.muted,
          marginTop: 4, paddingBottom: 2,
          textAlign: isUser ? "right" : "left",
          opacity: 0.7,
          letterSpacing: 0.3,
        }}>
          {formatTime(msg.ts)}
        </div>
      )}
      </div>{/* end column wrapper */}
    </div>
  );
}

/* ── Confirmation Modal ── */
function ConfirmModal({ title, message, icon, confirmLabel, cancelLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: T.card2,
        border: `1px solid ${T.border}`,
        borderRadius: 20, padding: "28px 24px 20px",
        maxWidth: 340, width: "90%",
        textAlign: "center",
        boxShadow: "0 12px 48px #000A",
        animation: "slideUp 0.3s ease",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
        <h3 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 18, fontWeight: 700,
          marginBottom: 8, color: T.text,
        }}>{title}</h3>
        <p style={{
          fontSize: 13, color: T.muted,
          lineHeight: 1.5, marginBottom: 24,
        }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: "transparent", color: T.muted,
              cursor: "pointer", fontSize: 14, fontWeight: 500,
              transition: "all 0.2s",
            }}
          >{cancelLabel || "Cancel"}</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12,
              border: "none",
              background: confirmColor || T.violet,
              color: "#fff", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              transition: "all 0.2s",
              boxShadow: `0 4px 16px ${confirmColor || T.violet}40`,
            }}
          >{confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── TTS Unlock Overlay ── */
function TTSUnlockBanner({ onUnlock }) {
  return (
    <div
      onClick={onUnlock}
      style={{
        margin: "0 16px 10px",
        padding: "14px 20px",
        borderRadius: 14,
        background: T.card,
        border: `1px solid ${T.borderSolid}`,
        borderLeft: `4px solid ${T.a11y}`,
        boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 14,
        animation: "slideUp 0.4s ease, glow 2s ease infinite",
        transition: "all 0.2s",
      }}
    >
      <span style={{
        fontSize: 28,
        animation: "float 1.5s ease infinite",
      }}>🔊</span>
      <div>
        <div style={{
          fontSize: 14, fontWeight: 600, color: T.text,
          marginBottom: 2,
        }}>Tap to enable Pippo's voice</div>
        <div style={{
          fontSize: 11, color: T.muted,
        }}>Responses will be read aloud for you</div>
      </div>
      <span style={{
        marginLeft: "auto", fontSize: 18, color: T.teal,
      }}>→</span>
    </div>
  );
}

export default function NavigationScreen({ profile, onReset, updateProfile }) {
  const isAccessible = profile.accessibility === "Visual" || profile.highContrast;
  const langCode     = LANG_CODE[profile.language] || "en-US";

  const { speak, unlocked, unlock } = useTTS(isAccessible || profile.accessibility === "Visual");

  const greeting = profile.name
    ? `Hi ${profile.name}${profile.team ? ` — go ${profile.team}!` : ""}! `
    : "Welcome! ";
  const intro = greeting + `I'm Pippo — just ask me anything about the stadium, in ${profile.language}.`;

  const [messages, setMessages] = useState([{ from: "ai", text: intro, id: 0, ts: Date.now() }]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [pippoState,     setPippoState]     = useState("idle");
  const [gateStatus,     setGateStatus]     = useState({ gate: profile.gate || "Stadium", wait: "…", level: "loading" });
  const [liveData,       setLiveData]       = useState(null);
  const [matchPhase,     setMatchPhase]     = useState("pre_match");
  const [showMenu,       setShowMenu]       = useState(false);
  const [isMuted,        setIsMuted]        = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  const fanGate = profile.gate?.match(/gate [a-e]/i)?.[0] || profile.gate || "";

  // TTS for accessibility — auto-speak AI messages
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.from === "ai" && isAccessible && !isMuted) {
      console.log("[TTS] Speaking AI response.");
      setPippoState("happy");
      speak(last.text, langCode);
      setTimeout(() => setPippoState("idle"), 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchLive = useCallback(async () => {
    try {
      const r = await fetch(`${API}/live?profile_gate=${encodeURIComponent(fanGate)}`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.gate) {
        setGateStatus({ gate: d.gate, wait: d.wait_minutes != null ? `${d.wait_minutes} min` : "Calculating…", level: d.level });
      } else {
        setGateStatus({ gate: "Stadium", wait: "Live", level: "online" });
      }
      setLiveData(d.full || null);
      setMatchPhase(d.full?.match_phase || "pre_match");
    } catch {
      setGateStatus(g => ({ ...g, level: "offline" }));
    }
  }, [fanGate]);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 20000);
    return () => clearInterval(id);
  }, [fetchLive]);

  // ── Voice input ──────────────────────────────────────────────────────────
  //
  // Key fixes vs old code:
  // 1. sendRef holds the latest `send` so voice callbacks never use a stale closure.
  // 2. onInterim writes to the input box in real-time as you speak.
  // 3. onVoiceResult puts the final text in the input AND auto-sends it.
  // 4. Wake word listener is paused while main mic is open, resumed when it closes.

  const sendRef = useRef(null); // always points to latest send()

  const onInterim = useCallback((text) => {
    // Show partial speech in the input box as the user speaks
    setInput(text);
  }, []);

  const onVoiceResult = useCallback((text) => {
    console.log("[Voice] Final result received:", text);
    setPippoState("idle");
    setInput(text);               // put text in input box
    // Use the ref so we always call the latest send, not a stale closure
    sendRef.current?.(text);
  }, []);

  const onVoiceError = useCallback((err) => {
    console.error("[Voice] Error:", err);
    setPippoState("idle");
  }, []);

  const { listening, start: startListening, stop: stopListening, supported: voiceSupported }
    = useVoiceInput({ onResult: onVoiceResult, onInterim, onError: onVoiceError, lang: langCode });

  // Wake word: fires when user says "Hey/Hi/Hello Pippo"
  const onWake = useCallback(() => {
    console.log("[WakeWord] Triggered — starting main mic.");
    setPippoState("listening");
    // Speak the acknowledgement then start listening
    speak("Hi! I'm listening.", langCode);
    // Small delay so TTS doesn't overlap with mic start
    setTimeout(() => {
      startListening();
    }, 800);
  }, [speak, langCode, startListening]);

  const { pause: pauseWake, resume: resumeWake } = useWakeWord({
    onWake,
    lang: langCode,
    enabled: voiceSupported,
  });

  // Pause wake listener while main mic is active; resume when it closes
  useEffect(() => {
    if (listening) {
      pauseWake();
      setPippoState("listening");
    } else {
      if (pippoState === "listening") setPippoState("idle");
      resumeWake();
    }
  }, [listening]); // eslint-disable-line

  async function send(text) {
    if (!text?.trim() || loading) return;
    const userText = text.trim();
    console.log("[Send] Sending message:", userText);

    setMessages(m => [...m, { from: "user", text: userText, id: Date.now(), ts: Date.now() }]);
    setInput("");
    setLoading(true);
    setPippoState("thinking");

    const history = messages.slice(1)
      .filter(m => m.from !== "divider") // exclude dividers from API history
      .map(m => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text,
      }));

    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userText,
          profile: profile,
          history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      console.log("[AI] Response received.");
      setMessages(m => [...m, { from: "ai", text: data.answer, id: Date.now() + 1, ts: Date.now() }]);
      setPippoState("happy");
      setTimeout(() => setPippoState("idle"), 2500);
    } catch (err) {
      setMessages(m => [...m, {
        from: "ai",
        text: `⚠️ Couldn't reach Pippo's brain. Make sure the backend is running and GROQ_API_KEY is set.\n\n${err.message}`,
        id: Date.now() + 2,
        ts: Date.now(),
      }]);
      setPippoState("idle");
    } finally {
      setLoading(false);
    }
  }

  // Keep sendRef current so voice callbacks always call the latest send
  sendRef.current = send;

  const chips = FAN_CHIPS;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: G.pitch,
      fontFamily: "'Inter', sans-serif",
      color: isAccessible ? "#FFFFFF" : T.text,
      fontSize: isAccessible ? 16 : 14,
      display: "flex",
      justifyContent: "center",
    }}>
      <div style={{ 
        margin: "0 auto",
        width: "100%",
        maxWidth: 540,
        height: "100vh",
        background: T.bg, 
        boxShadow: "0 0 64px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}>

        {/* ── Live Match Ticker ── */}
        {liveData?.match && (() => {
          const m = liveData.match;
          const isLate   = m.minute != null && m.minute >= 80;
          const isHalf   = m.phase === "halftime";
          const isFinished = m.phase === "full_time" || m.phase === "ft";
          const minuteColor = isLate ? T.red : T.gold;
          const phaseLabel  = isFinished ? "FT"
                            : isHalf     ? "HT"
                            : m.minute != null ? `${m.minute}'` : "";
          return (
            <div style={{
              background: `linear-gradient(90deg, ${T.card2} 0%, ${T.bg2} 100%)`,
              borderBottom: `1px solid ${T.border}`,
              padding: "5px 20px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              position: "relative", overflow: "hidden",
            }}>
              {/* Pulsing LIVE dot */}
              {!isFinished && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: isLate ? T.red : T.emerald,
                    display: "inline-block",
                    boxShadow: `0 0 6px ${isLate ? T.red : T.emerald}`,
                    animation: "blink 1.2s ease infinite",
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: isLate ? T.red : T.emerald,
                  }}>LIVE</span>
                </span>
              )}

              {/* Home team */}
              <span style={{
                fontSize: 13, fontWeight: 700, color: T.text,
                letterSpacing: 0.5,
              }}>{m.home_team ?? "HOME"}</span>

              {/* Score */}
              <span style={{
                fontSize: 16, fontWeight: 900,
                color: T.gold,
                padding: "2px 10px",
                background: "rgba(245,158,11,0.12)",
                borderRadius: 8,
                border: "1px solid rgba(245,158,11,0.25)",
                letterSpacing: 1,
                fontFamily: "'Outfit', monospace",
              }}>
                {m.home_score ?? 0} – {m.away_score ?? 0}
              </span>

              {/* Away team */}
              <span style={{
                fontSize: 13, fontWeight: 700, color: T.text,
                letterSpacing: 0.5,
              }}>{m.away_team ?? "AWAY"}</span>

              {/* Minute / phase badge */}
              {phaseLabel && (
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: minuteColor,
                  background: `rgba(${isLate ? "239,68,68" : "245,158,11"},0.12)`,
                  border: `1px solid ${minuteColor}40`,
                  padding: "2px 8px", borderRadius: 6,
                  animation: isLate ? "blink 2s ease infinite" : "none",
                  fontFamily: "'Outfit', monospace",
                }}>{phaseLabel}</span>
              )}

              {/* Event name — subtle, right-aligned */}
              {m.event && (
                <span style={{
                  position: "absolute", right: 12,
                  fontSize: 9, color: T.muted, fontWeight: 400,
                  textOverflow: "ellipsis", overflow: "hidden",
                  whiteSpace: "nowrap", maxWidth: 100,
                }}>{m.event}</span>
              )}
            </div>
          );
        })()}

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 16,
          background: `linear-gradient(180deg, ${T.bg2} 0%, transparent 100%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PippoAvatar state={pippoState} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 800, fontSize: 18, lineHeight: 1.1,
                  background: G.gold,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundSize: "200% auto",
                  animation: "shimmer 3s linear infinite",
                }}>Pippo</div>
              </div>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                FIFA 2026 AI
              </div>
            </div>
          </div>

          {/* Right: Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Accessibility Icon */}
            {isAccessible && (
              <div 
                title={unlocked ? "Responses are being read aloud" : "Tap TTS banner to enable voice"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 8,
                  background: `${T.gold}18`, border: `1px solid ${T.gold}50`,
                  color: T.gold, fontSize: 18, cursor: "help"
                }}>
                👁️
              </div>
            )}

            {/* Language Switcher */}
            <select
              value={profile.language}
              onChange={(e) => updateProfile({ language: e.target.value })}
              style={{
                background: T.card, border: `1px solid ${T.border}`,
                color: T.text, padding: "6px 8px", borderRadius: 8,
                fontSize: 13, outline: "none", cursor: "pointer",
                boxShadow: `0 2px 8px rgba(0,0,0,0.2)`
              }}
              title="Change Language"
            >
              {Object.keys(LANG_CODE).map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>

            {/* Menu — wrapper is position:relative so dropdown anchors to it */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowMenu(m => !m)}
                style={{
                  width: 36, height: 36,
                  background: showMenu ? `${T.card2}` : "none",
                  border: showMenu ? `1px solid ${T.border}` : "none",
                  borderRadius: 8,
                  color: T.muted, cursor: "pointer", fontSize: 20,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}
                aria-label="Settings"
              >⋮</button>

              {/* Dropdown anchored under the ⋮ button */}
              {showMenu && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: G.glass,
                  backdropFilter: "blur(16px)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 14, padding: "6px 0",
                  zIndex: 100, minWidth: 200,
                  animation: "popIn 0.2s ease",
                  boxShadow: `0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
                }}>
                  {[
                    { label: isAccessible ? "❌ Disable TTS" : "♿ Enable TTS", action: () => { setShowMenu(false); updateProfile({ accessibility: isAccessible ? "" : "Visual" }); } },
                    { label: "🔄 Reset Profile", action: () => { setShowMenu(false); onReset?.(); } },
                    { label: isMuted ? "🔊 Unmute Pippo" : "🔇 Mute Pippo", action: () => { setShowMenu(false); setIsMuted(!isMuted); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{
                      display: "block", width: "100%", padding: "11px 20px",
                      background: "none", border: "none",
                      color: T.text, cursor: "pointer", textAlign: "left",
                      fontSize: 14, transition: "background 0.15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = T.card}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >{item.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* ── TTS unlock banner (accessibility mode) ── */}
        {isAccessible && !unlocked && (
          <TTSUnlockBanner onUnlock={() => unlock(intro, langCode)} />
        )}

        {/* ── Live crowd strip ── */}
        <div style={{ padding: "0 16px", marginBottom: 4 }}>
          <CrowdBadge
            gate={gateStatus.gate}
            wait={gateStatus.wait}
            level={gateStatus.level}
          />
        </div>



        {/* ── Quick chips (Scrollable Row) ── */}
        <div style={{ position: "relative" }}>
          <div style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            gap: 12,
            padding: "8px 24px 16px",
            scrollbarWidth: "none", // hide scrollbar Firefox
            msOverflowStyle: "none", // hide scrollbar IE/Edge
          }}>
            {chips.map(c => (
              <button
                key={c.label}
                onClick={() => send(c.prompt(profile))}
                style={{
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 30,
                  border: `1px solid ${T.emerald}40`,
                  background: G.chip,
                  color: T.emerald, cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: `0 2px 8px rgba(0,0,0,0.2)`,
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${T.emerald}30`;
                  e.currentTarget.style.borderColor = T.emerald;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = G.chip;
                  e.currentTarget.style.borderColor = `${T.emerald}40`;
                }}
              >
                <span style={{ fontSize: 16, color: "transparent", textShadow: `0 0 0 ${T.emerald}` }}>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          {/* Fade mask for scroll hint */}
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 16, width: 40,
            background: `linear-gradient(to right, transparent, ${T.bg})`, pointerEvents: "none"
          }} />
        </div>

        {/* ── Chat messages ── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          display: "flex", flexDirection: "column",
          gap: 24, padding: "16px 24px",
        }}>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              isAccessible={isAccessible}
              onSpeak={(text) => speak(text, langCode)}
              liveData={liveData}
              profile={profile}
            />
          ))}

          {/* Thinking indicator */}
          {loading && (
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 8,
              animation: "fadeIn 0.3s ease",
            }}>
              <PippoAvatar state="thinking" />
              <div style={{
                padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
                background: T.card, border: `1px solid ${T.border}`,
                display: "flex", gap: 6, alignItems: "center",
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: T.emerald,
                    animation: `blink 1.2s ease infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div style={{
          padding: "8px 24px 16px",
          background: `linear-gradient(0deg, ${T.bg} 70%, transparent)`,
          flexShrink: 0,
        }}>
        <div style={{ width: "100%" }}>
          {/* Voice activation hint */}
          {voiceSupported && (
            <div style={{
              textAlign: "center", fontSize: 12,
              color: T.muted, marginBottom: 8,
            }}>
              {listening
                ? <span style={{ color: T.gold, animation: "blink 0.8s infinite" }}>🎤 Pippo is listening…</span>
                : <span>Say <strong style={{ color: T.gold }}>"Hey Pippo"</strong> or tap the mic</span>
              }
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: T.card,
            border: `1px solid ${listening ? T.gold : T.border}`,
            borderRadius: 32, padding: "8px 8px 8px 24px",
            transition: "all 0.3s",
            boxShadow: listening
              ? `0 0 0 2px ${T.gold}40, 0 8px 32px rgba(0,0,0,0.5)`
              : `0 8px 24px rgba(0,0,0,0.4)`,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !listening && send(input)}
              placeholder={listening ? "Listening…" : (isAccessible ? "Type here or use the mic…" : "Ask Pippo anything…")}
              disabled={loading}
              style={{
                flex: 1, background: "transparent", border: "none",
                outline: "none", color: listening ? T.gold : T.text,
                fontSize: isAccessible ? 16 : 15,
                fontStyle: listening ? "italic" : "normal",
                transition: "color 0.2s",
              }}
            />

            {/* Send button */}
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim() || listening}
              style={{
                width: 38, height: 38,
                borderRadius: "50%", border: "none",
                background: input.trim() ? G.gold : `${T.border}80`,
                color: input.trim() ? "#021A11" : T.muted,
                cursor: input.trim() ? "pointer" : "not-allowed",
                fontSize: 16, transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: input.trim() ? `0 4px 16px ${T.gold}50` : "none",
              }}
              aria-label="Send message"
            >↑</button>

            {/* Mic button */}
            {voiceSupported && (
              <button
                onClick={() => listening ? stopListening() : startListening()}
                style={{
                  width: 38, height: 38,
                  borderRadius: "50%", border: "none",
                  background: listening ? G.gold : `${T.emerald}22`,
                  color: listening ? T.emeraldText : T.emerald,
                  cursor: "pointer", fontSize: 16,
                  transition: "all 0.2s", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: listening ? `0 0 24px ${T.gold}70` : `0 2px 10px ${T.emerald}30`,
                  animation: listening ? "glow 1.5s ease infinite" : "none",
                }}
                aria-label={listening ? "Stop listening" : "Start voice input"}
              >
                {listening ? "⏹" : "🎤"}
              </button>
            )}
          </div>
        </div>
        </div>{/* end input bar */}

        {/* SOS FAB — pulsing for visibility */}
        <button
          onClick={() => {
            const seat = profile.seat ? `I'm at ${profile.seat}.` : "";
            const gate = profile.gate ? `My gate is ${profile.gate}.` : "";
            const access = profile.accessibility ? `I have a ${profile.accessibility} accessibility need.` : "";
            const query = `🆘 EMERGENCY — I need urgent help right now. ${seat} ${gate} ${access} Please tell me: the nearest emergency exit, nearest first aid station, and how to reach stadium security immediately.`.trim();
            send(query);
          }}
          style={{
            position: "absolute", bottom: 106, right: 14, zIndex: 100,
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(200,20,30,0.15)",
            border: "2px solid #FF3333",
            color: "#FF4444",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, cursor: "pointer",
            boxShadow: "0 0 0 0 rgba(255,50,50,0.5)",
            animation: "sosGlow 2s ease-in-out infinite",
            transition: "background 0.2s, transform 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(200,20,30,0.35)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(200,20,30,0.15)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="Emergency SOS — tap for immediate help"
          aria-label="Emergency SOS"
        >
          🆘
        </button>

        <style>{`
          @keyframes fadeIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes slideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
          @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
          @keyframes ripple   { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2);opacity:0} }
          @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.3} }
          @keyframes glow     { 0%,100%{box-shadow:0 0 15px #E8B84D30} 50%{box-shadow:0 0 30px #E8B84D70} }
          @keyframes goldGlow { 0%,100%{box-shadow:0 0 16px #E8B84D40} 50%{box-shadow:0 0 32px #F5C84280,0 0 48px #E8B84D40} }
          @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
          @keyframes popIn    { 0%{transform:scale(0.85);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
          @keyframes breathe  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
          @keyframes quickBounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-12px)} 60%{transform:translateY(2px)} }
          @keyframes mapReveal { 0%{opacity:0;transform:scaleY(0)} 100%{opacity:1;transform:scaleY(1)} }
          @keyframes pulseRing { 0%{stroke-width:1;filter:drop-shadow(0 0 2px #E8B84D60)} 50%{stroke-width:3.5;filter:drop-shadow(0 0 12px #E8B84D)} 100%{stroke-width:1;filter:drop-shadow(0 0 2px #E8B84D60)} }
          @keyframes sosGlow  { 0%,100%{box-shadow:0 0 0 0 rgba(255,50,50,0.55),0 4px 16px rgba(255,50,50,0.25)} 50%{box-shadow:0 0 0 10px rgba(255,50,50,0),0 4px 24px rgba(255,50,50,0.5)} }
          ::-webkit-scrollbar { display: none; }
          input::placeholder  { color: #4A7A60; }
        `}</style>

      </div>
    </div>
  );
}
