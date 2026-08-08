import { describe, expect, it } from "vitest";
import {
  identifiantDepuisNom,
  identifiantNeutre,
  nettoyerNomAffiche,
  nomAfficheValide,
} from "@/lib/identifiant";

describe("nom affiché", () => {
  it("accepte un prénom simple", () => {
    expect(nomAfficheValide("Marie")).toBe(true);
  });

  it("accepte les accents, les traits d'union et les apostrophes", () => {
    for (const n of ["Aïcha", "Marie-Claire", "Jean-Baptiste", "N'Guessan", "Zoé"]) {
      expect(nomAfficheValide(n), n).toBe(true);
    }
  });

  it("accepte les écritures non latines", () => {
    for (const n of ["마리아", "مريم", "Мария", "恵子"]) {
      expect(nomAfficheValide(n), n).toBe(true);
    }
  });

  it("refuse le vide, la ponctuation seule et une adresse e-mail", () => {
    for (const n of ["", " ", "a", "...", "--", "marie@exemple.fr"]) {
      expect(nomAfficheValide(n), JSON.stringify(n)).toBe(false);
    }
  });

  it("réduit les espaces multiples", () => {
    expect(nettoyerNomAffiche("  Marie   Claire ")).toBe("Marie Claire");
  });
});

describe("identifiant dérivé", () => {
  it("dépouille accents et séparateurs", () => {
    expect(identifiantDepuisNom("Aïcha")).toBe("aicha");
    expect(identifiantDepuisNom("Marie-Claire")).toBe("marie_claire");
    expect(identifiantDepuisNom("Jean Baptiste")).toBe("jean_baptiste");
    expect(identifiantDepuisNom("N'Guessan")).toBe("n_guessan");
    expect(identifiantDepuisNom("Zoé")).toBe("zoe");
  });

  it("ne laisse jamais d'underscore en bordure", () => {
    expect(identifiantDepuisNom("!! Marie !!")).toBe("marie");
  });

  it("rend une chaîne vide quand rien de latin ne subsiste", () => {
    for (const n of ["마리아", "مريم", "恵子"]) {
      expect(identifiantDepuisNom(n), n).toBe("");
    }
  });

  it("respecte la limite de trente caractères de la base", () => {
    const long = identifiantDepuisNom("Marie".repeat(20));
    expect(long.length).toBeLessThanOrEqual(30);
  });

  it("fournit un identifiant neutre exploitable en repli", () => {
    const id = identifiantNeutre("marie@exemple.fr");
    expect(id).toMatch(/^disciple_[a-z0-9]{1,6}$/);
  });
});
