import { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import ProfileSetup from "./components/ProfileSetup";
import NavigationScreen from "./components/NavigationScreen";
import { useProfile } from "./hooks/useProfile";
import "./index.css";

export default function App() {
  const { profile, onboarded, completeOnboarding, updateProfile, resetProfile } = useProfile();
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem("pippo-splash") === "true"
  );

  function finishSplash() {
    sessionStorage.setItem("pippo-splash", "true");
    setSplashDone(true);
  }

  if (!splashDone) return <SplashScreen onDone={finishSplash} />;
  if (!onboarded)  return <ProfileSetup onComplete={completeOnboarding} />;
  return (
    <NavigationScreen
      profile={profile}
      onReset={resetProfile}
      updateProfile={updateProfile}
    />
  );
}
