# Badge Photo Extractor

Application web **100% côté client** avec deux outils, accessibles par onglets :

- **Extraire depuis un PDF** — extrait les photos contenues dans un fichier PDF, pour préparer des photos de badges.
- **Recadrer une photo** — recadre une photo unique (upload ou déjà extraite d'un PDF) au bon format pour un badge, une carte d'étudiant, une licence sportive ou un trombinoscope.

⚠️ Aucun de ces deux outils n'est destiné à un usage administratif officiel (pas de photo de passeport ou de CNI, pas de conformité au format e-photo).

Aucune donnée n'est envoyée à un serveur : tout le traitement (lecture du PDF, extraction des images, détection de visage, recadrage, export ZIP/PDF) se fait dans le navigateur de l'utilisateur.

## Fonctionnement — Extraire depuis un PDF

1. **Upload** — l'utilisateur choisit un PDF (bouton ou glisser-déposer).
2. **Lecture** — [PDF.js](https://mozilla.github.io/pdf.js/) charge le PDF page par page.
3. **Extraction** — pour chaque page, on inspecte la liste d'opérateurs (`page.getOperatorList()`) à la recherche des instructions `paintImageXObject` / `paintImageXObjectRepeat`. Chaque image référencée est récupérée via `page.objs` (ou `page.commonObjs`), puis convertie en `<canvas>` (gestion des formats RGBA, RGB et niveaux de gris 1 bit, ainsi que des `ImageBitmap` déjà décodés par PDF.js).
4. **Filtrage** — les images de moins de 50×50 px (souvent des logos/icônes) sont masquées par défaut, avec une option pour les afficher.
5. **Galerie** — chaque photo extraite est affichée avec ses dimensions, sa page d'origine, une case de sélection et un bouton de téléchargement individuel.
6. **Détection du nom** — la position réelle de chaque image sur la page (calculée à partir de la matrice de transformation du PDF) est comparée au texte environnant (`page.getTextContent()`) pour retrouver le nom le plus proche (généralement sous la photo, sinon au-dessus). Le nom détecté est affiché dans un champ éditable — l'utilisateur peut le corriger si la détection se trompe — et sert de base au nom du fichier téléchargé.
7. **Recadrage badge** — un sélecteur permet de recadrer (centré, sur canvas) chaque photo au format 35×45 mm (photo d'identité), carré 1:1, ou de garder l'original. Le recadrage est appliqué au moment du téléchargement. Le bouton « 🖼️ Ajuster » sur chaque photo ouvre un éditeur de recadrage manuel (glisser pour repositionner, curseur pour zoomer) qui remplace le centrage automatique pour cette photo — le réglage est réutilisé pour le téléchargement individuel, le ZIP et le générateur de badges.
8. **Export** — téléchargement individuel en PNG, ou export groupé en ZIP (toutes les photos visibles, ou seulement la sélection) via [JSZip](https://stuk.github.io/jszip/).
9. **Générateur de badges imprimables** — le bouton « 🪪 Générer les badges (PDF) » ouvre un panneau permettant de choisir un format de carte (CR80 86×54 mm ou badge conférence 90×120 mm), un sous-titre commun et un logo d'entreprise, puis génère une planche PDF A4 (via [jsPDF](https://github.com/parallax/jsPDF)) avec autant de badges que possible par page et des repères de coupe aux 4 coins.

## Fonctionnement — Recadrer une photo

1. **Source** — l'utilisateur upload une photo (JPG/PNG, bouton ou glisser-déposer) ou choisit une photo déjà extraite dans l'onglet PDF (miniatures affichées si des photos existent).
2. **Détection de visage** — [MediaPipe Face Detection](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector) (modèle `blaze_face_short_range`, chargé en module ES depuis un CDN, exécuté 100% dans le navigateur via WebAssembly) propose un cadrage centré sur le visage détecté, avec le visage occupant environ 65% de la hauteur du cadre. **Si aucun visage n'est détecté (ou si le modèle ne charge pas), l'outil bascule silencieusement sur un cadrage centré simple** — jamais d'erreur bloquante.
3. **Ajustement manuel** — la suggestion automatique reste modifiable : glisser sur l'aperçu pour repositionner, curseur pour zoomer (souris et tactile).
4. **Formats** — 35×45 mm (badge standard), carré 1:1, 3:4, 2:3, ou dimensions personnalisées en mm. Export toujours à 300 DPI aux dimensions physiques choisies.
5. **Export** — téléchargement en PNG ou JPG haute qualité.
6. **Planche imprimable** — génère un PDF (10×15 cm ou A4) avec la photo répétée en grille et des repères de coupe aux 4 coins de chaque exemplaire, prêt pour un tirage chez un photographe.

Le modèle de détection de visage (quelques Mo) est téléchargé depuis les serveurs Google/jsDelivr au premier usage de l'outil — c'est le seul appel réseau de cette fonctionnalité : la photo de l'utilisateur, elle, n'est jamais envoyée où que ce soit.

Aucune bibliothèque n'est installée localement : PDF.js, JSZip, jsPDF et MediaPipe Tasks Vision sont chargés depuis un CDN (cdnjs / jsDelivr) directement dans `index.html`.

## Structure du projet

```
badge-photo-extractor/
├── index.html   # Structure de la page
├── style.css    # Design (dark mode par défaut, responsive)
├── script.js    # Logique d'extraction, recadrage et export
└── README.md
```

Aucune étape de build : le projet est un site statique prêt à l'emploi.

## Lancer en local

Ouvrir simplement `index.html` dans un navigateur, ou servir le dossier avec un petit serveur statique, par exemple :

```bash
npx serve .
```

## Déploiement sur Vercel

1. Pousser ce dossier (`badge-photo-extractor`) sur un dépôt GitHub.
2. Sur [vercel.com](https://vercel.com), cliquer sur **Add New → Project** et importer le dépôt.
3. Aucune configuration n'est nécessaire : Vercel détecte un projet statique (pas de framework, pas de commande de build). Laisser le *Build Command* et l'*Output Directory* vides/par défaut — `index.html` étant à la racine, Vercel le sert directement.
4. Déployer.

Alternative en une commande avec la CLI Vercel :

```bash
npm i -g vercel
vercel --prod
```

## Configurer le formulaire de contact (Web3Forms)

Le footer propose un bouton **« Me contacter »** qui ouvre un formulaire (Nom / Email / Message) envoyé via [Web3Forms](https://web3forms.com), sans backend.

1. Créer une clé d'accès gratuite sur [web3forms.com](https://web3forms.com) avec l'adresse email qui doit recevoir les messages.
2. Dans [`script.js`](script.js), remplacer la valeur de la constante en haut du fichier :
   ```js
   const WEB3FORMS_ACCESS_KEY = "METTRE_LA_CLE_ICI";
   ```
   par la clé obtenue.

Tant que cette clé n'est pas renseignée, le formulaire affiche un message d'erreur explicite au lieu d'envoyer la requête.

Le champ caché `botcheck` est l'anti-spam natif de Web3Forms (honeypot) : il ne doit pas être modifié.

## Lien LinkedIn

Dans [`index.html`](index.html), remplacer l'URL placeholder du lien LinkedIn du footer :

```html
<a id="linkedinLink" href="https://www.linkedin.com/in/PLACEHOLDER" ...>
```

par l'URL du profil réel.

## Confidentialité

Toutes les opérations sur les PDF et les photos (lecture, extraction, détection de visage, recadrage, génération du ZIP/PDF) s'exécutent dans le navigateur de l'utilisateur. Aucune photo, aucun fichier PDF n'est envoyé à un serveur — y compris après déploiement sur Vercel, qui ne fait que servir des fichiers statiques.

Deux exceptions, aucune ne concernant les photos de l'utilisateur :
- Le formulaire de contact envoie le nom, l'email et le message saisis à l'API de [Web3Forms](https://web3forms.com) (service tiers) au moment de l'envoi.
- L'outil « Recadrer une photo » télécharge le modèle de détection de visage (fichiers publics, quelques Mo) depuis les CDN Google/jsDelivr au premier usage.
