import { expect, type Page } from "@playwright/test";

const annulationsAttendues = /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i;

/**
 * Préchargement RSC interrompu par une navigation.
 *
 * `<Link>` précharge la route survolée ou visible ; un `page.goto()` qui suit
 * immédiatement annule ces requêtes. Chromium les rapporte comme requêtes
 * échouées — déjà filtrées ci-dessous — tandis que WebKit rejette la promesse
 * `fetch`, ce qui remonte en `pageerror` avec le libellé des contrôles
 * d'accès. Aucune fonctionnalité n'en dépend : la navigation retombe sur une
 * requête complète.
 *
 * L'exemption est volontairement étroite : elle exige à la fois le libellé
 * d'échec de `fetch` et le marqueur `_rsc=` de Next. Une erreur React, une
 * exception applicative ou un échec de requête applicative restent des
 * incidents — c'est ainsi qu'un défaut d'hydratation Safari a été trouvé.
 */
const prechargementInterrompu = /Fetch API cannot load[\s\S]*_rsc=/i;

export function observeRuntime(page: Page) {
  const incidents: string[] = [];

  page.on("pageerror", (error) => {
    // WebKit ne place pas toujours le texte dans `message` : on teste la
    // chaîne complète plutôt que de parier sur le champ porteur.
    const texte = `${error.name}: ${error.message}`;
    if (prechargementInterrompu.test(texte)) return;
    incidents.push(`pageerror: ${texte}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") incidents.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const cause = request.failure()?.errorText ?? "cause inconnue";
    if (!annulationsAttendues.test(cause)) {
      incidents.push(`requestfailed: ${request.method()} ${request.url()} (${cause})`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      incidents.push(`http-${response.status()}: ${response.request().method()} ${response.url()}`);
    }
  });

  return {
    assertClean() {
      expect(incidents, "Aucun incident navigateur ou HTTP serveur inattendu").toEqual([]);
    },
  };
}
