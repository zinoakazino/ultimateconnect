# Carte Istanbul — guide de modification

Tout le contenu de la carte est dans **un seul fichier** : [`istanbul-data.json`](./istanbul-data.json).
Les lieux, les zones, les programmes, les numéros d'urgence et les règles du groupe y sont écrits à la main ;
l'application les affiche sans rien d'autre à changer.

Après chaque modification, lancez la vérification (elle détecte les fautes de frappe) :

```bash
npm run map:check
```

Puis relancez l'application (`npm start`) ou reconstruisez le site (`npm run build:web`).

> ⚠️ Un JSON se casse facilement : gardez les guillemets `"..."`, les virgules entre les éléments
> (mais **pas** après le dernier) et les accolades `{ }`. `npm run map:check` vous dit où est l'erreur.

---

## Où trouver quoi

| Je veux… | Section du fichier |
|---|---|
| Changer l'hôtel (nom, adresse, position) | `hotel` |
| Ajouter / retirer un lieu sur la carte | `places` |
| Déplacer ou redimensionner une zone | `zones` |
| Ajouter une catégorie de lieux | `categories` |
| Modifier une idée de sortie (programme libre) | `programs` |
| Modifier le programme officiel du groupe (vols, formation…) | `officialProgram` |
| Renseigner les numéros du staff | `emergency.staff` |
| Modifier les arnaques / les règles | `emergency.scams` / `rules` |
| Écrire ou corriger l'arabe de la carte | [`istanbul-data.ar.json`](./istanbul-data.ar.json) (voir « Les textes en arabe ») |
| Imprimer le programme et la carte en flyers | `tools/flyer/README.md` (utilise `officialProgram`, `programs`, `short` et `flyer`) |

---

## Ajouter un lieu

Dans `places`, copiez un bloc existant et changez les valeurs :

```json
{
  "id": "mon-lieu",
  "name": "Nom affiché",
  "category": "restaurants",
  "lat": 41.0123,
  "lng": 28.9765,
  "description": "Une ou deux phrases pour dire ce que c'est.",
  "tip": "Un conseil pratique (horaires, réservation, attention à…).",
  "price": "€€",
  "zone": "verte",
  "osmQuery": "Nom du lieu, Fatih, İstanbul",
  "verified": false
}
```

- **`id`** : unique, en minuscules, sans espaces (utilisez des tirets). C'est ce que les programmes utilisent pour désigner le lieu.
- **`category`** : `sites`, `restaurants`, `desserts`, `shopping`, `balades` ou `pratique`.
- **`lat` / `lng`** : la position. Pour la trouver : sur Google Maps, faites un appui long sur le lieu, puis copiez les deux nombres
  (`41.0086, 28.9802` → `lat` = 41.0086, `lng` = 28.9802).
- **`price`** : `Gratuit`, `€`, `€€` ou `€€€`.
- **`zone`** : `verte` (à moins de 2 km de l'hôtel), `orange` (jusqu'à 6 km, en transport) ou `staff` (au-delà, uniquement avec le staff).
  `npm run map:check` vous prévient si la zone ne correspond pas à la distance réelle.
- **`short`** (facultatif) : nom compact imprimé dans les listes du flyer (≈ 18 caractères maximum). Sans lui, le flyer utilise `name`.
- **`osmQuery`** et **`verified`** : voir « Vérifier les coordonnées » plus bas. Mettez `verified` à `false` tant que vous n'avez pas contrôlé la position.

Pour **retirer** un lieu, supprimez son bloc (et retirez-le des `programs` s'il y figure : `npm run map:check` le signale).

## Déplacer une zone ou changer un rayon

Les zones sont dans `zones`.

- **Les deux grands cercles** (`verte` et `orange`) sont centrés sur l'hôtel (`"center": "hotel"`). Pour changer leur taille, modifiez `radius`
  (en **mètres**) : `2000` = 2 km, `6000` = 6 km. Les couleurs, la légende et le message « Où suis-je ? » suivent automatiquement.
- **Les zones à éviter / de prudence** ont leur propre position (`lat`, `lng`) et leur `radius`. Pour les déplacer, changez `lat` et `lng`.
- `kind` donne la couleur : `eviter` (rouge) ou `prudence` (ambre).
- `message` est le texte affiché quand on touche la zone.

Pour **ajouter** une zone, copiez un bloc existant (ex. `tarlabasi`), donnez-lui un `id` unique, une position, un rayon et un message.

## Modifier un programme

Dans `programs`, chaque programme est une liste d'`stops` dans l'ordre. Une étape peut désigner :

- un **lieu** : `{ "time": "09:00", "place": "ayasofya" }` ;
- un **point de transport** (embarcadère, arrêt de tram… défini dans `transportStops`) : `{ "time": "10:00", "transport": "eminonu-ferry", "label": "Ferry Eminönü → Kadıköy" }` ;
- le **retour à l'hôtel** : `{ "time": "22:00", "hotel": true, "label": "Retour à l'hôtel avant 22h00" }`.

Champs facultatifs : `label` (remplace le nom affiché) et `note` (petite précision sous le nom). Laissez `"time": ""` si aucune heure n'est conseillée.

Les `warnings` d'un programme apparaissent en jaune en haut de sa fiche (jour de fermeture, prière du vendredi…).

### Programmes et temps libre

Chaque programme de `programs` est une **idée de sortie** qui se place dans un temps libre du programme officiel. Deux champs facultatifs
l'y rattachent : `day` (la date, `"2026-11-08"`) et `option` (`"A"`, `"B"`… quand plusieurs idées se disputent le même jour).
Le flyer les range par jour ; l'application affiche la liste telle quelle. Les horaires doivent tenir dans le temps libre du programme
officiel. Un `warning` court (≤ 70 caractères) s'imprime sur le flyer ; les longs ne s'affichent que dans l'application.

## Programme officiel du groupe

`officialProgram` décrit le programme que le staff impose (vols, formation, balade…). Il est imprimé sur le flyer « Le programme »
(voir `tools/flyer/README.md`) :

```json
{
  "id": "formation",
  "date": "2026-11-06",
  "kind": "official",
  "title": "Formation & Bosphore",
  "breakfast": true,
  "items": [
    { "time": "Matin", "icon": "school", "text": "Réunion Ultimate (formation)…" },
    { "time": "13:00", "icon": "boat", "text": "En route pour la balade du Bosphore" },
    { "time": "≈ 17:00", "icon": "sun", "free": true, "text": "Fin de la balade (idées au verso)" }
  ]
}
```

- **`kind`** : `travel` (vols), `official` (organisé par le staff), `libre` (journée libre) ou `tbd` (pas encore décidé : s'affiche « À confirmer »).
- **Ligne `items`** : `time` (affiché tel quel), `icon` (`hotel`, `school`, `boat`, `mosque`, `sun`, `help`, `suitcase`, `coffee`), `text`, `free` (pastille « Libre »),
  `fill` (laisse un trait à remplir au stylo, `after` = petit texte à côté).
- **Vol** : `{ "group": 1, "kind": "flight", "airline": "Air Algérie", "baggage": "2 × 23 kg en soute + 10 kg en cabine", "from": "Alger", "to": "Istanbul (IST)", "dep": "09:40", "arr": "15:15" }`
  (heures locales). Le `group` (facultatif) dit pour quel groupe est la ligne : chaque groupe a son propre flyer, une ligne sans
  `group` est sur tous. Les groupes sont déclarés dans `officialProgram.groups` (`id`, `name`, `airline`). Les vols réels de chaque
  groupe vivent aussi dans la base de l'appli (`trip_groups`, voir le README du projet) : si un horaire change, changez-le aux
  deux endroits (ici pour les flyers, dans la base pour l'appli).
- Un programme de temps libre (`programs`) peut avoir `"group": 1` : il n'est alors que sur le flyer de ce groupe.
- **`breakfast`** : `true` ajoute la tasse « petit-déjeuner inclus » au jour.

`npm run map:check` vérifie les dates, les types de jour et les vols.

## Renseigner les numéros du staff

Dans `emergency.staff`, remplissez `phone` (format international, avec l'indicatif du pays) :

```json
{ "name": "Hichem", "phone": "+213 555 12 34 56" }
```

Tant que `phone` est vide, l'écran Urgence affiche « Numéro bientôt disponible ».
Les contacts que le staff ajoute dans l'application (Profil → Gérer le voyage → Urgences et contacts) s'affichent aussi dans cet écran.

## Les textes en arabe

L'application existe en français et en arabe, et chacun change de langue quand il veut. Le français est dans
`istanbul-data.json` ; l'arabe est dans [`istanbul-data.ar.json`](./istanbul-data.ar.json), un fichier « jumeau »
qui reprend les mêmes identifiants (les positions, prix, zones et horaires ne sont écrits qu'une fois, dans le fichier français) :

| Dans `istanbul-data.json` | Son arabe dans `istanbul-data.ar.json` |
|---|---|
| un lieu (`id`) | `places.<id>` : `name`, `description`, `tip` |
| une idée de sortie (`id`) | `programs.<id>` : `title`, `tagline`, `mode`, `warnings` (le même nombre), `stops` (le même ordre : `label`, `note`) |
| une zone, une catégorie, un arrêt de transport | `zones.<id>` (`name`, `message`), `categories.<id>`, `transportStops.<id>` |
| un point de retour | `safeAnchors.<nom français>` |
| les règles du groupe, les arnaques, les rôles du staff | `rules` (le même nombre), `emergency.scams` (même ordre), `emergency.staffRoles.<rôle>` |

Quand vous **ajoutez un lieu ou une idée**, ajoutez aussi son arabe dans ce fichier : `npm run map:check` échoue
(`✗ arabe : … n'a pas de traduction`) tant qu'un texte français n'a pas son jumeau, pour qu'aucun lieu ne parte à moitié traduit.
Les noms de marques ou de restaurants peuvent rester en lettres latines. Les textes de l'application (boutons, messages
« Où suis-je ? »…) sont dans `src/i18n/locales/fr.json` et `ar.json`. Les flyers imprimés restent en français.

## Vérifier les coordonnées

Les coordonnées de départ venaient d'un brief approximatif. Elles ont été contrôlées avec OpenStreetMap (voir `meta.coordinatesCheckedOn`).
Pour contrôler de nouveau (à faire seulement quand vous changez des positions — le service demande de ne pas l'interroger en boucle) :

```bash
npm run map:verify
```

Le script compare chaque position à OpenStreetMap, affiche l'écart en mètres et écrit `tools/map/verify-report.json`.
Il **ne modifie pas** le fichier de données : c'est à vous de corriger les positions qui s'écartent, puis de mettre `verified` à `true`.
Un lieu `verified: false` affiche « Position approximative » dans sa fiche.

## Comment ça marche (pour les curieux)

- La carte est **Leaflet + OpenStreetMap**, sans clé d'API. Leaflet est embarqué dans l'application (`leafletBundle.ts`), donc seule l'image du fond de carte demande une connexion.
- Les listes, programmes, zones et l'écran Urgence sont dans l'application : ils s'ouvrent **sans connexion**.
- « Où suis-je ? » utilise le GPS du téléphone, **uniquement sur le téléphone** : la position n'est pas envoyée au staff (le partage volontaire se règle dans Profil).
- Sur téléphone, la carte s'affiche dans une WebView ; sur le web, dans un iframe. Le code est le même (`mapHtml.ts`).

## Limites

- Le fond de carte (les tuiles) a besoin d'Internet. Pour naviguer hors ligne, téléchargez Istanbul dans Google Maps (« Cartes hors connexion »).
- Les tuiles viennent des serveurs publics d'OpenStreetMap, prévus pour un usage léger (un groupe de ~30 personnes convient).
- Les itinéraires s'ouvrent dans Google Maps (aucune clé requise).
