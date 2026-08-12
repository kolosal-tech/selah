import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BrowserFamily = "chrome" | "safari" | "firefox" | "edge" | "other";
export type DeviceType = "mobile" | "tablet" | "desktop" | "other";

/** Réduit le user-agent avant tout stockage : aucune chaîne brute ne quitte la requête. */
export function classifyUserAgent(userAgent: string | null): {
  browserFamily: BrowserFamily;
  deviceType: DeviceType;
} {
  const value = (userAgent ?? "").toLowerCase();
  const browserFamily: BrowserFamily = value.includes("edg/")
    ? "edge"
    : value.includes("firefox/")
      ? "firefox"
      : value.includes("chrome/") || value.includes("crios/")
        ? "chrome"
        : value.includes("safari/")
          ? "safari"
          : "other";
  const deviceType: DeviceType = value.includes("ipad") || value.includes("tablet")
    ? "tablet"
    : value.includes("mobi") || value.includes("iphone") || value.includes("android")
      ? "mobile"
      : value
        ? "desktop"
        : "other";
  return { browserFamily, deviceType };
}

/** Best-effort hors chemin critique : l'historique de sessions ne doit jamais bloquer Selah. */
export function recordAccountSessionAfter(supabase: SupabaseClient, userAgent: string | null): void {
  const { browserFamily, deviceType } = classifyUserAgent(userAgent);
  after(async () => {
    try {
      await supabase.rpc("record_account_session", {
        p_browser_family: browserFamily,
        p_device_type: deviceType,
      });
    } catch {
      // Pas de journal : il pourrait contenir une information de session.
    }
  });
}
