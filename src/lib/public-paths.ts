const PUBLIC_PATHS = new Set([
  "/decouvrir",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/manifest.json",
  "/sw.js",
  "/hors-ligne",
]);

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/");
}
