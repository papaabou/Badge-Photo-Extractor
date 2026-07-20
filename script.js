/* ===========================================================
   Badge Photo Extractor
   Extraction des photos embarquées dans un PDF, 100% côté client.
   Utilise PDF.js pour lire le PDF et JSZip pour l'export groupé.
   =========================================================== */

/* Configuration du worker PDF.js (nécessaire pour le décodage) */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* Seuil en dessous duquel une image est considérée comme une icône/logo */
const MIN_DIMENSION = 50;

/* Formats de recadrage disponibles pour les badges */
const BADGE_FORMATS = {
  id35x45: { ratio: 35 / 45, outW: 413, outH: 531 }, // 35x45 mm ~ 300 dpi
  square: { ratio: 1, outW: 600, outH: 600 },
};

/* Clé d'accès Web3Forms pour le formulaire de contact.
   Créez une clé gratuite sur https://web3forms.com avec votre adresse email,
   puis remplacez la valeur ci-dessous par la clé obtenue. */
const WEB3FORMS_ACCESS_KEY = "a44fccb0-5418-4d81-8c85-8d5e73b89c4d";

/* Formats de cartes disponibles pour le générateur de badges imprimables (en mm) */
const BADGE_CARD_FORMATS = {
  cr80: { widthMm: 86, heightMm: 54, orientation: "landscape" },
  conference: { widthMm: 90, heightMm: 120, orientation: "portrait" },
};

/* Résolution de rendu des badges (pixels par mm) avant export en PDF */
const BADGE_RENDER_SCALE = 8;

/* ---------- Références DOM ---------- */

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const fileInfo = document.getElementById("fileInfo");
const errorMessage = document.getElementById("errorMessage");

const optionsPanel = document.getElementById("optionsPanel");
const badgeFormatSelect = document.getElementById("badgeFormat");
const showSmallImagesCheckbox = document.getElementById("showSmallImages");

const progressSection = document.getElementById("progressSection");
const progressLabel = document.getElementById("progressLabel");
const progressBarFill = document.getElementById("progressBarFill");

const galleryToolbar = document.getElementById("galleryToolbar");
const galleryCount = document.getElementById("galleryCount");
const selectAllBtn = document.getElementById("selectAllBtn");
const deselectAllBtn = document.getElementById("deselectAllBtn");
const downloadSelectionBtn = document.getElementById("downloadSelectionBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");

const emptyState = document.getElementById("emptyState");
const gallery = document.getElementById("gallery");
const photoCardTemplate = document.getElementById("photoCardTemplate");

const footerEmail = document.getElementById("footerEmail");
const copyEmailBtn = document.getElementById("copyEmailBtn");

const openContactBtn = document.getElementById("openContactBtn");
const closeContactBtn = document.getElementById("closeContactBtn");
const contactModalOverlay = document.getElementById("contactModalOverlay");
const contactForm = document.getElementById("contactForm");
const contactSubmitBtn = document.getElementById("contactSubmitBtn");
const contactFeedback = document.getElementById("contactFeedback");

const openBadgeGeneratorBtn = document.getElementById("openBadgeGeneratorBtn");
const closeBadgeGeneratorBtn = document.getElementById("closeBadgeGeneratorBtn");
const badgeGeneratorOverlay = document.getElementById("badgeGeneratorOverlay");
const badgeGeneratorCount = document.getElementById("badgeGeneratorCount");
const badgeGeneratorForm = document.getElementById("badgeGeneratorForm");
const badgeCardFormatSelect = document.getElementById("badgeCardFormat");
const badgeSubtitleInput = document.getElementById("badgeSubtitle");
const badgeLogoInput = document.getElementById("badgeLogoInput");
const badgeLogoBtn = document.getElementById("badgeLogoBtn");
const badgeLogoPreview = document.getElementById("badgeLogoPreview");
const badgeLogoRemoveBtn = document.getElementById("badgeLogoRemoveBtn");
const badgeGenerateBtn = document.getElementById("badgeGenerateBtn");
const badgeGeneratorFeedback = document.getElementById("badgeGeneratorFeedback");
const badgePreviewCanvas = document.getElementById("badgePreviewCanvas");

const closeCropAdjustBtn = document.getElementById("closeCropAdjustBtn");
const cropAdjustOverlay = document.getElementById("cropAdjustOverlay");
const cropAdjustHint = document.getElementById("cropAdjustHint");
const cropAdjustCanvas = document.getElementById("cropAdjustCanvas");
const cropZoomRange = document.getElementById("cropZoomRange");
const cropResetBtn = document.getElementById("cropResetBtn");
const cropCancelBtn = document.getElementById("cropCancelBtn");
const cropApplyBtn = document.getElementById("cropApplyBtn");

const tabPdfBtn = document.getElementById("tabPdfBtn");
const tabPhotoBtn = document.getElementById("tabPhotoBtn");
const pdfToolPanel = document.getElementById("pdfToolPanel");
const photoToolPanel = document.getElementById("photoToolPanel");

const ppbDropzone = document.getElementById("ppbDropzone");
const ppbFileInput = document.getElementById("ppbFileInput");
const ppbChooseBtn = document.getElementById("ppbChooseBtn");
const ppbErrorMessage = document.getElementById("ppbErrorMessage");
const ppbFromGalleryWrap = document.getElementById("ppbFromGalleryWrap");
const ppbFromGalleryStrip = document.getElementById("ppbFromGalleryStrip");
const ppbWorkspace = document.getElementById("ppbWorkspace");
const ppbEmptyState = document.getElementById("ppbEmptyState");
const ppbFormatSelect = document.getElementById("ppbFormat");
const ppbCustomFields = document.getElementById("ppbCustomFields");
const ppbCustomWidthInput = document.getElementById("ppbCustomWidth");
const ppbCustomHeightInput = document.getElementById("ppbCustomHeight");
const ppbFaceStatus = document.getElementById("ppbFaceStatus");
const ppbCanvas = document.getElementById("ppbCanvas");
const ppbZoomRange = document.getElementById("ppbZoomRange");
const ppbResetBtn = document.getElementById("ppbResetBtn");
const ppbDownloadPngBtn = document.getElementById("ppbDownloadPngBtn");
const ppbDownloadJpgBtn = document.getElementById("ppbDownloadJpgBtn");
const ppbSheetFormatSelect = document.getElementById("ppbSheetFormat");
const ppbGenerateSheetBtn = document.getElementById("ppbGenerateSheetBtn");
const ppbSheetFeedback = document.getElementById("ppbSheetFeedback");

/* ---------- État de l'application ---------- */

let photos = []; // { id, canvas, width, height, pageNum, indexInPage, selected, small, name, crop }
let photoIdCounter = 0;
let badgeLogoImage = null; // <img> chargée depuis le fichier logo uploadé (ou null)

/* ===========================================================
   Gestion de l'upload (clic + drag & drop)
   =========================================================== */

chooseFileBtn.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    handleFile(fileInput.files[0]);
  }
});

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

/* ===========================================================
   Traitement du fichier PDF
   =========================================================== */

/* Détecte une image à partir du type MIME, avec repli sur l'extension du fichier :
   selon le système d'exploitation, file.type peut être vide ou absent (notamment pour
   certains JPEG sous Windows), donc s'y fier seul fait passer de vraies images pour
   des fichiers invalides. */
function isImageFile(file) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name);
}

function handleFile(file) {
  hideError();

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    if (isImageFile(file)) {
      // Une image seule (JPG/PNG) : on bascule directement sur l'outil de recadrage
      // dédié plutôt que d'obliger l'utilisateur à trouver le bon onglet lui-même.
      activateTab("photo");
      handlePpbFile(file);
      return;
    }
    showError("Le fichier sélectionné n'est ni un PDF ni une image. Merci de choisir un fichier .pdf, .jpg ou .png.");
    return;
  }

  fileInfo.textContent = `Fichier : ${file.name} (${formatFileSize(file.size)})`;
  resetGallery();
  optionsPanel.hidden = false;

  extractPhotosFromPdf(file);
}

async function extractPhotosFromPdf(file) {
  showProgress(0, "Lecture du fichier…");

  let pdf;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
  } catch (err) {
    hideProgress();
    showError("Impossible de lire ce PDF : le fichier est corrompu ou invalide.");
    return;
  }

  const numPages = pdf.numPages;

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      progressLabel.textContent = `Extraction en cours… page ${pageNum} / ${numPages}`;
      const page = await pdf.getPage(pageNum);
      await extractImagesFromPage(page, pageNum);
      updateProgress(Math.round((pageNum / numPages) * 100));
    }
  } catch (err) {
    hideProgress();
    showError("Une erreur est survenue pendant l'extraction des images de ce PDF.");
    return;
  }

  hideProgress();

  if (photos.length === 0) {
    showError("Aucune photo n'a été trouvée dans ce PDF.");
    return;
  }

  renderGallery();
}

/* Extrait les images d'une page via les instructions bas niveau de PDF.js,
   et associe à chaque image le nom de personne trouvé à proximité dans le texte de la page. */
async function extractImagesFromPage(page, pageNum) {
  const operatorList = await page.getOperatorList();
  const textLines = await getPageTextLines(page);

  const seenNames = new Set();
  const pageImages = []; // { canvas, bbox, isSmall }

  // Simulation de la pile graphique (save/restore/cm) pour connaître
  // la position réelle (CTM) de chaque image sur la page
  let ctm = [1, 0, 0, 1, 0, 0];
  const ctmStack = [];

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      ctmStack.push(ctm);
      continue;
    }
    if (fn === pdfjsLib.OPS.restore) {
      ctm = ctmStack.pop() || ctm;
      continue;
    }
    if (fn === pdfjsLib.OPS.transform) {
      ctm = multiplyMatrix(args, ctm);
      continue;
    }

    const isImageOp =
      fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintImageXObjectRepeat;
    if (!isImageOp) continue;

    const imgName = args[0];
    if (!imgName || seenNames.has(imgName)) continue;
    seenNames.add(imgName);

    const imgObj = await getPdfImageObject(page, imgName);
    if (!imgObj) continue;

    const canvas = imageObjectToCanvas(imgObj);
    if (!canvas || canvas.width === 0 || canvas.height === 0) continue;

    pageImages.push({
      canvas,
      bbox: imageBoundingBox(ctm),
      isSmall: canvas.width < MIN_DIMENSION || canvas.height < MIN_DIMENSION,
    });
  }

  // Chaque ligne de texte n'est utilisée que pour une seule photo au maximum,
  // pour éviter qu'un même nom se retrouve dupliqué sur plusieurs photos voisines.
  const assignedNames = assignNamesToImages(pageImages, textLines);

  pageImages.forEach((img, idx) => {
    photos.push({
      id: ++photoIdCounter,
      canvas: img.canvas,
      width: img.canvas.width,
      height: img.canvas.height,
      pageNum,
      indexInPage: idx + 1,
      selected: true,
      small: img.isSmall,
      name: assignedNames[idx] || "",
      crop: { x: 0.5, y: 0.5, zoom: 1 }, // centre normalisé (0-1) + zoom du cadre de recadrage
    });
  });
}

/* Récupère et regroupe le texte de la page en lignes, pour la détection des noms */
async function getPageTextLines(page) {
  try {
    const textContent = await page.getTextContent();
    return groupTextIntoLines(textContent.items);
  } catch (err) {
    return [];
  }
}

/* Multiplie une matrice de transformation PDF [a,b,c,d,e,f] par la CTM courante */
function multiplyMatrix(m, ctm) {
  return [
    m[0] * ctm[0] + m[1] * ctm[2],
    m[0] * ctm[1] + m[1] * ctm[3],
    m[2] * ctm[0] + m[3] * ctm[2],
    m[2] * ctm[1] + m[3] * ctm[3],
    m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
    m[4] * ctm[1] + m[5] * ctm[3] + ctm[5],
  ];
}

/* Transforme le point (x, y) par la matrice m */
function applyMatrix(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/* Une image est peinte dans le carré unité (0,0)-(1,1) transformé par la CTM courante */
function imageBoundingBox(ctm) {
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].map(([x, y]) => applyMatrix(ctm, x, y));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/* Regroupe les fragments de texte de la page en blocs (même ligne ET proches horizontalement),
   pour éviter de fusionner deux étiquettes voisines situées à la même hauteur (ex: deux badges côte à côte). */
function groupTextIntoLines(items) {
  const Y_TOLERANCE = 2.5;
  // Volontairement serré : un espace entre deux mots d'un même nom est petit,
  // alors que l'écart entre deux étiquettes voisines (deux personnes différentes
  // sur la même ligne) est presque toujours plus grand.
  const X_GAP_TOLERANCE = 10;

  const fragments = items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
      height: item.height || 10,
      str: item.str,
    }))
    .sort((a, b) => (Math.abs(a.y - b.y) < Y_TOLERANCE ? a.x - b.x : b.y - a.y));

  const lines = [];

  for (const frag of fragments) {
    let line = lines.find(
      (l) =>
        Math.abs(l.y - frag.y) < Y_TOLERANCE &&
        frag.x <= l.maxX + X_GAP_TOLERANCE &&
        frag.x + frag.width >= l.minX - X_GAP_TOLERANCE
    );
    if (!line) {
      line = { y: frag.y, minX: frag.x, maxX: frag.x + frag.width, height: frag.height, parts: [] };
      lines.push(line);
    } else {
      line.minX = Math.min(line.minX, frag.x);
      line.maxX = Math.max(line.maxX, frag.x + frag.width);
      line.height = Math.max(line.height, frag.height);
    }
    line.parts.push({ x: frag.x, str: frag.str });
  }

  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x);
    line.text = line.parts
      .map((p) => p.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return lines.filter((l) => l.text.length > 0);
}

/* Associe chaque image à la ligne de texte la plus proche (nom), de façon EXCLUSIVE :
   une même ligne ne peut servir de nom qu'à une seule photo, pour éviter les doublons
   quand plusieurs photos sont alignées côte à côte près d'une même étiquette.
   Étend ensuite le nom trouvé avec les lignes empilées juste à côté (ex: nom de famille
   sur une ligne, prénom sur la ligne suivante), toujours sans réutiliser une ligne déjà prise. */
function assignNamesToImages(images, lines) {
  const candidates = [];

  const overlapMarginFor = (bbox) => Math.max(10, (bbox.maxX - bbox.minX) * 0.15);

  images.forEach((img, imgIdx) => {
    const bbox = img.bbox;
    const bboxHeight = bbox.maxY - bbox.minY;
    const maxGap = Math.max(30, bboxHeight * 0.5);
    const overlapMargin = overlapMarginFor(bbox);

    lines.forEach((line, lineIdx) => {
      const lineCenterX = (line.minX + line.maxX) / 2;
      const withinX = lineCenterX >= bbox.minX - overlapMargin && lineCenterX <= bbox.maxX + overlapMargin;
      if (!withinX) return;

      let gap;
      let direction;
      if (line.y <= bbox.minY + 2) {
        gap = bbox.minY - line.y;
        direction = "below";
      } else if (line.y >= bbox.maxY - 2) {
        gap = line.y - bbox.maxY;
        direction = "above";
      } else {
        return; // la ligne chevauche verticalement l'image elle-même
      }

      if (gap < -2 || gap > maxGap) return;

      // Priorité forte aux lignes situées sous l'image (cas le plus fréquent pour un badge)
      const score = gap + (direction === "above" ? 1000 : 0);
      candidates.push({ imgIdx, lineIdx, score, direction });
    });
  });

  candidates.sort((a, b) => a.score - b.score);

  const usedLines = new Set();
  const primaryLineIdx = new Array(images.length).fill(-1);
  const primaryDirection = new Array(images.length).fill(null);

  for (const c of candidates) {
    if (primaryLineIdx[c.imgIdx] !== -1 || usedLines.has(c.lineIdx)) continue;
    primaryLineIdx[c.imgIdx] = c.lineIdx;
    primaryDirection[c.imgIdx] = c.direction;
    usedLines.add(c.lineIdx);
  }

  // Deuxième passe : recoller les lignes empilées juste après la ligne principale
  // (même bloc nom réparti sur plusieurs lignes), tant qu'aucune autre photo ne l'a prise.
  const result = new Array(images.length).fill("");

  images.forEach((img, imgIdx) => {
    const firstIdx = primaryLineIdx[imgIdx];
    if (firstIdx === -1) return;

    const bbox = img.bbox;
    const overlapMargin = overlapMarginFor(bbox);
    const direction = primaryDirection[imgIdx];
    const parts = [lines[firstIdx].text];
    let currentLine = lines[firstIdx];
    let guard = 0;

    while (guard < 3) {
      guard++;
      const extensionGapMax = Math.max(14, (currentLine.height || 10) * 1.8);
      let next = null;
      let nextIdx = -1;
      let bestGap = Infinity;

      lines.forEach((line, lineIdx) => {
        if (usedLines.has(lineIdx)) return;
        const lineCenterX = (line.minX + line.maxX) / 2;
        if (lineCenterX < bbox.minX - overlapMargin || lineCenterX > bbox.maxX + overlapMargin) return;

        // On continue de chercher dans la même direction que la ligne principale
        // (plus loin sous l'image, ou plus loin au-dessus)
        const gap = direction === "below" ? currentLine.y - line.y : line.y - currentLine.y;
        if (gap > 0 && gap <= extensionGapMax && gap < bestGap) {
          next = line;
          nextIdx = lineIdx;
          bestGap = gap;
        }
      });

      if (!next) break;
      usedLines.add(nextIdx);
      if (direction === "below") {
        parts.push(next.text);
      } else {
        parts.unshift(next.text);
      }
      currentLine = next;
    }

    result[imgIdx] = parts.join(" ").replace(/\s+/g, " ").trim();
  });

  return result;
}

/* Récupère un objet image depuis le cache de la page (ou le cache commun du document) */
function getPdfImageObject(page, name) {
  return new Promise((resolve) => {
    try {
      if (page.objs.has(name)) {
        page.objs.get(name, resolve);
      } else if (page.commonObjs.has(name)) {
        page.commonObjs.get(name, resolve);
      } else {
        page.objs.get(name, resolve);
      }
    } catch (err) {
      resolve(null);
    }
  });
}

/* Convertit un objet image PDF.js (bitmap ou données brutes) en <canvas> */
function imageObjectToCanvas(imgObj) {
  if (!imgObj) return null;

  const canvas = document.createElement("canvas");

  // Cas 1 : l'objet est déjà un ImageBitmap
  if (typeof ImageBitmap !== "undefined" && imgObj instanceof ImageBitmap) {
    canvas.width = imgObj.width;
    canvas.height = imgObj.height;
    canvas.getContext("2d").drawImage(imgObj, 0, 0);
    return canvas;
  }

  // Cas 2 : l'objet est déjà un canvas
  if (imgObj instanceof HTMLCanvasElement) {
    return imgObj;
  }

  // Cas 3 : l'objet expose un bitmap interne
  if (imgObj.bitmap) {
    canvas.width = imgObj.width || imgObj.bitmap.width;
    canvas.height = imgObj.height || imgObj.bitmap.height;
    canvas.getContext("2d").drawImage(imgObj.bitmap, 0, 0);
    return canvas;
  }

  // Cas 4 : données brutes de pixels (RGB, RGBA ou niveaux de gris 1 bit)
  if (!imgObj.data || !imgObj.width || !imgObj.height) return null;

  const { width, height, data } = imgObj;
  const kind = imgObj.kind;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;

  const KIND = pdfjsLib.ImageKind || { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 };

  if (kind === KIND.RGBA_32BPP) {
    out.set(data.subarray(0, width * height * 4));
  } else if (kind === KIND.RGB_24BPP) {
    rgbToRgba(data, out, width * height);
  } else if (kind === KIND.GRAYSCALE_1BPP) {
    grayscale1bppToRgba(data, out, width, height);
  } else if (data.length === width * height * 4) {
    out.set(data);
  } else if (data.length === width * height * 3) {
    rgbToRgba(data, out, width * height);
  } else {
    return null;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function rgbToRgba(src, out, pixelCount) {
  let s = 0;
  let d = 0;
  for (let i = 0; i < pixelCount; i++) {
    out[d] = src[s];
    out[d + 1] = src[s + 1];
    out[d + 2] = src[s + 2];
    out[d + 3] = 255;
    s += 3;
    d += 4;
  }
}

function grayscale1bppToRgba(src, out, width, height) {
  const bytesPerRow = Math.ceil(width / 8);
  let d = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = src[y * bytesPerRow + (x >> 3)];
      const bit = (byte >> (7 - (x % 8))) & 1;
      const val = bit ? 255 : 0;
      out[d] = val;
      out[d + 1] = val;
      out[d + 2] = val;
      out[d + 3] = 255;
      d += 4;
    }
  }
}

/* ===========================================================
   Affichage de la galerie
   =========================================================== */

function getVisiblePhotos() {
  const showSmall = showSmallImagesCheckbox.checked;
  return photos.filter((p) => showSmall || !p.small);
}

function renderGallery() {
  const visible = getVisiblePhotos();

  gallery.innerHTML = "";

  if (visible.length === 0) {
    gallery.hidden = true;
    galleryToolbar.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector("p").innerHTML =
      photos.length > 0
        ? "Toutes les images trouvées sont trop petites (&lt; 50×50 px).<br>Activez l'option pour les afficher."
        : "Aucune photo pour le moment.<br>Importez un PDF pour commencer l'extraction.";
    return;
  }

  emptyState.hidden = true;
  gallery.hidden = false;
  galleryToolbar.hidden = false;

  for (const photo of visible) {
    gallery.appendChild(buildPhotoCard(photo));
  }

  updateGalleryCount();
}

function buildPhotoCard(photo) {
  const node = photoCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".photo-card");
  const checkbox = node.querySelector(".photo-checkbox");
  const img = node.querySelector(".photo-img");
  const dims = node.querySelector(".photo-dims");
  const pageLabel = node.querySelector(".photo-page");
  const nameInput = node.querySelector(".photo-name");
  const adjustBtn = node.querySelector(".btn-adjust");
  const downloadBtn = node.querySelector(".btn-download");

  img.src = photo.canvas.toDataURL("image/png");
  img.alt = `Photo extraite de la page ${photo.pageNum}`;
  dims.textContent = `${photo.width} × ${photo.height} px`;
  pageLabel.textContent = `Page ${photo.pageNum}`;
  checkbox.checked = photo.selected;
  nameInput.value = photo.name || "";
  nameInput.placeholder = "Nom non détecté";
  adjustBtn.textContent = isCropCustomized(photo.crop) ? "🖼️ Ajuster ✓" : "🖼️ Ajuster";

  checkbox.addEventListener("change", () => {
    photo.selected = checkbox.checked;
  });

  nameInput.addEventListener("input", () => {
    photo.name = nameInput.value;
  });

  adjustBtn.addEventListener("click", () => openCropAdjustModal(photo));

  downloadBtn.addEventListener("click", async () => {
    const croppedCanvas = cropCanvasForFormat(photo.canvas, badgeFormatSelect.value, photo.crop);
    const blob = await canvasToBlob(croppedCanvas);
    triggerDownload(blob, photoFileName(photo));
  });

  card.dataset.photoId = photo.id;
  return node;
}

function updateGalleryCount() {
  const total = getVisiblePhotos().length;
  galleryCount.textContent = `${total} photo${total > 1 ? "s" : ""} extraite${total > 1 ? "s" : ""}`;
}

showSmallImagesCheckbox.addEventListener("change", renderGallery);

/* ===========================================================
   Sélection
   =========================================================== */

selectAllBtn.addEventListener("click", () => {
  getVisiblePhotos().forEach((p) => (p.selected = true));
  renderGallery();
});

deselectAllBtn.addEventListener("click", () => {
  getVisiblePhotos().forEach((p) => (p.selected = false));
  renderGallery();
});

/* ===========================================================
   Recadrage "Format badge"
   =========================================================== */

const DEFAULT_CROP_STATE = { x: 0.5, y: 0.5, zoom: 1 };
const MAX_CROP_ZOOM = 3;

/* Calcule le rectangle de recadrage dans l'image source pour un ratio et un
   état de recadrage donnés (centre normalisé x/y + zoom). Partagé entre
   l'export (cropCanvasForFormat) et l'aperçu interactif du recadrage manuel,
   pour garantir que ce qui est affiché correspond exactement à ce qui est exporté. */
function computeCropRect(sourceCanvas, ratio, cropState) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const state = cropState || DEFAULT_CROP_STATE;
  const zoom = Math.min(MAX_CROP_ZOOM, Math.max(1, state.zoom || 1));

  let baseW, baseH;
  if (sw / sh > ratio) {
    baseH = sh;
    baseW = sh * ratio;
  } else {
    baseW = sw;
    baseH = sw / ratio;
  }

  const cropW = baseW / zoom;
  const cropH = baseH / zoom;

  const centerX = (state.x ?? 0.5) * sw;
  const centerY = (state.y ?? 0.5) * sh;

  const cropX = Math.min(Math.max(centerX - cropW / 2, 0), sw - cropW);
  const cropY = Math.min(Math.max(centerY - cropH / 2, 0), sh - cropH);

  return { cropX, cropY, cropW, cropH };
}

function cropCanvasForFormat(sourceCanvas, formatValue, cropState) {
  const format = BADGE_FORMATS[formatValue];
  if (!format) return sourceCanvas; // "original" : pas de recadrage

  const { cropX, cropY, cropW, cropH } = computeCropRect(sourceCanvas, format.ratio, cropState);

  const out = document.createElement("canvas");
  out.width = format.outW;
  out.height = format.outH;
  out
    .getContext("2d")
    .drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, format.outW, format.outH);

  return out;
}

/* ===========================================================
   Téléchargements (PNG individuel + ZIP groupé)
   =========================================================== */

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function photoFileName(photo) {
  const cleanName = photo.name && photo.name.trim() ? sanitizeForFilename(photo.name.trim()) : "";
  if (cleanName) {
    return `${cleanName}_page${photo.pageNum}.png`;
  }
  return `photo_page${photo.pageNum}_${photo.indexInPage}.png`;
}

/* Nettoie une chaîne pour en faire un nom de fichier sûr (sans accents ni caractères spéciaux) */
function sanitizeForFilename(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // supprime les accents (diacritiques combinants)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

downloadAllBtn.addEventListener("click", () => {
  downloadPhotosAsZip(getVisiblePhotos(), "badges_tout.zip");
});

downloadSelectionBtn.addEventListener("click", () => {
  const selection = getVisiblePhotos().filter((p) => p.selected);
  if (selection.length === 0) {
    showError("Sélectionnez au moins une photo avant de télécharger.");
    return;
  }
  downloadPhotosAsZip(selection, "badges_selection.zip");
});

async function downloadPhotosAsZip(photoList, zipFilename) {
  if (photoList.length === 0) return;

  hideError();
  const zip = new JSZip();
  const format = badgeFormatSelect.value;

  for (const photo of photoList) {
    const croppedCanvas = cropCanvasForFormat(photo.canvas, format, photo.crop);
    const blob = await canvasToBlob(croppedCanvas);
    zip.file(photoFileName(photo), blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  triggerDownload(content, zipFilename);
}

/* ===========================================================
   Utilitaires d'interface
   =========================================================== */

function showProgress(percent, label) {
  progressSection.hidden = false;
  progressBarFill.style.width = `${percent}%`;
  if (label) progressLabel.textContent = label;
}

function updateProgress(percent) {
  progressBarFill.style.width = `${percent}%`;
}

function hideProgress() {
  progressSection.hidden = true;
  progressBarFill.style.width = "0%";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("visible");
}

function hideError() {
  errorMessage.textContent = "";
  errorMessage.classList.remove("visible");
}

function resetGallery() {
  photos = [];
  photoIdCounter = 0;
  gallery.innerHTML = "";
  gallery.hidden = true;
  galleryToolbar.hidden = true;
  emptyState.hidden = false;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/* ===========================================================
   Email de contact protégé contre le scraping
   (assemblé en JS au chargement, jamais écrit en clair dans le HTML)
   =========================================================== */

(function setupProtectedEmail() {
  const localPart = "papeaboumbaye";
  const domain = "gmail.com";
  const email = `${localPart}@${domain}`;

  if (footerEmail) {
    const link = document.createElement("a");
    link.href = `mailto:${email}`;
    link.textContent = email;
    footerEmail.appendChild(link);
  }

  copyEmailBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      const original = copyEmailBtn.textContent;
      copyEmailBtn.textContent = "✅";
      copyEmailBtn.disabled = true;
      setTimeout(() => {
        copyEmailBtn.textContent = original;
        copyEmailBtn.disabled = false;
      }, 1500);
    } catch (err) {
      // Copie ignorée si l'API Clipboard est indisponible (ex: contexte non sécurisé)
    }
  });
})();

/* ===========================================================
   Modal + formulaire de contact (Web3Forms)
   =========================================================== */

function openContactModal() {
  contactModalOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("contactName")?.focus();
}

function closeContactModal() {
  contactModalOverlay.hidden = true;
  document.body.style.overflow = "";
}

openContactBtn?.addEventListener("click", openContactModal);
closeContactBtn?.addEventListener("click", closeContactModal);

contactModalOverlay?.addEventListener("click", (e) => {
  if (e.target === contactModalOverlay) closeContactModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && contactModalOverlay && !contactModalOverlay.hidden) {
    closeContactModal();
  }
});

function setContactFeedback(message, type) {
  contactFeedback.textContent = message;
  contactFeedback.className = `contact-feedback${type ? ` ${type}` : ""}`;
}

contactForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY === "METTRE_LA_CLE_ICI") {
    setContactFeedback(
      "Le formulaire n'est pas encore configuré (clé Web3Forms manquante).",
      "error"
    );
    return;
  }

  const formData = new FormData(contactForm);
  formData.append("access_key", WEB3FORMS_ACCESS_KEY);

  contactSubmitBtn.disabled = true;
  contactSubmitBtn.textContent = "Envoi en cours…";
  setContactFeedback("", "");

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const result = await response.json();

    if (response.ok && result.success) {
      setContactFeedback("Message envoyé, je vous répondrai vite !", "success");
      contactForm.reset();
    } else {
      setContactFeedback(
        "Une erreur est survenue lors de l'envoi. Merci de réessayer ou de m'écrire directement par email.",
        "error"
      );
    }
  } catch (err) {
    setContactFeedback(
      "Une erreur est survenue lors de l'envoi. Merci de réessayer ou de m'écrire directement par email.",
      "error"
    );
  } finally {
    contactSubmitBtn.disabled = false;
    contactSubmitBtn.textContent = "Envoyer";
  }
});

/* ===========================================================
   Générateur de badges imprimables (PDF)
   =========================================================== */

const PLACEHOLDER_PHOTO_CANVAS = createPlaceholderPhotoCanvas();

function getBadgeSelection() {
  return getVisiblePhotos().filter((p) => p.selected);
}

function updateBadgeGeneratorCount() {
  const count = getBadgeSelection().length;
  badgeGeneratorCount.textContent =
    count > 0
      ? `${count} badge${count > 1 ? "s" : ""} sera généré à partir de la sélection actuelle`
      : "Aucune photo sélectionnée — sélectionnez au moins une photo dans la galerie";
}

function openBadgeGeneratorModal() {
  updateBadgeGeneratorCount();
  renderBadgePreview();
  badgeGeneratorOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeBadgeGeneratorModal() {
  badgeGeneratorOverlay.hidden = true;
  document.body.style.overflow = "";
}

openBadgeGeneratorBtn?.addEventListener("click", openBadgeGeneratorModal);
closeBadgeGeneratorBtn?.addEventListener("click", closeBadgeGeneratorModal);

badgeGeneratorOverlay?.addEventListener("click", (e) => {
  if (e.target === badgeGeneratorOverlay) closeBadgeGeneratorModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && badgeGeneratorOverlay && !badgeGeneratorOverlay.hidden) {
    closeBadgeGeneratorModal();
  }
});

badgeCardFormatSelect?.addEventListener("change", renderBadgePreview);
badgeSubtitleInput?.addEventListener("input", renderBadgePreview);

badgeLogoBtn?.addEventListener("click", () => badgeLogoInput.click());

badgeLogoInput?.addEventListener("change", () => {
  const file = badgeLogoInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      badgeLogoImage = img;
      badgeLogoPreview.src = reader.result;
      badgeLogoPreview.hidden = false;
      badgeLogoRemoveBtn.hidden = false;
      renderBadgePreview();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

badgeLogoRemoveBtn?.addEventListener("click", () => {
  badgeLogoImage = null;
  badgeLogoInput.value = "";
  badgeLogoPreview.hidden = true;
  badgeLogoRemoveBtn.hidden = true;
  renderBadgePreview();
});

function getBadgeRenderOptions() {
  return {
    formatKey: badgeCardFormatSelect.value,
    subtitle: badgeSubtitleInput.value.trim(),
    logoImage: badgeLogoImage,
  };
}

/* Dessine un badge (photo + nom + sous-titre + logo optionnel) sur un nouveau canvas */
function renderBadgeCanvas(photo, options) {
  const format = BADGE_CARD_FORMATS[options.formatKey];
  const w = Math.round(format.widthMm * BADGE_RENDER_SCALE);
  const h = Math.round(format.heightMm * BADGE_RENDER_SCALE);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d8d8d8";
  ctx.lineWidth = Math.max(1, BADGE_RENDER_SCALE * 0.15);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  const margin = 4 * BADGE_RENDER_SCALE;

  if (format.orientation === "landscape") {
    renderLandscapeBadge(ctx, w, h, margin, photo, options);
  } else {
    renderPortraitBadge(ctx, w, h, margin, photo, options);
  }

  return canvas;
}

/* Badge type carte CR80 : photo à gauche, texte à droite */
function renderLandscapeBadge(ctx, w, h, margin, photo, options) {
  const photoSize = h - margin * 2;
  const photoX = margin;
  const photoY = margin;

  drawPhotoInBox(ctx, photo, photoX, photoY, photoSize, photoSize);

  const textX = photoX + photoSize + margin;
  const textMaxWidth = w - margin - textX;

  if (options.logoImage) {
    drawLogo(ctx, options.logoImage, w - margin, margin, textMaxWidth, h * 0.22, "right");
  }

  ctx.fillStyle = "#111111";
  ctx.textAlign = "left";
  const nameFontSize = Math.round(h * 0.13);
  ctx.font = `bold ${nameFontSize}px Arial, sans-serif`;
  const nameLines = wrapText(ctx, photo.name || "—", textMaxWidth, 2);
  const nameStartY = h * 0.52;
  drawLines(ctx, nameLines, textX, nameStartY, nameFontSize * 1.15);

  if (options.subtitle) {
    const subFontSize = Math.round(h * 0.08);
    ctx.font = `${subFontSize}px Arial, sans-serif`;
    ctx.fillStyle = "#5a5a5a";
    ctx.fillText(options.subtitle, textX, nameStartY + nameLines.length * nameFontSize * 1.15 + subFontSize * 0.3, textMaxWidth);
  }
}

/* Badge type conférence : photo centrée en haut, texte en dessous */
function renderPortraitBadge(ctx, w, h, margin, photo, options) {
  const logoZoneH = options.logoImage ? h * 0.09 : 0;
  const photoSize = w - margin * 2;
  const photoX = margin;
  const photoY = margin + logoZoneH;

  if (options.logoImage) {
    drawLogo(ctx, options.logoImage, w / 2, margin, w * 0.6, logoZoneH, "center");
  }

  drawPhotoInBox(ctx, photo, photoX, photoY, photoSize, photoSize);

  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  const nameFontSize = Math.round(h * 0.052);
  ctx.font = `bold ${nameFontSize}px Arial, sans-serif`;
  const nameLines = wrapText(ctx, photo.name || "—", w - margin * 2, 2);
  const nameStartY = photoY + photoSize + h * 0.075;
  drawLines(ctx, nameLines, w / 2, nameStartY, nameFontSize * 1.2);

  if (options.subtitle) {
    const subFontSize = Math.round(h * 0.032);
    const cursorY = nameStartY + nameLines.length * nameFontSize * 1.2;
    ctx.font = `${subFontSize}px Arial, sans-serif`;
    ctx.fillStyle = "#5a5a5a";
    ctx.fillText(options.subtitle, w / 2, cursorY + subFontSize * 0.5, w - margin * 2);
  }
}

/* Recadre la photo en carré (réutilise le recadrage centré/manuel existant) et la dessine dans une zone */
function drawPhotoInBox(ctx, photo, x, y, w, h) {
  const cropped = cropCanvasForFormat(photo.canvas, "square", photo.crop);
  ctx.drawImage(cropped, x, y, w, h);
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

/* Dessine un logo en conservant ses proportions, ancré à droite/au centre/à gauche */
function drawLogo(ctx, img, anchorX, anchorY, maxW, maxH, align) {
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * ratio;
  const h = img.height * ratio;
  let x = anchorX;
  if (align === "right") x = anchorX - w;
  else if (align === "center") x = anchorX - w / 2;
  ctx.drawImage(img, x, anchorY, w, h);
}

/* Découpe un texte en un nombre limité de lignes qui tiennent dans maxWidth */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
}

/* Crée une silhouette grise utilisée comme aperçu tant qu'aucune photo n'est sélectionnée */
function createPlaceholderPhotoCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(100, 78, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(100, 210, 65, 65, 0, Math.PI, 0, true);
  ctx.fill();
  return canvas;
}

/* Met à jour l'aperçu du badge en fonction des réglages actuels du formulaire */
function renderBadgePreview() {
  if (!badgePreviewCanvas) return;

  const options = getBadgeRenderOptions();
  const selection = getBadgeSelection();
  const previewPhoto = selection[0] || { canvas: PLACEHOLDER_PHOTO_CANVAS, name: "Nom Prénom" };

  const canvas = renderBadgeCanvas(previewPhoto, options);
  badgePreviewCanvas.width = canvas.width;
  badgePreviewCanvas.height = canvas.height;
  badgePreviewCanvas.getContext("2d").drawImage(canvas, 0, 0);
}

/* Ajoute de petits traits de coupe (repères d'impression) aux 4 coins d'un badge */
function drawCutMarks(doc, x, y, w, h) {
  const markLen = 2.5;
  const gap = 0.8;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.15);

  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ];

  corners.forEach(([cx, cy, hDir, vDir]) => {
    doc.line(cx + hDir * gap, cy, cx + hDir * (gap + markLen), cy);
    doc.line(cx, cy + vDir * gap, cx, cy + vDir * (gap + markLen));
  });
}

/* Génère le PDF final : une planche A4 avec autant de badges que possible par page */
async function generateBadgePdf(photosList) {
  const options = getBadgeRenderOptions();
  const format = BADGE_CARD_FORMATS[options.formatKey];

  const { jsPDF } = window.jspdf;
  // compress: true + images en JPEG (au lieu de PNG) : un PDF en PNG non compressé avec
  // plusieurs badges par page pouvait dépasser plusieurs dizaines de Mo et devenait très
  // long à générer/ouvrir. Les badges sont des photos (pas de transparence), le JPEG ne
  // perd donc rien de visible tout en réduisant le poids d'un facteur 10 à 20.
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const pageW = 210;
  const pageH = 297;
  const pageMargin = 10;
  const gap = 4;

  const cardW = format.widthMm;
  const cardH = format.heightMm;

  const cols = Math.max(1, Math.floor((pageW - pageMargin * 2 + gap) / (cardW + gap)));
  const rows = Math.max(1, Math.floor((pageH - pageMargin * 2 + gap) / (cardH + gap)));
  const perPage = cols * rows;

  const gridW = cols * cardW + (cols - 1) * gap;
  const gridH = rows * cardH + (rows - 1) * gap;
  const offsetX = pageMargin + (pageW - pageMargin * 2 - gridW) / 2;
  const offsetY = pageMargin + (pageH - pageMargin * 2 - gridH) / 2;

  for (let i = 0; i < photosList.length; i++) {
    const photo = photosList[i];
    const posInPage = i % perPage;

    if (i > 0 && posInPage === 0) {
      doc.addPage();
    }

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = offsetX + col * (cardW + gap);
    const y = offsetY + row * (cardH + gap);

    const badgeCanvas = renderBadgeCanvas(photo, options);
    const imgData = badgeCanvas.toDataURL("image/jpeg", 0.92);
    doc.addImage(imgData, "JPEG", x, y, cardW, cardH);
    drawCutMarks(doc, x, y, cardW, cardH);
  }

  doc.save("badges.pdf");
}

function setBadgeGeneratorFeedback(message, type) {
  badgeGeneratorFeedback.textContent = message;
  badgeGeneratorFeedback.className = `contact-feedback${type ? ` ${type}` : ""}`;
}

badgeGeneratorForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const selection = getBadgeSelection();
  if (selection.length === 0) {
    setBadgeGeneratorFeedback(
      "Sélectionnez au moins une photo dans la galerie avant de générer les badges.",
      "error"
    );
    return;
  }

  badgeGenerateBtn.disabled = true;
  badgeGenerateBtn.textContent = "Génération en cours…";
  setBadgeGeneratorFeedback("", "");

  try {
    await generateBadgePdf(selection);
    setBadgeGeneratorFeedback(
      `${selection.length} badge${selection.length > 1 ? "s" : ""} généré${selection.length > 1 ? "s" : ""} avec succès.`,
      "success"
    );
  } catch (err) {
    setBadgeGeneratorFeedback("Une erreur est survenue pendant la génération du PDF.", "error");
  } finally {
    badgeGenerateBtn.disabled = false;
    badgeGenerateBtn.textContent = "Générer le PDF";
  }
});

/* ===========================================================
   Recadrage manuel (pan + zoom) par photo
   =========================================================== */

const CROP_ADJUST_MAX_DISPLAY = 480;

let cropAdjustPhoto = null;
let cropAdjustState = { ...DEFAULT_CROP_STATE };
let cropAdjustDisplayScale = 1;
let cropDragging = false;
let cropDragStartClientX = 0;
let cropDragStartClientY = 0;
let cropDragStartStateX = 0.5;
let cropDragStartStateY = 0.5;

/* Un recadrage est "personnalisé" s'il diffère du centrage par défaut */
function isCropCustomized(crop) {
  if (!crop) return false;
  const eps = 0.001;
  return Math.abs(crop.x - 0.5) > eps || Math.abs(crop.y - 0.5) > eps || Math.abs(crop.zoom - 1) > eps;
}

/* Ratio utilisé comme repère visuel dans l'éditeur de recadrage (celui du format badge actuel) */
function getCropPreviewRatio() {
  const format = BADGE_FORMATS[badgeFormatSelect.value];
  return format ? format.ratio : 1;
}

function openCropAdjustModal(photo) {
  cropAdjustPhoto = photo;
  cropAdjustState = { ...(photo.crop || DEFAULT_CROP_STATE) };
  cropZoomRange.value = cropAdjustState.zoom;

  const format = BADGE_FORMATS[badgeFormatSelect.value];
  cropAdjustHint.textContent = format
    ? "Glissez la photo pour la repositionner, utilisez le curseur pour zoomer."
    : "Le format actuel est « Original » (aucun recadrage) : ce repère carré est indicatif tant qu'aucun format badge n'est choisi.";

  renderCropAdjustCanvas();
  cropAdjustOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCropAdjustModal() {
  cropAdjustOverlay.hidden = true;
  document.body.style.overflow = "";
  cropAdjustPhoto = null;
}

closeCropAdjustBtn?.addEventListener("click", closeCropAdjustModal);
cropCancelBtn?.addEventListener("click", closeCropAdjustModal);

cropAdjustOverlay?.addEventListener("click", (e) => {
  if (e.target === cropAdjustOverlay) closeCropAdjustModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && cropAdjustOverlay && !cropAdjustOverlay.hidden) {
    closeCropAdjustModal();
  }
});

/* Dessine la photo + un cadre assombrissant tout ce qui sera coupé (WYSIWYG avec l'export) */
function renderCropAdjustCanvas() {
  if (!cropAdjustPhoto) return;

  const sourceCanvas = cropAdjustPhoto.canvas;
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  const scale = Math.min(CROP_ADJUST_MAX_DISPLAY / sw, CROP_ADJUST_MAX_DISPLAY / sh, 1) || 1;
  const displayW = Math.max(1, Math.round(sw * scale));
  const displayH = Math.max(1, Math.round(sh * scale));

  cropAdjustCanvas.width = displayW;
  cropAdjustCanvas.height = displayH;
  cropAdjustDisplayScale = scale;

  const ctx = cropAdjustCanvas.getContext("2d");
  ctx.clearRect(0, 0, displayW, displayH);
  ctx.drawImage(sourceCanvas, 0, 0, displayW, displayH);

  const ratio = getCropPreviewRatio();
  const { cropX, cropY, cropW, cropH } = computeCropRect(sourceCanvas, ratio, cropAdjustState);

  const rx = cropX * scale;
  const ry = cropY * scale;
  const rw = cropW * scale;
  const rh = cropH * scale;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, displayW, ry);
  ctx.fillRect(0, ry + rh, displayW, displayH - ry - rh);
  ctx.fillRect(0, ry, rx, rh);
  ctx.fillRect(rx + rw, ry, displayW - rx - rw, rh);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rh);
}

cropZoomRange?.addEventListener("input", () => {
  cropAdjustState.zoom = parseFloat(cropZoomRange.value) || 1;
  renderCropAdjustCanvas();
});

cropResetBtn?.addEventListener("click", () => {
  cropAdjustState = { ...DEFAULT_CROP_STATE };
  cropZoomRange.value = 1;
  renderCropAdjustCanvas();
});

cropApplyBtn?.addEventListener("click", () => {
  if (!cropAdjustPhoto) return;
  cropAdjustPhoto.crop = { ...cropAdjustState };

  const adjustBtnEl = gallery.querySelector(
    `.photo-card[data-photo-id="${cropAdjustPhoto.id}"] .btn-adjust`
  );
  if (adjustBtnEl) {
    adjustBtnEl.textContent = isCropCustomized(cropAdjustPhoto.crop) ? "🖼️ Ajuster ✓" : "🖼️ Ajuster";
  }

  closeCropAdjustModal();
});

/* Glisser-déposer (souris + tactile) pour repositionner le cadre de recadrage */
function getCropEventPoint(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function startCropDrag(e) {
  if (!cropAdjustPhoto) return;
  cropDragging = true;
  const point = getCropEventPoint(e);
  cropDragStartClientX = point.x;
  cropDragStartClientY = point.y;
  cropDragStartStateX = cropAdjustState.x;
  cropDragStartStateY = cropAdjustState.y;
  e.preventDefault();
}

function moveCropDrag(e) {
  if (!cropDragging || !cropAdjustPhoto) return;
  const point = getCropEventPoint(e);
  const dxDisplay = point.x - cropDragStartClientX;
  const dyDisplay = point.y - cropDragStartClientY;

  const sw = cropAdjustPhoto.canvas.width;
  const sh = cropAdjustPhoto.canvas.height;
  const dxNorm = dxDisplay / cropAdjustDisplayScale / sw;
  const dyNorm = dyDisplay / cropAdjustDisplayScale / sh;

  cropAdjustState.x = Math.min(1, Math.max(0, cropDragStartStateX + dxNorm));
  cropAdjustState.y = Math.min(1, Math.max(0, cropDragStartStateY + dyNorm));
  renderCropAdjustCanvas();
  e.preventDefault();
}

function endCropDrag() {
  cropDragging = false;
}

cropAdjustCanvas?.addEventListener("mousedown", startCropDrag);
window.addEventListener("mousemove", moveCropDrag);
window.addEventListener("mouseup", endCropDrag);

cropAdjustCanvas?.addEventListener("touchstart", startCropDrag, { passive: false });
window.addEventListener("touchmove", moveCropDrag, { passive: false });
window.addEventListener("touchend", endCropDrag);

/* ===========================================================
   Onglets (Extraction PDF <-> Photo pour badge)
   =========================================================== */

function activateTab(tab) {
  const isPdf = tab === "pdf";
  pdfToolPanel.hidden = !isPdf;
  photoToolPanel.hidden = isPdf;
  tabPdfBtn.classList.toggle("active", isPdf);
  tabPhotoBtn.classList.toggle("active", !isPdf);
  if (!isPdf) refreshPpbGalleryPicker();
}

tabPdfBtn?.addEventListener("click", () => activateTab("pdf"));
tabPhotoBtn?.addEventListener("click", () => activateTab("photo"));

/* ===========================================================
   Photo pour badge — recadrage d'une photo unique avec suggestion
   de cadrage automatique (détection de visage) et export multi-format.

   Rappel : ceci ne produit PAS de photo conforme à un usage administratif
   officiel (passeport, CNI). C'est un outil pour badges, cartes d'étudiant,
   licences sportives, trombinoscopes, etc.
   =========================================================== */

/* Formats de sortie prédéfinis (dimensions physiques en mm, exportées à 300 DPI) */
const PPB_FORMATS = {
  id35x45: { widthMm: 35, heightMm: 45 },
  square: { widthMm: 40, heightMm: 40 },
  ratio34: { widthMm: 30, heightMm: 40 },
  ratio23: { widthMm: 40, heightMm: 60 },
};
const PPB_DPI = 300;
const PPB_MAX_DISPLAY = 480;

const PPB_SHEET_SIZES = {
  "10x15": { widthMm: 100, heightMm: 150 },
  a4: { widthMm: 210, heightMm: 297 },
};

let ppbSourceImage = null; // <canvas> contenant la photo chargée
let ppbCrop = { x: 0.5, y: 0.5, zoom: 1 };
let ppbDisplayScale = 1;
let ppbFaceDetector = null;
let ppbDragging = false;
let ppbDragStartClientX = 0;
let ppbDragStartClientY = 0;
let ppbDragStartStateX = 0.5;
let ppbDragStartStateY = 0.5;

/* ---------- Upload (clic + drag & drop) ---------- */

ppbChooseBtn?.addEventListener("click", () => ppbFileInput.click());
ppbDropzone?.addEventListener("click", () => ppbFileInput.click());
ppbDropzone?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    ppbFileInput.click();
  }
});

ppbFileInput?.addEventListener("change", () => {
  if (ppbFileInput.files.length > 0) handlePpbFile(ppbFileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) => {
  ppbDropzone?.addEventListener(evt, (e) => {
    e.preventDefault();
    ppbDropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  ppbDropzone?.addEventListener(evt, (e) => {
    e.preventDefault();
    ppbDropzone.classList.remove("dragover");
  });
});

ppbDropzone?.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handlePpbFile(file);
});

function handlePpbFile(file) {
  hidePpbError();

  if (!isImageFile(file)) {
    showPpbError("Le fichier sélectionné n'est pas une image (JPG ou PNG attendu).");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      loadPpbSourceCanvas(canvas);
    };
    img.onerror = () => showPpbError("Impossible de lire cette image.");
    img.src = reader.result;
  };
  reader.onerror = () => showPpbError("Impossible de lire ce fichier.");
  reader.readAsDataURL(file);
}

function showPpbError(message) {
  ppbErrorMessage.textContent = message;
  ppbErrorMessage.classList.add("visible");
}

function hidePpbError() {
  ppbErrorMessage.textContent = "";
  ppbErrorMessage.classList.remove("visible");
}

/* ---------- Réutiliser une photo déjà extraite d'un PDF ---------- */

function refreshPpbGalleryPicker() {
  if (!ppbFromGalleryWrap) return;

  if (photos.length === 0) {
    ppbFromGalleryWrap.hidden = true;
    return;
  }

  ppbFromGalleryWrap.hidden = false;
  ppbFromGalleryStrip.innerHTML = "";

  photos.forEach((photo) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "ppb-gallery-thumb";
    thumb.title = photo.name || `Photo page ${photo.pageNum}`;

    const img = document.createElement("img");
    img.src = photo.canvas.toDataURL("image/png");
    img.alt = photo.name || `Photo extraite de la page ${photo.pageNum}`;
    thumb.appendChild(img);

    thumb.addEventListener("click", () => {
      hidePpbError();
      loadPpbSourceCanvas(photo.canvas);
    });

    ppbFromGalleryStrip.appendChild(thumb);
  });
}

/* ---------- Chargement d'une photo dans l'espace de travail ---------- */

async function loadPpbSourceCanvas(canvas) {
  ppbSourceImage = canvas;
  ppbCrop = { x: 0.5, y: 0.5, zoom: 1 };
  ppbZoomRange.value = "1";

  ppbEmptyState.hidden = true;
  ppbWorkspace.hidden = false;

  renderPpbCanvas();
  await runPpbFaceDetection();
}

/* ---------- Format de sortie actif ---------- */

ppbFormatSelect?.addEventListener("change", () => {
  ppbCustomFields.hidden = ppbFormatSelect.value !== "custom";
  renderPpbCanvas();
});

ppbCustomWidthInput?.addEventListener("input", renderPpbCanvas);
ppbCustomHeightInput?.addEventListener("input", renderPpbCanvas);

function getPpbActiveFormat() {
  if (ppbFormatSelect.value === "custom") {
    const widthMm = parseFloat(ppbCustomWidthInput.value) || 35;
    const heightMm = parseFloat(ppbCustomHeightInput.value) || 45;
    return { widthMm, heightMm };
  }
  return PPB_FORMATS[ppbFormatSelect.value] || PPB_FORMATS.id35x45;
}

/* ---------- Détection de visage (MediaPipe) avec repli silencieux ---------- */

async function getPpbFaceDetector() {
  if (ppbFaceDetector) return ppbFaceDetector;
  if (typeof window.__initFaceDetector !== "function") return null;
  try {
    ppbFaceDetector = await window.__initFaceDetector();
    return ppbFaceDetector;
  } catch (err) {
    return null;
  }
}

async function runPpbFaceDetection() {
  ppbFaceStatus.textContent = "Détection du visage…";

  try {
    const detector = await getPpbFaceDetector();
    if (!detector) throw new Error("Détecteur indisponible");

    const result = detector.detect(ppbSourceImage);
    const detection = result && result.detections && result.detections[0];
    if (!detection) throw new Error("Aucun visage détecté");

    const { originX, originY, width, height } = detection.boundingBox;
    const sw = ppbSourceImage.width;
    const sh = ppbSourceImage.height;

    const faceCenterX = (originX + width / 2) / sw;
    // léger décalage vers le haut pour laisser de la place sous le menton (épaules, cravate...)
    const faceCenterY = (originY + height * 0.42) / sh;

    // on veut que le visage occupe environ 65% de la hauteur du cadre final
    const targetFaceHeightRatio = 0.65;
    const format = getPpbActiveFormat();
    const ratio = format.widthMm / format.heightMm;
    const baseFit = computeCropRect(ppbSourceImage, ratio, DEFAULT_CROP_STATE);
    const desiredCropHeightPx = height / targetFaceHeightRatio;
    const zoom = Math.min(MAX_CROP_ZOOM, Math.max(1, baseFit.cropH / desiredCropHeightPx));

    ppbCrop = { x: faceCenterX, y: faceCenterY, zoom };
    ppbZoomRange.value = String(zoom);
    ppbFaceStatus.textContent = "Visage détecté — cadrage automatique appliqué ✓";
  } catch (err) {
    ppbCrop = { ...DEFAULT_CROP_STATE };
    ppbZoomRange.value = "1";
    ppbFaceStatus.textContent = "Visage non détecté — cadrage centré appliqué (ajustable manuellement).";
  } finally {
    renderPpbCanvas();
  }
}

ppbResetBtn?.addEventListener("click", () => {
  if (!ppbSourceImage) return;
  runPpbFaceDetection();
});

/* ---------- Aperçu interactif (glisser pour repositionner, curseur pour zoomer) ---------- */

function renderPpbCanvas() {
  if (!ppbSourceImage) return;

  const sw = ppbSourceImage.width;
  const sh = ppbSourceImage.height;
  const scale = Math.min(PPB_MAX_DISPLAY / sw, PPB_MAX_DISPLAY / sh, 1) || 1;
  const displayW = Math.max(1, Math.round(sw * scale));
  const displayH = Math.max(1, Math.round(sh * scale));

  ppbCanvas.width = displayW;
  ppbCanvas.height = displayH;
  ppbDisplayScale = scale;

  const ctx = ppbCanvas.getContext("2d");
  ctx.clearRect(0, 0, displayW, displayH);
  ctx.drawImage(ppbSourceImage, 0, 0, displayW, displayH);

  const format = getPpbActiveFormat();
  const ratio = format.widthMm / format.heightMm;
  const { cropX, cropY, cropW, cropH } = computeCropRect(ppbSourceImage, ratio, ppbCrop);

  const rx = cropX * scale;
  const ry = cropY * scale;
  const rw = cropW * scale;
  const rh = cropH * scale;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, displayW, ry);
  ctx.fillRect(0, ry + rh, displayW, displayH - ry - rh);
  ctx.fillRect(0, ry, rx, rh);
  ctx.fillRect(rx + rw, ry, displayW - rx - rw, rh);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rh);
}

ppbZoomRange?.addEventListener("input", () => {
  ppbCrop.zoom = parseFloat(ppbZoomRange.value) || 1;
  renderPpbCanvas();
});

function getPpbEventPoint(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function startPpbDrag(e) {
  if (!ppbSourceImage) return;
  ppbDragging = true;
  const point = getPpbEventPoint(e);
  ppbDragStartClientX = point.x;
  ppbDragStartClientY = point.y;
  ppbDragStartStateX = ppbCrop.x;
  ppbDragStartStateY = ppbCrop.y;
  e.preventDefault();
}

function movePpbDrag(e) {
  if (!ppbDragging || !ppbSourceImage) return;
  const point = getPpbEventPoint(e);
  const dxDisplay = point.x - ppbDragStartClientX;
  const dyDisplay = point.y - ppbDragStartClientY;

  const sw = ppbSourceImage.width;
  const sh = ppbSourceImage.height;
  const dxNorm = dxDisplay / ppbDisplayScale / sw;
  const dyNorm = dyDisplay / ppbDisplayScale / sh;

  ppbCrop.x = Math.min(1, Math.max(0, ppbDragStartStateX + dxNorm));
  ppbCrop.y = Math.min(1, Math.max(0, ppbDragStartStateY + dyNorm));
  renderPpbCanvas();
  e.preventDefault();
}

function endPpbDrag() {
  ppbDragging = false;
}

ppbCanvas?.addEventListener("mousedown", startPpbDrag);
window.addEventListener("mousemove", movePpbDrag);
window.addEventListener("mouseup", endPpbDrag);

ppbCanvas?.addEventListener("touchstart", startPpbDrag, { passive: false });
window.addEventListener("touchmove", movePpbDrag, { passive: false });
window.addEventListener("touchend", endPpbDrag);

/* ---------- Export (PNG / JPG, dimensions physiques réelles à 300 DPI) ---------- */

function renderPpbExportCanvas() {
  const format = getPpbActiveFormat();
  const ratio = format.widthMm / format.heightMm;
  const outW = Math.round((format.widthMm / 25.4) * PPB_DPI);
  const outH = Math.round((format.heightMm / 25.4) * PPB_DPI);
  const { cropX, cropY, cropW, cropH } = computeCropRect(ppbSourceImage, ratio, ppbCrop);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  out.getContext("2d").drawImage(ppbSourceImage, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
  return out;
}

ppbDownloadPngBtn?.addEventListener("click", async () => {
  if (!ppbSourceImage) return;
  const canvas = renderPpbExportCanvas();
  const blob = await canvasToBlob(canvas);
  triggerDownload(blob, "photo_badge.png");
});

ppbDownloadJpgBtn?.addEventListener("click", async () => {
  if (!ppbSourceImage) return;
  const canvas = renderPpbExportCanvas();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  triggerDownload(blob, "photo_badge.jpg");
});

/* ---------- Planche imprimable (PDF, grille + traits de coupe) ---------- */

function setPpbSheetFeedback(message, type) {
  ppbSheetFeedback.textContent = message;
  ppbSheetFeedback.className = `contact-feedback${type ? ` ${type}` : ""}`;
}

async function generatePpbSheet() {
  const format = getPpbActiveFormat();
  const sheet = PPB_SHEET_SIZES[ppbSheetFormatSelect.value] || PPB_SHEET_SIZES["10x15"];

  const pageMargin = 5;
  const gap = 3;
  const cardW = format.widthMm;
  const cardH = format.heightMm;

  if (cardW > sheet.widthMm - pageMargin * 2 || cardH > sheet.heightMm - pageMargin * 2) {
    throw new Error("Format de photo trop grand pour cette planche");
  }

  const exportCanvas = renderPpbExportCanvas();
  const imgData = exportCanvas.toDataURL("image/jpeg", 0.95);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: "mm",
    format: [sheet.widthMm, sheet.heightMm],
    orientation: sheet.widthMm > sheet.heightMm ? "landscape" : "portrait",
    compress: true,
  });

  const cols = Math.max(1, Math.floor((sheet.widthMm - pageMargin * 2 + gap) / (cardW + gap)));
  const rows = Math.max(1, Math.floor((sheet.heightMm - pageMargin * 2 + gap) / (cardH + gap)));

  const gridW = cols * cardW + (cols - 1) * gap;
  const gridH = rows * cardH + (rows - 1) * gap;
  const offsetX = pageMargin + (sheet.widthMm - pageMargin * 2 - gridW) / 2;
  const offsetY = pageMargin + (sheet.heightMm - pageMargin * 2 - gridH) / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * (cardW + gap);
      const y = offsetY + row * (cardH + gap);
      doc.addImage(imgData, "JPEG", x, y, cardW, cardH);
      drawCutMarks(doc, x, y, cardW, cardH);
    }
  }

  doc.save("planche_photos.pdf");
}

ppbGenerateSheetBtn?.addEventListener("click", async () => {
  if (!ppbSourceImage) return;

  ppbGenerateSheetBtn.disabled = true;
  const originalLabel = ppbGenerateSheetBtn.textContent;
  ppbGenerateSheetBtn.textContent = "Génération en cours…";
  setPpbSheetFeedback("", "");

  try {
    await generatePpbSheet();
    setPpbSheetFeedback("Planche PDF générée avec succès.", "success");
  } catch (err) {
    setPpbSheetFeedback(
      err.message === "Format de photo trop grand pour cette planche"
        ? "Le format de photo choisi est trop grand pour cette planche."
        : "Une erreur est survenue pendant la génération du PDF.",
      "error"
    );
  } finally {
    ppbGenerateSheetBtn.disabled = false;
    ppbGenerateSheetBtn.textContent = originalLabel;
  }
});
