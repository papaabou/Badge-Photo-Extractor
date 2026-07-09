# Badge Photo Extractor

Application web **100% côté client** qui extrait les photos contenues dans un fichier PDF, pour préparer des photos de badges. Aucune donnée n'est envoyée à un serveur : tout le traitement (lecture du PDF, extraction des images, recadrage, export ZIP) se fait dans le navigateur de l'utilisateur.

## Fonctionnement

1. **Upload** — l'utilisateur choisit un PDF (bouton ou glisser-déposer).
2. **Lecture** — [PDF.js](https://mozilla.github.io/pdf.js/) charge le PDF page par page.
3. **Extraction** — pour chaque page, on inspecte la liste d'opérateurs (`page.getOperatorList()`) à la recherche des instructions `paintImageXObject` / `paintImageXObjectRepeat`. Chaque image référencée est récupérée via `page.objs` (ou `page.commonObjs`), puis convertie en `<canvas>` (gestion des formats RGBA, RGB et niveaux de gris 1 bit, ainsi que des `ImageBitmap` déjà décodés par PDF.js).
4. **Filtrage** — les images de moins de 50×50 px (souvent des logos/icônes) sont masquées par défaut, avec une option pour les afficher.
5. **Galerie** — chaque photo extraite est affichée avec ses dimensions, sa page d'origine, une case de sélection et un bouton de téléchargement individuel.
6. **Recadrage badge** — un sélecteur permet de recadrer (centré, sur canvas) chaque photo au format 35×45 mm (photo d'identité), carré 1:1, ou de garder l'original. Le recadrage est appliqué au moment du téléchargement.
7. **Export** — téléchargement individuel en PNG, ou export groupé en ZIP (toutes les photos visibles, ou seulement la sélection) via [JSZip](https://stuk.github.io/jszip/).

Aucune bibliothèque n'est installée localement : PDF.js et JSZip sont chargés depuis un CDN (cdnjs) directement dans `index.html`.

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

## Confidentialité

Toutes les opérations (lecture du PDF, extraction, recadrage, génération du ZIP) s'exécutent dans le navigateur de l'utilisateur. Aucune photo, aucun fichier PDF n'est envoyé à un serveur — y compris après déploiement sur Vercel, qui ne fait que servir des fichiers statiques.
