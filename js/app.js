import { CropBox } from './cropBox.js';
import { cropToBlob, buildFileName, saveBlob } from './exportImage.js';

const STAGE_MARGIN = 24;
const FORMAT_LABELS = { 'image/jpeg': 'JPEG', 'image/png': 'PNG' };

const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const sizeForm = $('sizeForm');
const widthInput = $('widthInput');
const heightInput = $('heightInput');
const showBoxBtn = $('showBoxBtn');
const message = $('message');
const stage = $('stage');
const placeholder = $('placeholder');
const viewport = $('viewport');
const image = $('image');
const imageInfo = $('imageInfo');
const confirmBtn = $('confirmBtn');
const formatDialog = $('formatDialog');
const formatSummary = $('formatSummary');

// 読み込み中の画像 { name, url }。未読み込みなら null。
let source = null;

const cropBox = new CropBox($('cropBox'), (rect) => {
  widthInput.value = rect.w;
  heightInput.value = rect.h;
  confirmBtn.disabled = false;
});

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function loadInto(img, url) {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

function setLoaded(loaded) {
  placeholder.hidden = loaded;
  viewport.hidden = !loaded;
  widthInput.disabled = !loaded;
  heightInput.disabled = !loaded;
  showBoxBtn.disabled = !loaded;
  confirmBtn.disabled = true;
}

async function openFile(file) {
  const url = URL.createObjectURL(file);
  try {
    await loadInto(image, url);
  } catch {
    URL.revokeObjectURL(url);
    if (source) URL.revokeObjectURL(source.url);
    source = null;
    image.removeAttribute('src');
    setLoaded(false);
    imageInfo.textContent = '';
    showMessage('この画像は読み込めませんでした。別の画像を選んでください。', true);
    return;
  }
  if (source) URL.revokeObjectURL(source.url);
  source = { name: file.name, url };

  const { naturalWidth: w, naturalHeight: h } = image;
  cropBox.setImage(w, h);
  setLoaded(true);
  widthInput.value = '';
  heightInput.value = '';
  imageInfo.textContent = `${file.name}（${w} × ${h} px）`;
  showMessage('切り取りたい幅と高さを入力して「枠を表示」を押してください。');
  fit();
}

// 画像を編集エリアに収まる大きさで表示する
function fit() {
  if (!source) return;
  const availW = Math.max(stage.clientWidth - STAGE_MARGIN, 1);
  const availH = Math.max(stage.clientHeight - STAGE_MARGIN, 1);
  const scale = Math.min(availW / image.naturalWidth, availH / image.naturalHeight);
  viewport.style.width = `${image.naturalWidth * scale}px`;
  viewport.style.height = `${image.naturalHeight * scale}px`;
  cropBox.setScale(scale);
}

function readSize() {
  const w = Number(widthInput.value);
  const h = Number(heightInput.value);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return null;
  return { w, h };
}

function applySize(recenter) {
  const size = readSize();
  if (!size) {
    showMessage('幅と高さは 1 以上の整数で入力してください。', true);
    return;
  }
  const clamped = recenter ? cropBox.place(size.w, size.h) : cropBox.resize(size.w, size.h);
  if (clamped) {
    const { w, h } = cropBox.rect;
    showMessage(`画像（${image.naturalWidth} × ${image.naturalHeight} px）に収まるよう ${w} × ${h} px にしました。`);
  } else {
    showMessage('枠をドラッグで移動、四隅のつまみで大きさを変えられます。');
  }
}

async function exportCrop(type) {
  const rect = { ...cropBox.rect };
  confirmBtn.disabled = true;
  try {
    const blob = await cropToBlob(image, rect, type);
    const name = buildFileName(source.name, rect, type);
    if (await saveBlob(blob, name)) {
      showMessage(`${name} を書き出しました。`);
    }
  } catch (err) {
    console.error(err);
    showMessage('切り取りに失敗しました。範囲を小さくしてもう一度試してください。', true);
  } finally {
    confirmBtn.disabled = false;
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  // 同じファイルを続けて選び直せるようにする
  fileInput.value = '';
  if (file) openFile(file);
});

sizeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (source) applySize(true);
});

for (const input of [widthInput, heightInput]) {
  input.addEventListener('change', () => {
    if (cropBox.rect) applySize(false);
  });
}

confirmBtn.addEventListener('click', () => {
  const { w, h } = cropBox.rect;
  formatSummary.textContent = `${w} × ${h} px で切り取ります。`;
  formatDialog.showModal();
});

formatDialog.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-type]');
  if (!button) return;
  formatDialog.close();
  if (FORMAT_LABELS[button.dataset.type]) exportCrop(button.dataset.type);
});

new ResizeObserver(fit).observe(stage);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('service worker registration failed', err);
  });
}
