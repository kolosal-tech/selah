export const MIN_PASSWORD_LENGTH = 8;
export const RESET_PASSWORD_PATH = "/reset-password";

export function emailValidePourReinitialisation(email: string): boolean {
  const valeur = email.trim();
  return (
    valeur.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur)
  );
}

export function motDePasseValide(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function motsDePasseIdentiques(
  password: string,
  confirmation: string,
): boolean {
  return password === confirmation;
}

/** Le callback Auth n'accepte aucune redirection arbitraire. */
export function destinationReinitialisationSure(next: string | null): string {
  return next === RESET_PASSWORD_PATH ? next : "/forgot-password?error=link";
}

export function origineApplicationCanonique(
  value: string | undefined,
  environment: string | undefined,
): string | null {
  if (!value) {
    return environment === "development" ? "http://localhost:3000" : null;
  }
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    if (url.protocol === "https:") return url.origin;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (environment !== "development" || url.protocol !== "http:" || !local) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function urlCallbackReinitialisation(
  appUrl: string | undefined,
  environment: string | undefined,
): string | null {
  const origin = origineApplicationCanonique(appUrl, environment);
  if (!origin) return null;
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", RESET_PASSWORD_PATH);
  return callback.toString();
}
