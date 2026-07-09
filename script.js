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

/* ---------- État de l'application ---------- */

let photos = []; // { id, canvas, width, height, pageNum, indexInPage, selected, small }
let photoIdCounter = 0;

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

function handleFile(file) {
  hideError();

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    showError("Le fichier sélectionné n'est pas un PDF. Merci de choisir un fichier .pdf.");
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

/* Extrait les images d'une page via les instructions bas niveau de PDF.js */
async function extractImagesFromPage(page, pageNum) {
  const operatorList = await page.getOperatorList();
  const seenNames = new Set();
  let indexInPage = 0;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const isImageOp =
      fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintImageXObjectRepeat;

    if (!isImageOp) continue;

    const imgName = operatorList.argsArray[i][0];
    if (!imgName || seenNames.has(imgName)) continue;
    seenNames.add(imgName);

    const imgObj = await getPdfImageObject(page, imgName);
    if (!imgObj) continue;

    const canvas = imageObjectToCanvas(imgObj);
    if (!canvas || canvas.width === 0 || canvas.height === 0) continue;

    indexInPage++;
    const isSmall = canvas.width < MIN_DIMENSION || canvas.height < MIN_DIMENSION;

    photos.push({
      id: ++photoIdCounter,
      canvas,
      width: canvas.width,
      height: canvas.height,
      pageNum,
      indexInPage,
      selected: true,
      small: isSmall,
    });
  }
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
  const downloadBtn = node.querySelector(".btn-download");

  img.src = photo.canvas.toDataURL("image/png");
  img.alt = `Photo extraite de la page ${photo.pageNum}`;
  dims.textContent = `${photo.width} × ${photo.height} px`;
  pageLabel.textContent = `Page ${photo.pageNum}`;
  checkbox.checked = photo.selected;

  checkbox.addEventListener("change", () => {
    photo.selected = checkbox.checked;
  });

  downloadBtn.addEventListener("click", async () => {
    const croppedCanvas = cropCanvasForFormat(photo.canvas, badgeFormatSelect.value);
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

function cropCanvasForFormat(sourceCanvas, formatValue) {
  const format = BADGE_FORMATS[formatValue];
  if (!format) return sourceCanvas; // "original" : pas de recadrage

  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const srcRatio = sw / sh;

  let cropW, cropH, cropX, cropY;

  if (srcRatio > format.ratio) {
    // image source trop large : on rogne les côtés
    cropH = sh;
    cropW = sh * format.ratio;
    cropX = (sw - cropW) / 2;
    cropY = 0;
  } else {
    // image source trop haute : on rogne haut/bas
    cropW = sw;
    cropH = sw / format.ratio;
    cropX = 0;
    cropY = (sh - cropH) / 2;
  }

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
  return `photo_page${photo.pageNum}_${photo.indexInPage}.png`;
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
    const croppedCanvas = cropCanvasForFormat(photo.canvas, format);
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
