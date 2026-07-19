import { useState, useEffect } from "react";

const KEY = "pippo-profile";
const DONE = "pippo-done";

const defaults = {
  name: "", language: "English",
  seat: "", gate: "", accessibility: "", team: "",
  highContrast: false,
};

export function useProfile() {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch { return defaults; }
  });

  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem(DONE) === "true"
  );

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(profile));
    // Apply high-contrast class to body
    document.body.classList.toggle("hc-mode", !!profile.highContrast);
  }, [profile]);

  function completeOnboarding(data) {
    const merged = { ...defaults, ...data };
    setProfile(merged);
    setOnboarded(true);
    localStorage.setItem(DONE, "true");
  }

  function updateProfile(data) {
    setProfile(p => ({ ...p, ...data }));
  }

  function resetProfile() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(DONE);
    setProfile(defaults);
    setOnboarded(false);
  }

  return { profile, onboarded, completeOnboarding, updateProfile, resetProfile };
}
