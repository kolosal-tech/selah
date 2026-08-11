import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_EVENT_NAMES,
  WEB_VITAL_BUCKETS,
  WEB_VITAL_METRICS,
  bucketPourVital,
} from "@/lib/analytics/anonymous";

const MIGRATION = readFileSync(
  new URL(
    "../supabase/migrations/20260811150000_anonymous_events_and_vitals.sql",
    import.meta.url,
  ),
  "utf8",
);

const SOURCE = readFileSync(
  new URL("../src/lib/analytics/anonymous.ts", import.meta.url),
  "utf8",
);

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function valeursEnum(nom: string): string[] {
  const bloc = new RegExp(
    `create type public\\.${nom} as enum \\(([^)]*)\\)`,
  ).exec(MIGRATION);
  if (!bloc) throw new Error(`type ${nom} absent de la migration`);
  return [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("voie anonyme", () => {
  it("reste alignée sur les types énumérés SQL", () => {
    expect([...ANONYMOUS_EVENT_NAMES].sort()).toEqual(
      valeursEnum("anonymous_event_name").sort(),
    );
    expect([...WEB_VITAL_METRICS].sort()).toEqual(
      valeursEnum("web_vital_metric").sort(),
    );
    expect([...WEB_VITAL_BUCKETS].sort()).toEqual(
      valeursEnum("web_vital_bucket").sort(),
    );
  });

  it("ne transporte aucune donnée identifiante", () => {
    const propre = sansCommentaires(SOURCE);
    // Ni acteur, ni adresse, ni agent : c'est la propriété qui distingue cette
    // voie de `product_events` et qui autorise son ouverture à `anon`.
    expect(propre).not.toMatch(/\b(actor_id|user_id|ip|user_agent|session_id)\b/);
    expect(propre).not.toMatch(/auth\.getUser|user\.id/);
    // La table elle-même ne doit pas non plus porter de telle colonne.
    expect(MIGRATION).not.toMatch(/^\s+(actor_id|user_id|ip|user_agent)\s/m);
  });

  it("exige un jeton serveur plutôt qu'une clé service_role", () => {
    // Une clé `service_role` contournerait la RLS sur toute la base ; le jeton
    // n'autorise que l'insertion d'un compteur.
    expect(sansCommentaires(SOURCE)).not.toMatch(/service_role|SERVICE_ROLE/);
    expect(SOURCE).toContain("process.env.SELAH_ANALYTICS_TOKEN");
    expect(MIGRATION).toContain("token_sha256");
    // Le jeton n'est jamais stocké en clair.
    expect(MIGRATION).toContain("encode(sha256(convert_to(p_token, 'UTF8')), 'hex')");
  });

  it("reste inerte et muette", () => {
    expect(SOURCE).toMatch(/if \(!isEnabled\("analytics_anonymous"\)\) return;/);
    expect(sansCommentaires(SOURCE)).not.toMatch(/console\.\w+\(/);
  });
});

describe("bucketPourVital", () => {
  it("applique les seuils terrain de web.dev", () => {
    expect(bucketPourVital("lcp", 2500)).toBe("good");
    expect(bucketPourVital("lcp", 2501)).toBe("needs_improvement");
    expect(bucketPourVital("lcp", 4000)).toBe("needs_improvement");
    expect(bucketPourVital("lcp", 4001)).toBe("poor");

    expect(bucketPourVital("inp", 200)).toBe("good");
    expect(bucketPourVital("inp", 500)).toBe("needs_improvement");
    expect(bucketPourVital("inp", 501)).toBe("poor");

    expect(bucketPourVital("cls", 0.1)).toBe("good");
    expect(bucketPourVital("cls", 0.25)).toBe("needs_improvement");
    expect(bucketPourVital("cls", 0.26)).toBe("poor");
  });

  it("refuse une valeur qu'un client hostile pourrait forger", () => {
    expect(bucketPourVital("lcp", Number.NaN)).toBeNull();
    expect(bucketPourVital("lcp", Number.POSITIVE_INFINITY)).toBeNull();
    expect(bucketPourVital("cls", -1)).toBeNull();
  });

  it("accepte un décalage cumulé nul", () => {
    // Une page parfaitement stable vaut 0 : la refuser perdrait le meilleur cas.
    expect(bucketPourVital("cls", 0)).toBe("good");
  });
});

describe("route de collecte des métriques terrain", () => {
  const ROUTE = readFileSync(
    new URL("../src/app/api/vitals/route.ts", import.meta.url),
    "utf8",
  );

  it("ne conserve rien de ce que le client affirme", () => {
    // La valeur brute est réduite à un palier côté serveur, et rien d'autre du
    // corps de la requête n'est repris.
    expect(ROUTE).toContain("bucketPourVital");
    expect(sansCommentaires(ROUTE)).not.toMatch(/headers\.get|request\.url|referer/i);
  });

  it("répond toujours 204, succès ou refus", () => {
    // Une réponse différenciée permettrait de sonder la présence du jeton.
    expect(ROUTE).not.toMatch(/status: (400|401|403|429|500)/);
    expect([...ROUTE.matchAll(/status: 204/g)]).toHaveLength(3);
  });
});
