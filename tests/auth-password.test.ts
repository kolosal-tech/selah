import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import {
  destinationReinitialisationSure,
  emailValidePourReinitialisation,
  MIN_PASSWORD_LENGTH,
  motDePasseValide,
  motsDePasseIdentiques,
  origineApplicationCanonique,
  urlCallbackReinitialisation,
} from "@/lib/auth-password";
import { isPublicPath } from "@/lib/public-paths";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

describe("validation du parcours mot de passe", () => {
  it("valide un email plausible sans accepter les entrées ambiguës", () => {
    expect(emailValidePourReinitialisation(" disciple@example.org ")).toBe(true);
    expect(emailValidePourReinitialisation("disciple@example")).toBe(false);
    expect(emailValidePourReinitialisation("a b@example.org")).toBe(false);
    expect(emailValidePourReinitialisation(`${"a".repeat(310)}@example.org`)).toBe(false);
  });

  it("applique la même longueur minimale à l'inscription et à la réinitialisation", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(motDePasseValide("1234567")).toBe(false);
    expect(motDePasseValide("12345678")).toBe(true);
  });

  it("exige une confirmation identique", () => {
    expect(motsDePasseIdentiques("nouveau-secret", "nouveau-secret")).toBe(true);
    expect(motsDePasseIdentiques("nouveau-secret", "autre-secret")).toBe(false);
  });
});

describe("redirections du parcours de récupération", () => {
  it("n'autorise que la page de nouveau mot de passe", () => {
    expect(destinationReinitialisationSure("/reset-password")).toBe("/reset-password");
    expect(destinationReinitialisationSure("//evil.example")).toBe(
      "/forgot-password?error=link",
    );
    expect(destinationReinitialisationSure("https://evil.example")).toBe(
      "/forgot-password?error=link",
    );
    expect(destinationReinitialisationSure(null)).toBe(
      "/forgot-password?error=link",
    );
  });

  it("construit le callback uniquement depuis l'origine canonique configurée", () => {
    expect(
      origineApplicationCanonique("https://selah.example", "production"),
    ).toBe("https://selah.example");
    expect(
      origineApplicationCanonique("https://selah.example/app", "production"),
    ).toBeNull();
    expect(
      origineApplicationCanonique("http://evil.example", "development"),
    ).toBeNull();
    expect(
      origineApplicationCanonique("http://localhost:3100", "development"),
    ).toBe("http://localhost:3100");
    expect(origineApplicationCanonique(undefined, "production")).toBeNull();

    const callback = new URL(
      urlCallbackReinitialisation("https://selah.example", "production")!,
    );
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/reset-password");
    expect(
      urlCallbackReinitialisation("https://evil.example/path", "production"),
    ).toBeNull();
  });
});

describe("intégration Supabase Auth", () => {
  it("redirige les échecs de connexion vers un code stable sans message Supabase", async () => {
    const actions = await source("src/app/actions.ts");

    expect(actions).toContain('redirect("/login?error=invalid-credentials")');
    expect(actions).not.toContain("encodeURIComponent(error.message)");
  });

  it("affiche une aide localisée de réinitialisation uniquement après un échec identifié", async () => {
    const login = await source("src/app/login/page.tsx");

    expect(login).toContain('error === "invalid-credentials"');
    expect(login).toContain("m.auth.identifiantsInvalides");
    expect(login).toContain("m.auth.reinitialisationConnexionAide");
    expect(login).toContain('href="/forgot-password"');
  });

  it("utilise les opérations réelles de récupération et de mise à jour", async () => {
    const actions = await source("src/app/auth/password-actions.ts");
    const callback = await source("src/app/auth/callback/route.ts");

    expect(actions).toContain("supabase.auth.resetPasswordForEmail");
    expect(actions).toContain("supabase.auth.updateUser({ password })");
    expect(actions).toContain('supabase.auth.signOut({ scope: "local" })');
    expect(actions).toContain("process.env.APP_URL");
    expect(actions).not.toContain('entetes.get("host")');
    expect(actions).not.toContain('entetes.get("origin")');
    expect(callback).toContain("supabase.auth.exchangeCodeForSession");
  });

  it("laisse le callback et les deux écrans de récupération publics", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("rend le bouton de visibilité explicite pour les technologies d'assistance", async () => {
    const champ = await source("src/app/auth/password-field.tsx");
    expect(champ).toContain('type="button"');
    expect(champ).toContain("aria-label={libelleBouton}");
    expect(champ).toContain("aria-pressed={visible}");
    expect(champ).toContain('type={visible ? "text" : "password"}');
  });

  it("fournit les libellés mot de passe aux douze langues", () => {
    const cles = [
      "afficherMotDePasse",
      "masquerMotDePasse",
      "motDePasseOublie",
      "identifiantsInvalides",
      "reinitialisationConnexionAide",
      "reinitialiserMotDePasse",
      "demandeReinitialisationAcceptee",
      "demandeReinitialisationErreur",
      "lienReinitialisationInvalide",
      "nouveauMotDePasse",
      "confirmerMotDePasse",
      "motDePasseModifie",
    ] as const;

    expect(Object.keys(MESSAGES)).toHaveLength(12);
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      for (const cle of cles) {
        expect(messages.auth[cle], `${locale}.${cle}`).toBeTypeOf("string");
        expect(messages.auth[cle].trim(), `${locale}.${cle}`).not.toBe("");
      }
    }
  });
});
