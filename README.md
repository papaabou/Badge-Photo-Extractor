# Badge Photo Extractor

Application web **100% côté client** qui extrait les photos contenues dans un fichier PDF, pour préparer des photos de badges. Aucune donnée n'est envoyée à un serveur : tout le traitement (lecture du PDF, extraction des images, recadrage, export ZIP) se fait dans le navigateur de l'utilisateur.

## Fonctionnement

1. **Upload** — l'utilisateur choisit un PDF (bouton ou glisser-déposer).
2. **Lecture** — [PDF.js](https://mozilla.github.io/pdf.js/) charge le PDF page par page.
3. **Extraction** — pour chaque page, on inspecte la liste d'opérateurs (`page.getOperatorList()`) à la recherche des instructions `paintImageXObject` / `paintImageXObjectRepeat`. Chaque image référencée est récupérée via `page.objs` (ou `page.commonObjs`), puis convertie en `<canvas>` (gestion des formats RGBA, RGB et niveaux de gris 1 bit, ainsi que des `ImageBitmap` déjà décodés par PDF.js).
4. **Filtrage** — les images de moins de 50×50 px (souvent des logos/icônes) sont masquées par défaut, avec une option pour les afficher.
5. **Galerie** — chaque photo extraite est affichée avec ses dimensions, sa page d'origine, une case de sélection et un bouton de téléchargement individuel.
6. **Détection du nom** — la position réelle de chaque image sur la page (calculée à partir de la matrice de transformation du PDF) est comparée au texte environnant (`page.getTextContent()`) pour retrouver le nom le plus proche (généralement sous la photo, sinon au-dessus). Le nom détecté est affiché dans un champ éditable — l'utilisateur peut le corriger si la détection se trompe — et sert de base au nom du fichier téléchargé.
7. **Recadrage badge** — un sélecteur permet de recadrer (centré, sur canvas) chaque photo au format 35×45 mm (photo d'identité), carré 1:1, ou de garder l'original. Le recadrage est appliqué au moment du téléchargement. Le bouton « 🖼️ Ajuster » sur chaque photo ouvre un éditeur de recadrage manuel (glisser pour repositionner, curseur pour zoomer) qui remplace le centrage automatique pour cette photo — le réglage est réutilisé pour le téléchargement individuel, le ZIP et le générateur de badges.
8. **Export** — téléchargement individuel en PNG, ou export groupé en ZIP (toutes les photos visibles, ou seulement la sélection) via [JSZip](https://stuk.github.io/jszip/).
9. **Générateur de badges imprimables** — le bouton « 🪪 Générer les badges (PDF) » ouvre un panneau permettant de choisir un format de carte (CR80 86×54 mm ou badge conférence 90×120 mm), un sous-titre commun, un logo d'entreprise et un QR code optionnel (encodant le nom de la personne), puis génère une planche PDF A4 (via [jsPDF](https://github.com/parallax/jsPDF)) avec autant de badges que possible par page et des repères de coupe aux 4 coins. Le QR code est généré localement avec [qrcodejs](https://github.com/davidshimjs/qrcodejs) — aucune donnée n'y transite.

Aucune bibliothèque n'est installée localement : PDF.js, JSZip, jsPDF et qrcodejs sont chargés depuis un CDN (cdnjs) directement dans `index.html`.

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

Toutes les opérations liées aux PDF (lecture, extraction, recadrage, génération du ZIP) s'exécutent dans le navigateur de l'utilisateur. Aucune photo, aucun fichier PDF n'est envoyé à un serveur — y compris après déploiement sur Vercel, qui ne fait que servir des fichiers statiques.

Seule exception : le formulaire de contact envoie le nom, l'email et le message saisis à l'API de [Web3Forms](https://web3forms.com) (service tiers) au moment de l'envoi — aucune autre donnée du site n'y transite.
