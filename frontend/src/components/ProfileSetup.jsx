import { useState } from "react";
import { G, T } from "../theme";
import Pippo1 from "../assets/Pippo1.png";
import Pippo4 from "../assets/Pippo4.png";

/* Hover-safe button — prevents browser default white hover on dark backgrounds */
function HoverBtn({ onClick, selected, selectedBg, selectedBorder, hoverBg, hoverBorder, style, children }) {
  const [hovered, setHovered] = useState(false);

  // Destructure background/border out of style so the spread doesn't override our computed values
  const { background: _bg, border: _border, ...restStyle } = style;

  const computedBg     = selected ? selectedBg
                       : hovered  ? hoverBg
                       : _bg;
  const computedBorder = selected ? `2px solid ${selectedBorder}`
                       : hovered  ? `2px solid ${hoverBorder}`
                       : _border;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...restStyle,
        background:  computedBg,
        border:      computedBorder,
        color:       T.text,
        cursor:      style.cursor || "pointer",
        transition:  "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

/*
 * AccessBtn — used ONLY for the accessibility needs section.
 *
 * Why a separate component:
 * - HoverBtn uses hex+alpha strings (e.g. T.emerald+"22") which are invalid CSS
 *   and cause browsers to fall back to white on hover.
 * - This component uses rgba() for all backgrounds so hover always works correctly.
 * - Keeps the fix isolated — nothing else in the file is changed.
 */
function AccessBtn({ onClick, selected, accent, accentRgb, card2, borderSolid, text, fontWeight, children }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const bg = selected
    ? `rgba(${accentRgb}, 0.18)`   // selected: clear tinted fill
    : hovered
      ? `rgba(${accentRgb}, 0.10)` // hover: subtle tint — always visible on dark bg
      : card2;                      // idle: dark surface — never white

  const borderColor = selected || hovered || focused ? accent : borderSolid;

  const shadow = selected
    ? `0 0 0 2px rgba(${accentRgb}, 0.3), 0 4px 16px rgba(0,0,0,0.3)`
    : focused
      ? `0 0 0 3px rgba(${accentRgb}, 0.45)`
      : hovered
        ? `0 4px 14px rgba(0,0,0,0.3)`
        : `0 2px 8px rgba(0,0,0,0.2)`;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: "16px 20px",
        borderRadius: 14,
        border: `2px solid ${borderColor}`,
        background: bg,
        display: "flex", alignItems: "center", gap: 14,
        textAlign: "left", width: "100%",
        color: text,                   // always near-white — never let browser override
        fontWeight,
        cursor: "pointer",
        outline: "none",               // focus ring drawn via boxShadow
        transition: "all 0.18s ease",
        transform: hovered && !selected ? "scale(1.012)" : "scale(1)",
        boxShadow: shadow,
      }}
    >
      {children}
    </button>
  );
}

const LANGUAGES = [
  { code: "English",    flag: "🇬🇧" },
  { code: "Español",    flag: "🇪🇸" },
  { code: "Français",   flag: "🇫🇷" },
  { code: "Deutsch",    flag: "🇩🇪" },
  { code: "Português",  flag: "🇧🇷" },
  { code: "العربية",    flag: "🇸🇦" },
  { code: "日本語",      flag: "🇯🇵" },
  { code: "हिन्दी",    flag: "🇮🇳" },
  { code: "தமிழ்",     flag: "🇮🇳" },
  { code: "Italiano",   flag: "🇮🇹" },
  { code: "Nederlands", flag: "🇳🇱" },
  { code: "한국어",      flag: "🇰🇷" },
  { code: "中文",        flag: "🇨🇳" },
  { code: "Türkçe",     flag: "🇹🇷" },
  { code: "Polski",     flag: "🇵🇱" },
  { code: "Svenska",    flag: "🇸🇪" },
  { code: "Русский",    flag: "🇷🇺" },
];

const ACCESS_OPTIONS = [
  { key: "",                      label: "None",              icon: "✅" },
  { key: "Wheelchair / step-free",label: "Wheelchair / Step-Free", icon: "♿" },
  { key: "Visual",                label: "Visually Impaired", icon: "👁️" },
  { key: "Hearing",               label: "Hearing Impaired",  icon: "🦻" },
];

const STEPS = [
  { id: "name",          title: "What's your name?",         subtitle: "I'll personalize everything for you.", field: "name", placeholder: "Your name…", optional: false },
  { id: "language",      title: "Your language?",            subtitle: "I'll always reply in your language.",  field: "language", type: "lang" },
  { id: "seat",          title: "Your seat & section?",      subtitle: "Helps me route you instantly.",        field: "seat", placeholder: "e.g. Section 214, Row G…", optional: true },
  { id: "accessibility", title: "Any accessibility needs?",  subtitle: "I'll always route step-free if needed.", field: "accessibility", type: "access" },
  { id: "team",          title: "Favourite team? ⚽",        subtitle: "Just for fun — I'll cheer with you!",  field: "team", placeholder: "e.g. Brazil…", optional: true },
];

export default function ProfileSetup({ onComplete }) {
  const [step, setStep]   = useState(0);
  const [happy, setHappy] = useState(false);
  const [form, setForm]   = useState({
    name: "", language: "English",
    seat: "", gate: "", accessibility: "", team: "",
  });

  const cur    = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    if (field === "seat") setForm(f => ({ ...f, gate: val }));
  }

  function advance() {
    if (isLast) {
      setHappy(true);
      setTimeout(() => onComplete({
        ...form,
        highContrast: form.accessibility === "Visual",
        accessibility: form.accessibility === "" ? "" : form.accessibility,
      }), 600);
    } else {
      setStep(s => s + 1);
    }
  }

  const canAdvance = cur.optional || !!form[cur.field]?.trim() || cur.type === "lang" || cur.type === "access";

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      fontFamily: "'Inter', sans-serif", color: T.text,
      display: "flex", flexDirection: "column",
    }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: `${T.border}50` }}>
        <div style={{
          height: "100%",
          width: `${((step + 1) / STEPS.length) * 100}%`,
          background: G.gold,
          backgroundSize: "200% auto",
          transition: "width 0.4s ease",
          animation: "shimmer 2.5s linear infinite",
          boxShadow: `0 0 8px ${T.gold}60`,
        }} />
      </div>

      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
      }}>
        <div style={{
          width: "100%", maxWidth: 480,
          background: T.card, borderRadius: 24, padding: "40px 32px",
          boxShadow: `0 24px 64px rgba(0,0,0,0.5)`,
          border: `1px solid ${T.border}`,
          animation: "fadeIn 0.4s ease",
        }}>
          {/* Pippo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img
              src={happy ? Pippo4 : Pippo1}
              alt="Pippo"
              style={{
                width: 90, height: 90, objectFit: "contain",
                filter: happy
                  ? `drop-shadow(0 0 24px ${T.gold}90)`
                  : `drop-shadow(0 0 18px ${T.violet}70)`,
                transition: "all 0.4s",
                animation: happy ? "float 1.5s ease infinite" : "none",
              }}
            />
            <div style={{
              fontSize: 11, color: T.muted,
              textTransform: "uppercase", letterSpacing: 2, marginTop: 12,
            }}>
              Step {step + 1} of {STEPS.length}
            </div>
          </div>

          {/* Question */}
          <h2 style={{
            fontSize: 28, fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            marginBottom: 8, textAlign: "center"
          }}>{cur.title}</h2>
          <p style={{ color: T.muted, fontSize: 15, marginBottom: 32, textAlign: "center" }}>{cur.subtitle}</p>

        {/* Input */}
        {cur.type === "lang" && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            maxHeight: 340, overflowY: "auto", paddingRight: 4,
          }}>
            {LANGUAGES.map(l => {
              const sel = form.language === l.code;
              return (
                <HoverBtn
                  key={l.code}
                  onClick={() => set("language", l.code)}
                  selected={sel}
                  selectedBg={`${T.gold}22`}
                  selectedBorder={T.gold}
                  hoverBg={`${T.teal}18`}
                  hoverBorder={T.teal}
                  style={{
                    padding: "11px 10px",
                    borderRadius: 12,
                    border: `2px solid ${sel ? T.gold : T.border}`,
                    background: sel ? `${T.gold}22` : T.card2,
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 13, fontWeight: sel ? 600 : 400,
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{l.flag}</span>
                  {l.code}
                </HoverBtn>
              );
            })}
          </div>
        )}

        {cur.type === "access" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ACCESS_OPTIONS.map(o => {
              const sel = form.accessibility === o.key;
              // Use T.emerald (the correct interactive color in the current theme).
              // All backgrounds use rgba() — hex+2char alpha like T.emerald+"22" is
              // NOT valid CSS and makes browsers fall back to white on hover.
              const accent = T.emerald; // #22D3EE
              const accentRgb = "34,211,238"; // RGB of #22D3EE
              return (
                <AccessBtn
                  key={o.key}
                  onClick={() => set("accessibility", o.key)}
                  selected={sel}
                  accent={accent}
                  accentRgb={accentRgb}
                  card2={T.card2}
                  borderSolid={T.borderSolid}
                  text={T.text}
                  fontWeight={sel ? 600 : 400}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{o.icon}</span>
                  <span style={{ fontSize: 15 }}>{o.label}</span>
                </AccessBtn>
              );
            })}
          </div>
        )}

        {!cur.type && (
          <input
            id={`setup-${cur.field}`}
            value={form[cur.field]}
            onChange={e => set(cur.field, e.target.value)}
            onKeyDown={e => e.key === "Enter" && canAdvance && advance()}
            placeholder={cur.placeholder}
            autoFocus
            style={{
              width: "100%", padding: "16px 20px",
              borderRadius: 14,
              border: `2px solid ${form[cur.field] ? T.teal : T.border}`,
              background: T.card, color: T.text,
              fontSize: 16, outline: "none",
              transition: "border-color 0.2s",
            }}
          />
        )}

          {/* Footer */}
          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            {step > 0 && (
              <HoverBtn
                onClick={() => setStep(s => s - 1)}
                selected={false}
                selectedBg="transparent"
                selectedBorder={T.border}
                hoverBg={`${T.border}30`}
                hoverBorder={T.muted}
                style={{
                  flex: 1, padding: "16px", borderRadius: 14,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  fontSize: 15, fontWeight: 500,
                  width: "100%",
                }}
              >← Back</HoverBtn>
            )}
            {cur.optional && step !== 0 && (
              <HoverBtn
                onClick={advance}
                selected={false}
                selectedBg="transparent"
                selectedBorder={T.border}
                hoverBg={`${T.border}30`}
                hoverBorder={T.muted}
                style={{
                  flex: 1, padding: "16px", borderRadius: 14,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  fontSize: 15, fontWeight: 500,
                  width: "100%",
                }}
              >Skip</HoverBtn>
            )}
            <HoverBtn
              onClick={canAdvance ? advance : undefined}
              selected={false}
              selectedBg={G.gold}
              selectedBorder="transparent"
              hoverBg={canAdvance ? `linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)` : T.card2}
              hoverBorder="transparent"
              style={{
                flex: 2, padding: "16px", borderRadius: 14,
                border: "none",
                background: canAdvance ? G.gold : T.card2,
                backgroundSize: "200% auto",
                color: canAdvance ? "#021A11" : T.muted,
                cursor: canAdvance ? "pointer" : "not-allowed",
                fontSize: 16, fontWeight: 700,
                animation: canAdvance ? "shimmer 2.5s linear infinite" : "none",
                boxShadow: canAdvance ? `0 8px 24px ${T.gold}50` : "none",
                opacity: canAdvance ? 1 : 0.5,
                width: "100%",
              }}
            >
              {isLast ? "🎉 Let's Go!" : "Continue →"}
            </HoverBtn>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        input::placeholder { color: #4A7A60; }
      `}</style>
    </div>
  );
}
