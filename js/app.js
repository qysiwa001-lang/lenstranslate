'use strict';

/* ================= 配置 ================= */
const LANG_PATH = 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_fast';
const AUTO_LANGS = 'eng+jpn+kor';
const HISTORY_KEY = 'lenstranslate.history.v1';
const HISTORY_MAX = 50;

const LANG_NAMES = {
  auto: '自动检测', eng: '英语', jpn: '日语', kor: '韩语', fra: '法语',
  ita: '意大利语', spa: '西班牙语', deu: '德语', por: '葡萄牙语',
  rus: '俄语', vie: '越南语', tha: '泰语', ara: '阿拉伯语'
};

/* ================= DOM ================= */
const $ = (sel) => document.querySelector(sel);
const els = {
  camera: $('#camera'),
  snapshot: $('#snapshot'),
  viewfinder: $('#viewfinder'),
  statusBar: $('#statusBar'),
  statusText: $('#statusText'),
  progressWrap: $('#progressWrap'),
  progressFill: $('#progressFill'),
  progressLabel: $('#progressLabel'),
  errorState: $('#errorState'),
  errorText: $('#errorText'),
  errorUploadBtn: $('#errorUploadBtn'),
  srcLang: $('#srcLang'),
  captureBtn: $('#captureBtn'),
  uploadBtn: $('#uploadBtn'),
  fileInput: $('#fileInput'),
  sampleBtn: $('#sampleBtn'),
  resultSheet: $('#resultSheet'),
  srcLabel: $('#srcLabel'),
  srcText: $('#srcText'),
  dstText: $('#dstText'),
  copySrcBtn: $('#copySrcBtn'),
  copyDstBtn: $('#copyDstBtn'),
  retakeBtn: $('#retakeBtn'),
  closeSheetBtn: $('#closeSheetBtn'),
  historyBtn: $('#historyBtn'),
  historyDrawer: $('#historyDrawer'),
  historyList: $('#historyList'),
  historyEmpty: $('#historyEmpty'),
  clearHistoryBtn: $('#clearHistoryBtn'),
  closeDrawerBtn: $('#closeDrawerBtn'),
  toast: $('#toast')
};

let mediaStream = null;
let busy = false;
let workerCache = { key: null, worker: null };

/* ================= 工具 ================= */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function setStatus(text, mode) {
  els.statusText.textContent = text;
  els.statusBar.classList.toggle('busy', mode === 'busy');
  els.statusBar.classList.toggle('error', mode === 'error');
}

function showProgress() {
  els.progressWrap.hidden = false;
  setProgress(0, '准备中');
}
function setProgress(ratio, label) {
  const pct = Math.max(0, Math.min(100, Math.round((ratio || 0) * 100)));
  els.progressFill.style.width = pct + '%';
  if (label) els.progressLabel.textContent = label;
}
function hideProgress() { els.progressWrap.hidden = true; }

/* ================= 相机 ================= */
async function initCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError('当前环境无法访问相机：请通过 http://localhost 或 HTTPS 打开本页面，也可以使用相册上传图片。');
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    els.camera.srcObject = mediaStream;
    await els.camera.play();
    setStatus('相机已就绪，对准文字后点击快门', 'ready');
  } catch (err) {
    console.error('camera error:', err);
    let msg = '无法打开相机';
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      msg = '相机权限被拒绝，请在浏览器地址栏允许相机权限，或改用相册上传。';
    } else if (err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
      msg = '未检测到摄像头设备，可以改用相册上传图片翻译。';
    } else if (location.protocol === 'file:') {
      msg = '请通过 http://localhost 打开本页面（双击文件夹内的“启动译镜.bat”），或改用相册上传。';
    }
    showCameraError(msg);
  }
}

function showCameraError(msg) {
  els.errorText.textContent = msg;
  els.errorState.hidden = false;
  setStatus('相机不可用', 'error');
}

function captureFrame() {
  const video = els.camera;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('相机尚未就绪');
  return drawToCanvas(video, vw, vh);
}

function drawToCanvas(source, sw, sh) {
  const canvas = els.snapshot;
  const scale = Math.min(1, 1600 / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try { resolve(drawToCanvas(img, img.naturalWidth, img.naturalHeight)); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
    img.src = url;
  });
}

/* 内置示例：生成一张多语言招牌图，方便无相机时体验完整流程 */
function makeSampleCanvas() {
  const canvas = els.snapshot;
  canvas.width = 1080;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
  ctx.fillStyle = '#221e19';
  ctx.textAlign = 'center';
  ctx.font = '700 92px Georgia, serif';
  ctx.fillText('CAFE DE LA PAIX', 540, 190);
  ctx.font = '400 46px Georgia, serif';
  ctx.fillText('Bonjour et bienvenue !', 540, 320);
  ctx.fillText('Fresh coffee and croissants', 540, 420);
  ctx.fillText('Open every day 9:00 - 22:00', 540, 520);
  ctx.font = 'italic 40px Georgia, serif';
  ctx.fillText('Free wifi for all guests', 540, 630);
  return canvas;
}

/* ================= OCR ================= */
async function getWorker(langKey) {
  const langs = langKey === 'auto' ? AUTO_LANGS : langKey;
  if (workerCache.worker && workerCache.key === langs) return workerCache.worker;
  if (workerCache.worker) {
    try { await workerCache.worker.terminate(); } catch (e) { /* ignore */ }
    workerCache = { key: null, worker: null };
  }
  setStatus('首次使用该语言需下载识别模型…', 'busy');
  const worker = await Tesseract.createWorker(langs, 1, {
    langPath: LANG_PATH,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        setProgress(m.progress, '正在识别文字 ' + Math.round((m.progress || 0) * 100) + '%');
      } else if (m.status && m.status.indexOf('loading language') >= 0) {
        setProgress(m.progress || 0, '正在下载语言模型 ' + Math.round((m.progress || 0) * 100) + '%');
      }
    }
  });
  workerCache = { key: langs, worker };
  return worker;
}

function cleanOcrText(raw) {
  if (!raw) return '';
  return raw
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

/* ================= 翻译（Google gtx 优先，MyMemory 兜底） ================= */
function splitForTranslate(text) {
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const segs = [];
  let cur = '';
  const pushCur = () => { if (cur) { segs.push(cur); cur = ''; } };
  for (let line of lines) {
    while (line.length > 800) {
      pushCur();
      segs.push(line.slice(0, 800));
      line = line.slice(800);
    }
    if (cur && (cur + '\n' + line).length > 800) pushCur();
    cur = cur ? cur + '\n' + line : line;
  }
  pushCur();
  return segs.slice(0, 8);
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

async function translateGoogle(segs) {
  const out = [];
  for (const seg of segs) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(seg);
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) throw new Error('google translate http ' + res.status);
    const data = await res.json();
    const translated = (data && Array.isArray(data[0]))
      ? data[0].map(part => (part && part[0]) || '').join('')
      : '';
    if (!translated.trim()) throw new Error('google translate empty');
    out.push(translated);
  }
  return out.join('\n').trim();
}

async function translateMyMemory(segs) {
  const out = [];
  for (const seg of segs) {
    const clipped = seg.length > 450 ? seg.slice(0, 450) : seg;
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(clipped) + '&langpair=autodetect|zh-CN';
    const res = await fetchWithTimeout(url, 12000);
    if (!res.ok) throw new Error('mymemory http ' + res.status);
    const data = await res.json();
    const t = data && data.responseData && data.responseData.translatedText;
    if (!t || !t.trim()) throw new Error('mymemory empty');
    out.push(t.trim());
    if (segs.length > 1) await sleep(350);
  }
  return out.join('\n').trim();
}

let googleDead = false;
async function translateToChinese(text) {
  const segs = splitForTranslate(text);
  if (!segs.length) return { text: '', engine: 'none' };
  if (!googleDead) {
    try {
      return { text: await translateGoogle(segs), engine: 'Google' };
    } catch (e1) {
      googleDead = true;
      console.warn('google translate unreachable, switching to mymemory for this session:', e1);
    }
  }
  return { text: await translateMyMemory(segs), engine: 'MyMemory' };
}

/* 灰度 + 对比度拉伸，提升照片 OCR 质量 */
function enhanceForOcr(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const total = canvas.width * canvas.height;
  const gray = new Uint8Array(total);
  let min = 255, max = 0;
  for (let i = 0, j = 0; j < total; i += 4, j++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(30, max - min);
  for (let i = 0, j = 0; j < total; i += 4, j++) {
    const v = Math.max(0, Math.min(255, Math.round((gray[j] - min) * 255 / range)));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ================= 主管线：图像 -> OCR -> 翻译 ================= */
async function runPipeline(canvas) {
  if (busy) return;
  busy = true;
  els.captureBtn.disabled = true;
  hideSheet();
  showProgress();
  els.viewfinder.classList.add('scanning');
  try {
    const sel = els.srcLang.value;
    setStatus('加载识别模型…', 'busy');
    const worker = await getWorker(sel);
    setStatus('正在识别文字…', 'busy');
    const { data } = await worker.recognize(enhanceForOcr(canvas));
    const srcText = cleanOcrText(data && data.text);
    if (!srcText) {
      setStatus('未识别到文字，请靠近一点、保持清晰后重试', 'error');
      toast('未识别到文字');
      return;
    }
    setStatus('正在翻译成中文…', 'busy');
    setProgress(1, '翻译中…');
    const { text: dstText, engine } = await translateToChinese(srcText);
    if (!dstText) throw new Error('empty translation');
    showResult(srcText, dstText, sel, engine);
    addHistory({ src: srcText, dst: dstText, lang: sel, ts: Date.now() });
    setStatus('翻译完成', 'ready');
  } catch (err) {
    console.error('pipeline error:', err);
    setStatus('处理失败，请检查网络后重试', 'error');
    toast('翻译失败，请检查网络');
  } finally {
    busy = false;
    els.captureBtn.disabled = false;
    els.viewfinder.classList.remove('scanning');
    hideProgress();
  }
}

/* ================= 结果面板 ================= */
function showResult(src, dst, langKey, engine) {
  const name = LANG_NAMES[langKey] || langKey;
  els.srcLabel.textContent = '识别原文 · ' + name;
  els.srcText.textContent = src;
  els.dstText.textContent = dst;
  els.resultSheet.hidden = false;
  if (engine === 'MyMemory') toast('已切换备用翻译引擎');
}
function hideSheet() { els.resultSheet.hidden = true; }

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制到剪贴板');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); }
    catch (e2) { toast('复制失败'); }
    document.body.removeChild(ta);
  }
}

/* ================= 历史记录 ================= */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); }
  catch (e) { /* storage full / blocked */ }
}
function addHistory(item) {
  const list = loadHistory();
  list.unshift(item);
  saveHistory(list);
}
function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return (d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function renderHistory() {
  const list = loadHistory();
  els.historyList.innerHTML = '';
  els.historyEmpty.classList.toggle('show', list.length === 0);
  for (const item of list) {
    const li = document.createElement('li');
    const src = document.createElement('p');
    src.className = 'history-src';
    src.textContent = item.src;
    const dst = document.createElement('p');
    dst.className = 'history-dst';
    dst.textContent = item.dst;
    const meta = document.createElement('p');
    meta.className = 'history-meta';
    meta.textContent = (LANG_NAMES[item.lang] || item.lang || '自动') + ' → 中文 · ' + formatTime(item.ts);
    li.appendChild(src);
    li.appendChild(dst);
    li.appendChild(meta);
    li.addEventListener('click', () => {
      els.historyDrawer.hidden = true;
      showResult(item.src, item.dst, item.lang, 'history');
    });
    els.historyList.appendChild(li);
  }
}

/* ================= 事件绑定 ================= */
function bindEvents() {
  els.captureBtn.addEventListener('click', () => {
    if (busy) return;
    try {
      if (mediaStream) {
        runPipeline(captureFrame());
      } else {
        toast('相机不可用，请从相册选择图片');
        els.fileInput.click();
      }
    } catch (err) {
      console.error(err);
      toast('拍照失败，请重试');
    }
  });

  els.uploadBtn.addEventListener('click', () => els.fileInput.click());
  els.errorUploadBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => {
    const file = els.fileInput.files && els.fileInput.files[0];
    els.fileInput.value = '';
    if (!file) return;
    fileToCanvas(file)
      .then(canvas => runPipeline(canvas))
      .catch(err => { console.error(err); toast('图片读取失败'); });
  });

  els.sampleBtn.addEventListener('click', () => {
    if (busy) return;
    runPipeline(makeSampleCanvas());
  });

  els.srcLang.addEventListener('change', () => {
    const name = LANG_NAMES[els.srcLang.value] || '';
    setStatus('源语言：' + name + ' → 中文', 'ready');
  });

  els.copySrcBtn.addEventListener('click', () => copyText(els.srcText.textContent || ''));
  els.copyDstBtn.addEventListener('click', () => copyText(els.dstText.textContent || ''));
  els.retakeBtn.addEventListener('click', hideSheet);
  els.closeSheetBtn.addEventListener('click', hideSheet);

  els.historyBtn.addEventListener('click', () => {
    renderHistory();
    els.historyDrawer.hidden = false;
  });
  els.closeDrawerBtn.addEventListener('click', () => { els.historyDrawer.hidden = true; });
  els.clearHistoryBtn.addEventListener('click', () => {
    saveHistory([]);
    renderHistory();
    toast('历史已清空');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && mediaStream && els.camera.paused) {
      els.camera.play().catch(() => {});
    }
  });
}

/* ================= 启动 ================= */
bindEvents();
initCamera();

/* PWA：注册 Service Worker（离线外壳缓存） */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
