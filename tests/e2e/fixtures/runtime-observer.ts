import { expect, type Page } from "@playwright/test";

const annulationsAttendues = /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i;

export function observeRuntime(page: Page) {
  const incidents: string[] = [];

  page.on("pageerror", (error) => {
    incidents.push(`pageerror: ${error.name}: ${error.message}`);
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
