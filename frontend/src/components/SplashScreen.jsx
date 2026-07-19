import { useEffect, useState } from "react";
import { G, T } from "../theme";
import logo from "../assets/logo.png";
import Pippo4 from "../assets/Pippo4.png";

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0); // 0=intro, 1=happy

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200);
    const t2 = setTimeout(onDone, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      minHeight: "100vh", background: G.splash,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif", color: T.text,
      overflow: "hidden", position: "relative",
    }}>
      {/* Glowing orbs */}
      <div style={{
        position: "absolute", width: 320, height: 320,
        borderRadius: "50%", background: `${T.violet}20`,
        filter: "blur(70px)", top: "8%", left: "-12%",
        animation: "float 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", width: 220, height: 220,
        borderRadius: "50%", background: `${T.teal}18`,
        filter: "blur(50px)", bottom: "18%", right: "-8%",
        animation: "float 5s ease-in-out infinite reverse",
      }} />
      {/* Extra subtle gold orb behind Pippo */}
      <div style={{
        position: "absolute", width: 260, height: 260,
        borderRadius: "50%", background: `${T.gold}12`,
        filter: "blur(60px)", top: "30%", left: "50%",
        transform: "translateX(-50%)",
        animation: "float 6s ease-in-out infinite 1s",
      }} />

      {/* Pippo mascot */}
      <div style={{
        width: 148, height: 148,
        marginBottom: 28,
        animation: phase === 1 ? "float 2s ease-in-out infinite" : "none",
        transition: "all 0.5s ease",
        filter: phase === 1
          ? `drop-shadow(0 0 28px ${T.gold}90) drop-shadow(0 0 60px ${T.teal}40)`
          : `drop-shadow(0 0 20px ${T.violet}70)`,
        position: "relative",
        zIndex: 2,
      }}>
        <img
          src={phase === 1 ? Pippo4 : logo}
          alt="Pippo AI mascot"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Name */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 48, fontWeight: 900,
          background: G.gold,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundSize: "200% auto",
          letterSpacing: -1.5, margin: 0,
          animation: "fadeIn 0.6s ease, shimmer 3s linear infinite",
        }}>
          Pippo
        </h1>
        <p style={{
          fontSize: 14, color: T.muted,
          marginTop: 6, letterSpacing: 2,
          textTransform: "uppercase",
          animation: "fadeIn 0.8s ease 0.2s both",
        }}>
          Your FIFA 2026 Stadium AI
        </p>

        {/* Loading bar */}
        <div style={{
          width: 160, height: 3,
          borderRadius: 2, background: `${T.border}60`,
          overflow: "hidden", margin: "28px auto 0",
        }}>
          <div style={{
            height: "100%",
            background: G.gold,
            backgroundSize: "200% auto",
            animation: "splash-bar 2.4s ease forwards, shimmer 2s linear infinite",
            boxShadow: `0 0 8px ${T.gold}80`,
          }} />
        </div>
      </div>

      <style>{`
        @keyframes fadeIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes splash-bar { from{width:0} to{width:100%} }
      `}</style>
    </div>
  );
}
