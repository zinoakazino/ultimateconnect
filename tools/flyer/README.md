# Flyers Istanbul — le programme et la carte

Génère les flyers imprimables du voyage à partir du fichier de données de la carte
([`istanbul-data.json`](../../src/features/istanbul/istanbul-data.json)). Rien n'est dessiné à la main : si vous changez un horaire, un lieu
ou un numéro, relancez la commande et les flyers sont à jour.

## Ce que vous obtenez : des flyers recto-verso de 95 × 200 mm

Les deux groupes du voyage ne volent pas aux mêmes heures : le flyer 1 existe donc **en deux versions, une par groupe**
(`Groupe 1`, `Groupe 2`, avec le nom du groupe et de la compagnie en bandeau blanc). Le flyer 2 (la carte) est identique pour tout le monde.

| | Recto | Verso |
|---|---|---|
| **Flyer 1 — « Le programme »**, version groupe 1 et version groupe 2 | **Le programme officiel du groupe**, jour par jour : **les vols de CE groupe** (rendez-vous à l'aéroport d'Alger, carte d'embarquement avec compagnie et bagages, arrivée à l'hôtel, check-out), puis formation, balade du Bosphore, journées libres, retour, avec le petit-déjeuner inclus bien en vue | **Temps libre** : des idées à cocher dont les horaires sont calés sur le programme officiel **de ce groupe** (soirée d'arrivée et dernière matinée seulement pour le groupe dont les vols laissent ces créneaux libres ; après la balade, journée libre en 3 options pour tous), et un cadre de notes |
| **Flyer 2 — « La carte »** | **La carte** du quartier de l'hôtel (cercles à 500 m / 1 km / 1,5 km, zone verte de 2 km, zones à éviter, lieux numérotés, tram T1, police touristique), vue d'ensemble jusqu'à 6 km, légende, règles du groupe | **Guide de poche** : urgence (112, phrase de taxi + adresse de l'hôtel, numéros du staff), les **30 suggestions à cocher**, arnaques à éviter, bon à savoir, mots de turc, « à remplir » (chambre, groupe de sortie), notes, appli (+ QR code) |

Les numéros et les couleurs des lieux sont les mêmes partout : sur la carte, dans les idées de temps libre et dans la liste de suggestions.

Chaque flyer est placé **3 fois sur une feuille A4 paysage**, avec des repères de coupe : on imprime recto-verso, on coupe en 3.
Pour ~31 personnes : 11 feuilles de chaque flyer.

## Fichiers produits (dossier `flyer/` à la racine du projet)

| Fichier | À quoi il sert |
|---|---|
| `1-programme-groupe1-A4-3-par-feuille.pdf`, `1-programme-groupe2-A4-3-par-feuille.pdf` | **À imprimer** : flyer 1 du groupe 1 / du groupe 2, 2 pages A4 paysage (recto puis verso), 3 par feuille |
| `2-carte-A4-3-par-feuille.pdf` | **À imprimer** : flyer 2 (pour les deux groupes), sans QR code |
| `2-carte-A4-3-par-feuille-avec-QR.pdf` | Flyer 2 avec un QR code vers l'appli (produit seulement quand `flyer.appUrl` est rempli) |
| `1-programme-groupe1-seul.pdf`, `1-programme-groupe2-seul.pdf`, `2-carte-seul.pdf` (+ `-avec-QR`) | Un seul flyer, 2 pages de 95 × 200 mm : pour une imprimerie |
| `apercu-….png` | Aperçus d'un flyer ; `apercu-feuille-….png` : aperçus de la feuille A4 |

## Imprimer

1. Papier **A4**, orientation **paysage** (le PDF le demande déjà), mise à l'échelle **100 %** (« taille réelle », pas « ajuster à la page »).
2. **Recto-verso, retourner sur le bord COURT.** Si le verso sort à l'envers, choisissez l'autre option (« bord long »).
3. Papier 120–170 g/m² conseillé (la carte et les bandeaux de couleur sont pleine page : un papier fin laisse transparaître le verso).
4. Coupez sur les repères noirs aux bords de la feuille : 2 coupes verticales (à 101 et 196 mm) et les marges. Pour une coupe nette,
   utilisez un massicot plutôt que des ciseaux.

Les imprimantes de bureau ne peuvent pas imprimer jusqu'au bord : les flyers sont donc placés à 5–6 mm du bord de la feuille et
n'ont **pas de fond perdu**. Si une imprimerie demande un fichier avec fond perdu, dites-le : c'est faisable.

## Reconstruire

Prérequis : Node.js, Google Chrome (ou Edge) installé, et une connexion Internet (le fond de carte est téléchargé à chaque fois).

```bash
cd tools/flyer
npm install          # la première fois seulement
npm run build        # tout (≈ 30 s) : PDF + aperçus des deux flyers
npm run build:noqr   # sans les variantes QR
npm run build:faces  # les pages de texte seulement, sans carte (≈ 5 s) : pratique en modifiant les textes
```

Le script affiche pour chaque page de texte si elle **tient** dans le flyer (et la marge qui reste, en mm) ou de combien elle dépasse,
et signale les noms trop longs dans la liste de suggestions. La carte est dessinée avec **MapLibre** et les tuiles vectorielles
gratuites d'**OpenFreeMap** (données © contributeurs OpenStreetMap, mention imprimée sur le flyer), sans clé d'API.

## Modifier le contenu

Tout vient de `src/features/istanbul/istanbul-data.json` :

- **Programme officiel** : `officialProgram` (voir le guide du dossier `src/features/istanbul`) : une entrée par jour, avec un `kind`
  (`travel`, `official`, `libre`, `tbd` = à confirmer) qui donne la couleur du jour, et des lignes `items` (heure, icône, texte).
  Un vol (`"kind": "flight"`) s'affiche comme une carte d'embarquement (`airline` et `baggage` s'impriment dessous).
  `"fill": true` laisse un trait à remplir au stylo (heure de départ pour l'aéroport, tant que le staff ne l'a pas donnée).
  `breakfast` ajoute la tasse du petit-déjeuner au jour.
- **Un flyer par groupe** : `officialProgram.groups` liste les groupes (`id`, `name`, `airline`) ; une ligne avec `"group": 1`
  n'est imprimée que sur le flyer du groupe 1, une ligne sans `group` est sur tous les flyers. Les horaires des deux groupes se
  changent donc à un seul endroit. (Sans `groups` dans les données : un seul flyer 1, avec toutes les lignes.)
  Chaque page du programme est pleine : le script dit si elle tient encore après un ajout (une ligne de plus coûte ≈ 3 mm).
- **Idées de temps libre** : `programs`. Chaque programme a un `day` (date) : il se place sous ce jour du verso du flyer 1. Plusieurs
  programmes le même jour = des options (`option` : « A », « B »…). `"group": 1` : seulement sur le flyer de ce groupe (la soirée
  d'arrivée et la dernière matinée n'existent que pour le groupe dont les vols laissent ces créneaux libres) ; un avertissement qui
  commence par « Groupe 2 : » n'est imprimé que pour ce groupe. Les horaires sont libres : ils doivent seulement tenir dans le
  temps libre du programme officiel (le script ne le vérifie pas).
- **Numéros du staff** : `emergency.staff[].phone`. Vides, ils s'impriment comme une ligne à remplir au stylo.
- **Lieux** : le champ facultatif `short` est le nom compact imprimé dans les listes (≈ 18 caractères maximum dans les suggestions).
  Les numéros suivent l'ordre des catégories puis des lieux dans le fichier : **ajouter ou retirer un lieu renumérote tout**
  (donc les anciens flyers ne correspondent plus : réimprimez).
- **Conseils, arnaques, mots de turc, adresse du QR** : `flyer.tips`, `flyer.scams`, `flyer.phrases`, `flyer.appUrl`.
- **Dates** : `meta.trip` (écrit sur les flyers).

Réglages dans le code :

- `build-flyer.js` → `options.mainBounds` (zone montrée par la carte principale) et `insetHalfKm` (étendue de la vue d'ensemble).
- `flyer.js` → `AREAS` / `FAR_AREAS` : les quartiers écrits sur la carte et la vue d'ensemble (nom, latitude, longitude). Chaque nom se
  décale vers la place libre la plus proche et disparaît s'il n'y en a pas.
- `flyer.css` → tailles, couleurs et espacements (tout est en mm / pt).

## QR code

Le QR code (verso du flyer 2) pointe vers `flyer.appUrl`, dans le fichier de données : **l'adresse de l'application en ligne**
(par exemple `https://ultimate-connect.onrender.com`). Tant que `appUrl` est vide, aucune version « avec QR » n'est produite.
Une fois l'application publiée sur Render, écrivez son adresse dans `appUrl` et relancez `npm run build`. Le QR est dessiné en
carrés pleins (10,4 mm, avec marge blanche) et a été relu avec un décodeur à partir du PDF.

## Comment ça marche (pour les curieux)

`build-flyer.js` lance un petit serveur local et ouvre `flyer.html` dans Chrome sans fenêtre (Puppeteer). `flyer.js` y dessine la
carte avec MapLibre, superpose les cercles, zones et repères en SVG (les repères trop proches sont écartés avec un petit trait vers
leur vraie position), place les étiquettes là où il reste de la place, puis construit les pages de texte en HTML. Chrome imprime
ensuite chaque page en PDF : le texte et les traits restent vectoriels, seule la carte est une image (≈ 380 dpi).
