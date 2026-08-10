"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  readAppPreferences,
  subscribeAppPreferences,
  updateAppPreference,
} from "@/lib/app-preferences";
import { useMessages } from "@/i18n/client";

type PreferenceSwitchProps = {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
};

function PreferenceSwitch({ checked, description, label, onChange }: PreferenceSwitchProps) {
  return (
    <label className="scroll-mb-36 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="block text-xs text-white/55">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-9 shrink-0 accent-amber-300"
      />
    </label>
  );
}

export function AppPreferences() {
  const m = useMessages();
  const preferences = useSyncExternalStore(
    subscribeAppPreferences,
    readAppPreferences,
    () => DEFAULT_PREFERENCES,
  );

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = preferences.reducedMotion ? "true" : "false";
  }, [preferences.reducedMotion]);

  return (
    <section className="glass-card flex flex-col gap-3 p-5" aria-labelledby="app-preferences-title">
      <div>
        <h2 id="app-preferences-title" className="text-lg font-bold text-white">
          {m.preferences.titre}
        </h2>
        <p className="mt-1 text-sm text-white/60">{m.preferences.aide}</p>
      </div>
      <PreferenceSwitch
        label={m.preferences.sonVideos}
        description={m.preferences.sonVideosDescription}
        checked={preferences.feedSound}
        onChange={(value) => updateAppPreference("feedSound", value)}
      />
      <PreferenceSwitch
        label={m.preferences.ambiance}
        description={m.preferences.ambianceDescription}
        checked={preferences.ambience}
        onChange={(value) => updateAppPreference("ambience", value)}
      />
      <PreferenceSwitch
        label={m.preferences.reduireAnimations}
        description={m.preferences.reduireAnimationsDescription}
        checked={preferences.reducedMotion}
        onChange={(value) => updateAppPreference("reducedMotion", value)}
      />
    </section>
  );
}
