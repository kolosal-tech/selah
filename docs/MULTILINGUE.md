# Selah multilingue — ce qui a été fait et comment le vérifier

Production : https://selah-wheat.vercel.app

Selah parle douze langues : français, anglais, espagnol, portugais, italien,
allemand, russe, arabe, hébreu, chinois, japonais, coréen. Elles couvrent
l'essentiel du monde protestant et évangélique, y compris l'Afrique
francophone et anglophone, l'Amérique latine et l'Asie de l'Est.

## Trois couches, pas une

| Couche | Portée | Où |
|---|---|---|
| Interface | tous les écrans, toutes les chaînes | `src/i18n/` |
| Écriture | verset, référence, légende de chaque vidéo | `video_translations` |
| Voix | narration parlée des vidéos | variantes dans le bucket |

Une couche peut manquer sans casser les autres : l'hébreu a l'interface et
les écritures, pas la voix — le lecteur hébreu voit tout dans sa langue et
entend le français. C'est la dégradation voulue, jamais un écran vide.

## Comment la langue est choisie

1. **Première visite** : le proxy lit `x-vercel-ip-country` (géolocalisation
   IP fournie par Vercel) et applique la table pays → langue de
   `src/i18n/config.ts` (≈170 pays). Sans en-tête de pays, il retombe sur
   `Accept-Language`, puis sur l'anglais.
2. **Inscription** : le pays est un vrai choix, pas une devinette — liste
   déroulante pré-remplie par la géolocalisation, noms de pays affichés dans
   la langue courante via `Intl.DisplayNames`. Le choix bascule la langue
   immédiatement et s'enregistre dans `profiles.locale`.
3. **À tout moment** : le sélecteur (globe) présent sur chaque écran. Chaque
   langue y est écrite dans sa propre écriture — un lecteur coréen cherche
   « 한국어 », pas « Korean ».

Le tout tient dans un cookie `selah-locale` d'un an, lu côté serveur : la
première image peinte est déjà dans la bonne langue, sans clignotement.

## Droite à gauche

L'arabe et l'hébreu posent `dir="rtl"` sur `<html>`. Les marges et
positions passent par les propriétés logiques de Tailwind (`ps-`, `pe-`,
`start-`, `end-`) : la mise en page se retourne d'elle-même, il n'y a pas
deux feuilles de style à maintenir.

## Versets

Aucun verset n'est traduit par une IA. Chaque langue reçoit le texte d'une
traduction reconnue et libre de droits : King James, Reina-Valera, Almeida,
Riveduta, Luther, synodale russe, Van Dyck, Union chinoise, 口語訳,
개역한글, texte massorétique. La numérotation suit la tradition de chaque
langue — Psaume 34:19 devient Psalm 34:18 en anglais et Псалом 33:19 en
russe, parce que ces traditions ne comptent pas le titre du psaume de la
même façon.

## Voix

Dix langues doublées, 120 narrations. Deux voix en alternance (Sarah,
Roger), modèle `eleven_v3`. Chaque narration s'ouvre sur le verset de la
traduction établie et dure une vingtaine de secondes. Le texte gravé est
recomposé dans l'écriture de la langue, à la même place que le français.

Détail de la chaîne : `scripts/doublage/README.md`.

## Vérifier soi-même

```bash
# La langue suit le pays : en-tête de géolocalisation simulé
curl -sI https://selah-wheat.vercel.app/ -H "x-vercel-ip-country: KR" | grep -i set-cookie

# L'interface et le sens d'écriture suivent le cookie
curl -s https://selah-wheat.vercel.app/decouvrir -H "Cookie: selah-locale=ar" | grep -o '<html[^>]*'

# Le fil sert les versets de la langue
curl -s "https://ilqzmpcmahxxnbdrugyt.supabase.co/rest/v1/video_translations?select=lang,verse_ref&lang=eq.ko&limit=3" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```
