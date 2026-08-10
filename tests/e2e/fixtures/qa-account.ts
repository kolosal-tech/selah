export type QaAccount = { email: string; password: string };

/**
 * Le wrapper `run-qa.mjs` extrait le compte depuis le document local et
 * l'injecte dans ce processus. Les identifiants ne sont donc jamais lus par
 * défaut lors de `pnpm test:e2e` ni présents dans les sources TypeScript.
 */
export function getQaAccount(): QaAccount | null {
  const { E2E_QA_EMAIL: email, E2E_QA_PASSWORD: password } = process.env;
  return email && password ? { email, password } : null;
}

export function getQaAccounts(): QaAccount[] {
  const encoded = process.env.E2E_QA_ACCOUNTS;
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded) as unknown;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (entry): entry is QaAccount =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as QaAccount).email === "string" &&
            typeof (entry as QaAccount).password === "string",
        );
        if (valid.length > 0) return valid;
      }
    } catch {
      // Une variable mal formée retombe sur le compte unique historique.
    }
  }
  const account = getQaAccount();
  return account ? [account] : [];
}
