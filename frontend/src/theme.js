// ── Pippo AI · FIFA 2026 · Design Tokens (Floodlight Theme) ─────────────────
//
// 4-role palette — every color has exactly one job:
//   Background  #0B1220   → page canvas only
//   Surface     #141F35   → cards, header bar, input bar  (+ rgba border)
//   Amber (Gold)#F59E0B   → Pippo wordmark, CTA, AI-decided highlights
//   Cyan (Emer) #22D3EE   → interactive chips, buttons
//
// Supporting cast:
//   A11y sky-blue #5CA8E0 → accessibility UI only (icon, toggle, focus ring)
//   Primary Acc   #3B82F6 → stadium floodlight blue (live/active dot, primary accents)
//   Red           #EF4444 → danger, high crowd
//   Violet        #7F77DD → personal-brand signature (footer credit only)

export const T = {
  // ── Role: Background ───────────────────────────────
  bg:     "#0B1220",   // deep navy-black
  bg2:    "#0F182B",   // slightly lighter for gradient stops

  // ── Role: Surface ──────────────────────────────────
  card:   "#141F35",   // cards, header, input bar
  card2:  "#1C2B47",   // elevated surface — modals, hover states

  // ── Role: Border ──────────────────────────────────
  // Spec: 1px rgba(255,255,255,0.06) everywhere possible
  border:      "rgba(255,255,255,0.08)",
  borderSolid: "#24375A",   // opaque fallback where rgba won't work (SVG, etc.)

  // ── Role: Brand / AI Gold (Amber in this theme) ────
  gold:   "#F59E0B",   // warm contrast for CTAs

  // ── Role: Interactive Emerald (Cyan in this theme) ─
  emerald:     "#22D3EE",   // secondary/interactive for chips/buttons
  emeraldText: "#031E2A",   // dark text on cyan fill

  // ── Status-only: Mint (Electric Blue in this theme) 
  mint:   "#3B82F6",   // primary accent / floodlight blue

  // ── A11y-only: Sky Blue ───────────────────────────
  a11y:   "#5CA8E0",   // accessibility icon, toggle, focus ring — reserved exclusively

  // ── Semantic ──────────────────────────────────────
  red:    "#EF4444",   // danger / high crowd
  amber:  "#F59E0B",   // warnings / moderate crowd

  // ── Personal Brand (footer only) ─────────────────
  violet: "#7F77DD",   // quiet Twilight Hive signature — footer credit only

  // ── Text ──────────────────────────────────────────
  text:   "#EAF2FF",   // crisp techy text
  muted:  "#94A3B8",   // secondary text

  // ── Offline state ─────────────────────────────────
  offline: "#6B7280",
};

export const G = {
  // Page-level gradients
  hero:   `linear-gradient(135deg, ${T.bg} 0%, #141F35 60%, #3B82F615 100%)`,
  dark:   `linear-gradient(180deg, ${T.card} 0%, ${T.bg} 100%)`,
  splash: `radial-gradient(ellipse at 50% 40%, #1C2B47 0%, ${T.bg} 70%)`,

  // Gold/Amber gradient — Pippo wordmark, primary CTA, send button
  gold: `linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)`,

  // Chip fill — cyan-tinted surface, clearly interactive
  chip: `linear-gradient(135deg, #22D3EE18 0%, #22D3EE28 100%)`,

  // Stadium pitch background (now techy navy)
  pitch: `linear-gradient(180deg, #0D1728 0%, #080D17 100%)`,

  // Glassmorphism (dropdowns, overlays)
  glass: `rgba(20, 31, 53, 0.90)`,

  // Alert / escape-routing banner
  alert: `linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(11,18,32,0.95) 100%)`,

  // User message bubble — electric blue family distinguishes user from AI
  userBubble: `linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)`,
};
