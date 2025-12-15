/* Thumbnail & Pinterest Post Maker (v2.1)
 * Enhancements:
 * 1) Image/Logo layers (upload PNG, drag/resize anywhere)
 * 2) Smart Modern Hook Presets: generate 10 hooks + styles from title
 */

const $ = (id) => document.getElementById(id);

const canvas = $("canvas");
const ctx = canvas.getContext("2d");

const formats = {
  youtube_16_9: { w: 1280, h: 720, safe: { x: 0.06, y: 0.08, w: 0.88, h: 0.84 } },
  pinterest_2_3: { w: 1000, h: 1500, safe: { x: 0.06, y: 0.06, w: 0.88, h: 0.88 } },
  story_9_16: { w: 1080, h: 1920, safe: { x: 0.06, y: 0.06, w: 0.88, h: 0.88 } },
};

const state = {
  formatKey: "youtube_16_9",
  bgFit: "cover",
  bgDim: 0.15,
  bgImage: null,
  bgImageSrc: "",
  layers: [],
  selectedLayerId: null,
  dragging: null,
  dpiScale: 1,
};

// ---------- Utils ----------
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function rgbaFromHex(hex, alpha=1){
  const h = hex.replace("#","").trim();
  const full = h.length === 3 ? h.split("").map(c=>c+c).join("") : h;
  const r = parseInt(full.slice(0,2),16);
  const g = parseInt(full.slice(2,4),16);
  const b = parseInt(full.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function setStatus(msg){ $("statusPill").textContent = msg; }

function pxBoxFromPct(boxPct){
  const { w, h } = formats[state.formatKey];
  return { x: boxPct.x*w, y: boxPct.y*h, w: boxPct.w*w, h: boxPct.h*h };
}
function pctBoxFromPx(boxPx){
  const { w, h } = formats[state.formatKey];
  return { x: boxPx.x/w, y: boxPx.y/h, w: boxPx.w/w, h: boxPx.h/h };
}

async function loadImageFromBlob(blob){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

// ---------- Layer Factories ----------
function makeTextLayer({ name="Text", text="YOUR HOOK", box=null } = {}){
  return {
    id: uid(),
    type: "text",
    name,
    visible: true,
    box: box ?? { x: 0.10, y: 0.12, w: 0.80, h: 0.28 },
    style: {
      fontFamily: "Bebas Neue",
      fontWeight: 900,
      fontSize: 110,
      autoFit: true,
      fill: "#ffffff",
      align: "center",
      uppercase: true,
      lineHeight: 1.05,

      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: 14,

      shadowOn: true,
      shadowColor: "#000000",
      shadowBlur: 18,
      shadowDx: 6,
      shadowDy: 6,

      boxOn: false,
      boxColor: "#000000",
      boxOpacity: 0.35,
      boxPad: 18,
      boxRadius: 24,
    },
    text,
  };
}

function makeImageLayer({ name="Logo", box=null } = {}){
  return {
    id: uid(),
    type: "image",
    name,
    visible: true,
    box: box ?? { x: 0.78, y: 0.78, w: 0.18, h: 0.18 },
    img: null,          // HTMLImageElement
    imgSrc: "",         // object URL
    fit: "contain",     // contain | cover
    opacity: 1.0,
    shadow: false,
  };
}

// ---------- Project ----------
function applyCanvasFormat(){
  const f = formats[state.formatKey];

  // internal pixel resolution (export quality)
  canvas.width  = f.w * state.dpiScale;
  canvas.height = f.h * state.dpiScale;

  // IMPORTANT: do NOT force fixed CSS pixel size
  // Let CSS scale it responsively without distortion
  canvas.style.width = "100%";
  canvas.style.height = "auto";

  ctx.setTransform(state.dpiScale,0,0,state.dpiScale,0,0);
}


function resetProject(){
  state.bgImage = null;
  state.bgImageSrc = "";
  state.layers = [
    makeTextLayer({ name: "Hook", text: "STOP DOING THIS", box: { x: 0.07, y: 0.12, w: 0.62, h: 0.32 } }),
    makeTextLayer({ name: "Badge", text: "NEW", box: { x: 0.73, y: 0.10, w: 0.22, h: 0.16 } }),
  ];

  // Badge styling
  const badge = state.layers[1];
  badge.style.fontFamily = "Anton";
  badge.style.fontSize = 90;
  badge.style.autoFit = true;
  badge.style.fill = "#ffffff";
  badge.style.strokeOn = false;
  badge.style.shadowOn = true;
  badge.style.boxOn = true;
  badge.style.boxColor = "#ff0000";
  badge.style.boxOpacity = 0.85;
  badge.style.boxRadius = 28;
  badge.style.boxPad = 14;

  state.selectedLayerId = state.layers[0].id;
  applyCanvasFormat();
  render();
  refreshLayersUI();
  refreshPropsUI();
  setStatus("New project created");
}

// ---------- Background ----------
function drawBackground(){
  const { w, h } = formats[state.formatKey];
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0,0,w,h);

  if (!state.bgImage) return;

  const img = state.bgImage;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  if (state.bgFit === "cover"){
    const scale = Math.max(w/iw, h/ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
  } else if (state.bgFit === "contain"){
    const scale = Math.min(w/iw, h/ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
  } else { // contain_blur
    ctx.save();
    ctx.filter = "blur(22px) saturate(1.05)";
    const scaleC = Math.max(w/iw, h/ih);
    const dwC = iw * scaleC, dhC = ih * scaleC;
    ctx.drawImage(img, (w-dwC)/2, (h-dhC)/2, dwC, dhC);
    ctx.restore();

    const scale = Math.min(w/iw, h/ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
  }

  if (state.bgDim > 0){
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, `rgba(0,0,0,${state.bgDim*0.7})`);
    g.addColorStop(0.55, `rgba(0,0,0,${state.bgDim})`);
    g.addColorStop(1, `rgba(0,0,0,${state.bgDim*0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }
}

// ---------- Text Rendering ----------
function buildFont(style, sizePx){
  const weight = style.fontWeight ?? 800;
  const family = style.fontFamily ?? "Inter";
  return `${weight} ${sizePx}px "${family}"`;
}

function wrapTextToBox(text, style, boxPx, fontSize){
  const maxWidth = Math.max(10, boxPx.w);
  const raw = (text ?? "").toString();
  const lines = [];

  const inputLines = raw.split("\n");
  for (const para of inputLines){
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0){ lines.push(""); continue; }
    let line = words[0];
    for (let i=1;i<words.length;i++){
      const test = line + " " + words[i];
      const w = ctx.measureText(test).width;
      if (w <= maxWidth) line = test;
      else { lines.push(line); line = words[i]; }
    }
    lines.push(line);
  }

  const lh = (style.lineHeight ?? 1.05) * fontSize;
  return { lines, lineHeightPx: lh, heightPx: lines.length * lh };
}

function textFits(style, text, boxPx, sizePx){
  ctx.font = buildFont(style, sizePx);
  return wrapTextToBox(text, style, boxPx, sizePx).heightPx <= boxPx.h;
}

function findBestFontSize(style, text, boxPx){
  const start = clamp(parseInt(style.fontSize ?? 96, 10), 8, 260);
  if (textFits(style, text, boxPx, start)) return start;
  for (let s = start; s >= 10; s -= 2){
    if (textFits(style, text, boxPx, s)) return s;
  }
  return 10;
}

function drawRoundedRect(x,y,w,h,r){
  const rr = clamp(r, 0, Math.min(w,h)/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

function drawTextLayer(layer){
  if (!layer.visible) return;

  const box = pxBoxFromPct(layer.box);
  const s = layer.style;

  const pad = s.boxOn ? (s.boxPad ?? 0) : 0;
  const inner = {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(10, box.w - pad*2),
    h: Math.max(10, box.h - pad*2),
  };

  let text = (layer.text ?? "").toString();
  if (s.uppercase) text = text.toUpperCase();

  if (s.boxOn){
    ctx.save();
    ctx.fillStyle = rgbaFromHex(s.boxColor ?? "#000000", clamp(s.boxOpacity ?? 0.35, 0, 1));
    drawRoundedRect(box.x, box.y, box.w, box.h, s.boxRadius ?? 24);
    ctx.fill();
    ctx.restore();
  }

  let sizePx = clamp(parseInt(s.fontSize ?? 96, 10), 8, 260);
  if (s.autoFit) sizePx = findBestFontSize(s, text, inner);

  ctx.save();
  ctx.font = buildFont(s, sizePx);
  ctx.textBaseline = "top";

  const layout = wrapTextToBox(text, s, inner, sizePx);
  const startY = inner.y + (inner.h - layout.heightPx)/2;

  const align = s.align ?? "center";
  ctx.textAlign = align;
  const anchorX = align === "left" ? inner.x
    : align === "right" ? (inner.x + inner.w)
    : (inner.x + inner.w/2);

  if (s.shadowOn){
    ctx.shadowColor = rgbaFromHex(s.shadowColor ?? "#000000", 0.55);
    ctx.shadowBlur = clamp(parseFloat(s.shadowBlur ?? 18), 0, 80);
    ctx.shadowOffsetX = clamp(parseFloat(s.shadowDx ?? 6), -80, 80);
    ctx.shadowOffsetY = clamp(parseFloat(s.shadowDy ?? 6), -80, 80);
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  if (s.strokeOn){
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = s.strokeColor ?? "#000";
    ctx.lineWidth = clamp(parseFloat(s.strokeWidth ?? 10), 0, 60);
  }

  ctx.fillStyle = s.fill ?? "#fff";

  for (let i=0;i<layout.lines.length;i++){
    const line = layout.lines[i];
    const y = startY + i * layout.lineHeightPx;
    if (s.strokeOn && (s.strokeWidth ?? 0) > 0) ctx.strokeText(line, anchorX, y);
    ctx.fillText(line, anchorX, y);
  }

  ctx.restore();
}

// ---------- Image Rendering ----------
function drawImageLayer(layer){
  if (!layer.visible) return;
  const box = pxBoxFromPct(layer.box);

  ctx.save();
  ctx.globalAlpha = clamp(layer.opacity ?? 1, 0, 1);

  if (layer.shadow){
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  if (!layer.img){
    // placeholder
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    drawRoundedRect(box.x, box.y, box.w, box.h, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "rgba(232,238,252,0.8)";
    ctx.font = `800 16px "Inter"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Upload Image", box.x + box.w/2, box.y + box.h/2);
    ctx.restore();
    return;
  }

  const img = layer.img;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  if ((layer.fit ?? "contain") === "cover"){
    const scale = Math.max(box.w/iw, box.h/ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, box.x + (box.w - dw)/2, box.y + (box.h - dh)/2, dw, dh);
  } else { // contain
    const scale = Math.min(box.w/iw, box.h/ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, box.x + (box.w - dw)/2, box.y + (box.h - dh)/2, dw, dh);
  }

  ctx.restore();
}

// ---------- Selection / Handles ----------
function getHandles(box){
  const s = 10;
  const hs = [
    { key:"nw", x: box.x - s/2, y: box.y - s/2 },
    { key:"n",  x: box.x + box.w/2 - s/2, y: box.y - s/2 },
    { key:"ne", x: box.x + box.w - s/2, y: box.y - s/2 },
    { key:"e",  x: box.x + box.w - s/2, y: box.y + box.h/2 - s/2 },
    { key:"se", x: box.x + box.w - s/2, y: box.y + box.h - s/2 },
    { key:"s",  x: box.x + box.w/2 - s/2, y: box.y + box.h - s/2 },
    { key:"sw", x: box.x - s/2, y: box.y + box.h - s/2 },
    { key:"w",  x: box.x - s/2, y: box.y + box.h/2 - s/2 },
  ];
  return hs.map(h => ({...h, w:s, h:s}));
}
function hitTestHandle(mx,my, box){
  const handles = getHandles(box);
  for (const h of handles){
    if (mx >= h.x && mx <= h.x+h.w && my >= h.y && my <= h.y+h.h) return h.key;
  }
  return null;
}
function hitTestBox(mx,my, box){
  return (mx >= box.x && mx <= box.x+box.w && my >= box.y && my <= box.y+box.h);
}

function drawSelection(){
  const layer = selectedLayer();
  if (!layer || !layer.visible) return;

  const box = pxBoxFromPct(layer.box);
  ctx.save();

  // safe area
  const safe = formats[state.formatKey].safe;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4,6]);
  ctx.strokeRect(safe.x*formats[state.formatKey].w, safe.y*formats[state.formatKey].h,
                 safe.w*formats[state.formatKey].w, safe.h*formats[state.formatKey].h);
  ctx.setLineDash([]);

  // selection box
  ctx.strokeStyle = "rgba(90,167,255,0.95)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6,4]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.setLineDash([]);

  // handles
  ctx.fillStyle = "rgba(90,167,255,1)";
  for (const h of getHandles(box)) ctx.fillRect(h.x, h.y, h.w, h.h);

  ctx.restore();
}

// ---------- Render ----------
function render(){
  drawBackground();
  for (const layer of state.layers){
    if (!layer.visible) continue;
    if (layer.type === "image") drawImageLayer(layer);
    if (layer.type === "text") drawTextLayer(layer);
  }
  drawSelection();
}

// ---------- UI (Layers) ----------
function refreshLayersUI(){
  const list = $("layersList");
  list.innerHTML = "";

  for (const layer of state.layers){
    const item = document.createElement("div");
    item.className = "layer-item" + (layer.id === state.selectedLayerId ? " active" : "");
    item.dataset.id = layer.id;

    const left = document.createElement("div");
    left.className = "layer-left";

    const nm = document.createElement("div");
    nm.className = "layer-name";
    nm.textContent = layer.name;

    const meta = document.createElement("div");
    meta.className = "layer-meta";
    meta.textContent = `${layer.visible ? "Visible" : "Hidden"} • ${layer.type === "image" ? "Image" : "Text"}`;

    left.appendChild(nm);
    left.appendChild(meta);

    const eye = document.createElement("button");
    eye.className = "layer-eye";
    eye.title = layer.visible ? "Hide layer" : "Show layer";
    eye.textContent = layer.visible ? "👁️" : "🚫";
    eye.addEventListener("click", (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      refreshLayersUI();
      render();
    });

    item.appendChild(left);
    item.appendChild(eye);

    item.addEventListener("click", () => {
      state.selectedLayerId = layer.id;
      refreshLayersUI();
      refreshPropsUI();
      render();
    });

    list.appendChild(item);
  }
}

// ---------- UI (Props) ----------
function selectedLayer(){
  return state.layers.find(l => l.id === state.selectedLayerId) || null;
}

function showPropsNone(){
  $("noSelection").classList.remove("hidden");
  $("layerPropsText").classList.add("hidden");
  $("layerPropsImage").classList.add("hidden");
}

function showPropsText(){
  $("noSelection").classList.add("hidden");
  $("layerPropsText").classList.remove("hidden");
  $("layerPropsImage").classList.add("hidden");
}

function showPropsImage(){
  $("noSelection").classList.add("hidden");
  $("layerPropsText").classList.add("hidden");
  $("layerPropsImage").classList.remove("hidden");
}

function refreshPropsUI(){
  const layer = selectedLayer();
  if (!layer){ showPropsNone(); return; }

  if (layer.type === "text"){
    showPropsText();
    const s = layer.style;

    $("propName").value = layer.name ?? "";
    $("propText").value = layer.text ?? "";
    $("propFont").value = s.fontFamily ?? "Inter";
    $("propWeight").value = String(s.fontWeight ?? 800);
    $("propAutoFit").value = s.autoFit ? "yes" : "no";
    $("propFontSize").value = parseInt(s.fontSize ?? 96, 10);
    $("propFill").value = s.fill ?? "#ffffff";
    $("propAlign").value = s.align ?? "center";
    $("propUppercase").value = s.uppercase ? "yes" : "no";
    $("propLineHeight").value = parseFloat(s.lineHeight ?? 1.05);

    $("propStrokeOn").value = s.strokeOn ? "yes" : "no";
    $("propStrokeWidth").value = parseFloat(s.strokeWidth ?? 14);
    $("propStrokeColor").value = s.strokeColor ?? "#000000";

    $("propShadowOn").value = s.shadowOn ? "yes" : "no";
    $("propShadowBlur").value = parseFloat(s.shadowBlur ?? 18);
    $("propShadowDx").value = parseFloat(s.shadowDx ?? 6);
    $("propShadowDy").value = parseFloat(s.shadowDy ?? 6);
    $("propShadowColor").value = s.shadowColor ?? "#000000";

    $("propBoxOn").value = s.boxOn ? "yes" : "no";
    $("propBoxPad").value = parseFloat(s.boxPad ?? 18);
    $("propBoxRadius").value = parseFloat(s.boxRadius ?? 24);
    $("propBoxColor").value = s.boxColor ?? "#000000";
    $("propBoxOpacity").value = parseFloat(s.boxOpacity ?? 0.35);
    $("propBoxOpacityVal").textContent = Number($("propBoxOpacity").value).toFixed(2);
    return;
  }

  if (layer.type === "image"){
    showPropsImage();
    $("imgPropName").value = layer.name ?? "";
    $("imgPropOpacity").value = clamp(layer.opacity ?? 1, 0, 1);
    $("imgPropOpacityVal").textContent = Number($("imgPropOpacity").value).toFixed(2);
    $("imgPropFit").value = layer.fit ?? "contain";
    $("imgPropShadow").value = layer.shadow ? "yes" : "no";
  }
}

function bindTextProps(){
  const bind = (id, fn) => {
    $(id).addEventListener("input", () => {
      const layer = selectedLayer();
      if (!layer || layer.type !== "text") return;
      fn(layer);
      refreshLayersUI();
      render();
    });
    $(id).addEventListener("change", () => {
      const layer = selectedLayer();
      if (!layer || layer.type !== "text") return;
      fn(layer);
      refreshLayersUI();
      render();
    });
  };

  bind("propName", (l) => l.name = $("propName").value);
  bind("propText", (l) => l.text = $("propText").value);
  bind("propFont", (l) => l.style.fontFamily = $("propFont").value);
  bind("propWeight", (l) => l.style.fontWeight = parseInt($("propWeight").value, 10));
  bind("propAutoFit", (l) => l.style.autoFit = $("propAutoFit").value === "yes");
  bind("propFontSize", (l) => l.style.fontSize = clamp(parseInt($("propFontSize").value || "96", 10), 8, 260));
  bind("propFill", (l) => l.style.fill = $("propFill").value);
  bind("propAlign", (l) => l.style.align = $("propAlign").value);
  bind("propUppercase", (l) => l.style.uppercase = $("propUppercase").value === "yes");
  bind("propLineHeight", (l) => l.style.lineHeight = clamp(parseFloat($("propLineHeight").value || "1.05"), 0.8, 1.8));

  bind("propStrokeOn", (l) => l.style.strokeOn = $("propStrokeOn").value === "yes");
  bind("propStrokeWidth", (l) => l.style.strokeWidth = clamp(parseFloat($("propStrokeWidth").value || "0"), 0, 60));
  bind("propStrokeColor", (l) => l.style.strokeColor = $("propStrokeColor").value);

  bind("propShadowOn", (l) => l.style.shadowOn = $("propShadowOn").value === "yes");
  bind("propShadowBlur", (l) => l.style.shadowBlur = clamp(parseFloat($("propShadowBlur").value || "0"), 0, 80));
  bind("propShadowDx", (l) => l.style.shadowDx = clamp(parseFloat($("propShadowDx").value || "0"), -80, 80));
  bind("propShadowDy", (l) => l.style.shadowDy = clamp(parseFloat($("propShadowDy").value || "0"), -80, 80));
  bind("propShadowColor", (l) => l.style.shadowColor = $("propShadowColor").value);

  bind("propBoxOn", (l) => l.style.boxOn = $("propBoxOn").value === "yes");
  bind("propBoxPad", (l) => l.style.boxPad = clamp(parseFloat($("propBoxPad").value || "0"), 0, 80));
  bind("propBoxRadius", (l) => l.style.boxRadius = clamp(parseFloat($("propBoxRadius").value || "0"), 0, 120));
  bind("propBoxColor", (l) => l.style.boxColor = $("propBoxColor").value);
  bind("propBoxOpacity", (l) => {
    l.style.boxOpacity = clamp(parseFloat($("propBoxOpacity").value || "0.35"), 0, 1);
    $("propBoxOpacityVal").textContent = Number($("propBoxOpacity").value).toFixed(2);
  });

  $("btnSnapSafe").addEventListener("click", () => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "text") return;
    const safe = formats[state.formatKey].safe;
    layer.box.x = clamp(layer.box.x, safe.x, safe.x + safe.w - layer.box.w);
    layer.box.y = clamp(layer.box.y, safe.y, safe.y + safe.h - layer.box.h);
    render();
  });

  $("btnAutoContrast").addEventListener("click", () => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "text" || !state.bgImage) return;
    // quick luminance sample
    const box = pxBoxFromPct(layer.box);
    const { w, h } = formats[state.formatKey];

    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");

    // draw background similarly
    tctx.fillStyle = "#0a1020"; tctx.fillRect(0,0,w,h);
    const img = state.bgImage;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const fit = state.bgFit;
    if (fit === "cover"){
      const scale = Math.max(w/iw, h/ih);
      const dw = iw * scale, dh = ih * scale;
      tctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
    } else if (fit === "contain"){
      const scale = Math.min(w/iw, h/ih);
      const dw = iw * scale, dh = ih * scale;
      tctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
    } else {
      tctx.save(); tctx.filter = "blur(22px) saturate(1.05)";
      const scaleC = Math.max(w/iw, h/ih);
      const dwC = iw * scaleC, dhC = ih * scaleC;
      tctx.drawImage(img, (w-dwC)/2, (h-dhC)/2, dwC, dhC);
      tctx.restore();

      const scale = Math.min(w/iw, h/ih);
      const dw = iw * scale, dh = ih * scale;
      tctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
    }

    if (state.bgDim > 0){
      const g = tctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0, `rgba(0,0,0,${state.bgDim*0.7})`);
      g.addColorStop(0.55, `rgba(0,0,0,${state.bgDim})`);
      g.addColorStop(1, `rgba(0,0,0,${state.bgDim*0.85})`);
      tctx.fillStyle = g; tctx.fillRect(0,0,w,h);
    }

    const samples = [
      {x: box.x + box.w*0.25, y: box.y + box.h*0.35},
      {x: box.x + box.w*0.50, y: box.y + box.h*0.50},
      {x: box.x + box.w*0.75, y: box.y + box.h*0.65},
    ];

    let sum = 0;
    for (const p of samples){
      const data = tctx.getImageData(clamp(Math.floor(p.x),0,w-1), clamp(Math.floor(p.y),0,h-1), 1,1).data;
      const lum = 0.2126*data[0] + 0.7152*data[1] + 0.0722*data[2];
      sum += lum;
    }
    const avg = sum / samples.length;

    layer.style.fill = (avg > 145) ? "#000000" : "#ffffff";
    layer.style.strokeColor = (avg > 145) ? "#ffffff" : "#000000";
    refreshPropsUI();
    render();
  });
}

function bindImageProps(){
  $("imgPropName").addEventListener("input", () => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "image") return;
    layer.name = $("imgPropName").value;
    refreshLayersUI();
    render();
  });

  $("imgPropOpacity").addEventListener("input", () => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "image") return;
    layer.opacity = clamp(parseFloat($("imgPropOpacity").value || "1"), 0, 1);
    $("imgPropOpacityVal").textContent = Number(layer.opacity).toFixed(2);
    render();
  });

  $("imgPropFit").addEventListener("change", () => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "image") return;
    layer.fit = $("imgPropFit").value;
    render();
  });

  $("imgPropShadow").addEventListener("change", () => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "image") return;
    layer.shadow = $("imgPropShadow").value === "yes";
    render();
  });

  $("imgPropFile").addEventListener("change", async (e) => {
    const layer = selectedLayer();
    if (!layer || layer.type !== "image") return;
    const file = e.target.files?.[0];
    if (!file) return;
    const img = await loadImageFromBlob(file);
    layer.img = img;
    layer.imgSrc = img.src;
    render();
    setStatus("Logo/Image loaded into layer");
  });
}

// ---------- Mouse (drag/resize both text & image) ----------
function getMousePos(evt){
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (formats[state.formatKey].w / rect.width);
  const y = (evt.clientY - rect.top) * (formats[state.formatKey].h / rect.height);
  return { x, y };
}

canvas.addEventListener("mousedown", (e) => {
  const { x:mx, y:my } = getMousePos(e);

  // select topmost layer under cursor if click outside selected
  const selected = selectedLayer();
  if (!selected || !hitTestBox(mx, my, pxBoxFromPct(selected.box))){
    for (let i=state.layers.length-1; i>=0; i--){
      const L = state.layers[i];
      if (!L.visible) continue;
      const b = pxBoxFromPct(L.box);
      if (hitTestBox(mx,my,b)){
        state.selectedLayerId = L.id;
        refreshLayersUI();
        refreshPropsUI();
        render();
        break;
      }
    }
  }

  const layer = selectedLayer();
  if (!layer) return;
  const box = pxBoxFromPct(layer.box);

  const handle = hitTestHandle(mx,my,box);
  if (handle){
    state.dragging = { id: layer.id, mode:"resize", handle, startX: mx, startY: my, startBox: { ...box } };
    return;
  }
  if (hitTestBox(mx,my,box)){
    state.dragging = { id: layer.id, mode:"move", startX: mx, startY: my, startBox: { ...box } };
    return;
  }
});

window.addEventListener("mousemove", (e) => {
  if (!state.dragging) return;
  const layer = state.layers.find(l => l.id === state.dragging.id);
  if (!layer) return;

  const { x:mx, y:my } = getMousePos(e);
  const dx = mx - state.dragging.startX;
  const dy = my - state.dragging.startY;

  const { w:W, h:H } = formats[state.formatKey];
  const minSize = 30;

  let box = { ...state.dragging.startBox };

  if (state.dragging.mode === "move"){
    let ndx = dx, ndy = dy;
    if (e.shiftKey){
      if (Math.abs(dx) > Math.abs(dy)) ndy = 0;
      else ndx = 0;
    }
    box.x += ndx; box.y += ndy;
    box.x = clamp(box.x, 0, W - box.w);
    box.y = clamp(box.y, 0, H - box.h);
  } else {
    const h = state.dragging.handle;
    const apply = (left, top, right, bottom) => {
      if (left){
        const nx = clamp(box.x + dx, 0, box.x + box.w - minSize);
        box.w = box.x + box.w - nx; box.x = nx;
      }
      if (right) box.w = clamp(box.w + dx, minSize, W - box.x);
      if (top){
        const ny = clamp(box.y + dy, 0, box.y + box.h - minSize);
        box.h = box.y + box.h - ny; box.y = ny;
      }
      if (bottom) box.h = clamp(box.h + dy, minSize, H - box.y);
    };
    if (h==="nw") apply(true,true,false,false);
    if (h==="n")  apply(false,true,false,false);
    if (h==="ne") apply(false,true,true,false);
    if (h==="e")  apply(false,false,true,false);
    if (h==="se") apply(false,false,true,true);
    if (h==="s")  apply(false,false,false,true);
    if (h==="sw") apply(true,false,false,true);
    if (h==="w")  apply(true,false,false,false);

    box.x = clamp(box.x, 0, W - minSize);
    box.y = clamp(box.y, 0, H - minSize);
    box.w = clamp(box.w, minSize, W - box.x);
    box.h = clamp(box.h, minSize, H - box.y);
  }

  layer.box = pctBoxFromPx(box);
  render();
});

window.addEventListener("mouseup", () => { state.dragging = null; });

// ---------- Background Load (file + paste) ----------
$("imageInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const img = await loadImageFromBlob(file);
  state.bgImage = img;
  state.bgImageSrc = img.src;
  render();
  setStatus("Background loaded");
});

window.addEventListener("paste", async (e) => {
  const items = e.clipboardData?.items || [];
  for (const it of items){
    if (it.type && it.type.startsWith("image/")){
      const blob = it.getAsFile();
      if (!blob) continue;
      const img = await loadImageFromBlob(blob);
      state.bgImage = img;
      state.bgImageSrc = img.src;
      render();
      setStatus("Pasted background image");
      return;
    }
  }
});

// ---------- Project Controls ----------
$("formatSelect").addEventListener("change", () => {
  state.formatKey = $("formatSelect").value;
  applyCanvasFormat();
  render();
  setStatus("Format changed");
});

$("bgFitSelect").addEventListener("change", () => { state.bgFit = $("bgFitSelect").value; render(); });

$("bgDim").addEventListener("input", () => {
  state.bgDim = parseFloat($("bgDim").value);
  $("bgDimVal").textContent = state.bgDim.toFixed(2);
  render();
});

$("jpgQuality").addEventListener("input", () => {
  $("jpgQualityVal").textContent = Number($("jpgQuality").value).toFixed(2);
});

// ---------- Layer Buttons ----------
$("btnAddTextLayer").addEventListener("click", () => {
  const l = makeTextLayer({ name: `Text ${state.layers.length+1}`, text: "TYPE HERE", box: { x: 0.12, y: 0.45, w: 0.76, h: 0.20 } });
  l.style.fontFamily = "Montserrat";
  l.style.fontWeight = 900;
  l.style.fontSize = 90;
  state.layers.push(l);
  state.selectedLayerId = l.id;
  refreshLayersUI();
  refreshPropsUI();
  render();
});

$("btnAddImageLayer").addEventListener("click", () => {
  const l = makeImageLayer({ name: `Logo ${state.layers.length+1}`, box: { x: 0.78, y: 0.78, w: 0.18, h: 0.18 } });
  state.layers.push(l);
  state.selectedLayerId = l.id;
  refreshLayersUI();
  refreshPropsUI();
  render();
  setStatus("Added Image/Logo layer (upload in right panel)");
});

$("btnDeleteLayer").addEventListener("click", () => {
  const id = state.selectedLayerId;
  if (!id) return;
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx === -1) return;
  state.layers.splice(idx,1);
  state.selectedLayerId = state.layers[idx-1]?.id || state.layers[0]?.id || null;
  refreshLayersUI();
  refreshPropsUI();
  render();
});

$("btnDuplicateLayer").addEventListener("click", () => {
  const layer = selectedLayer();
  if (!layer) return;
  const copy = JSON.parse(JSON.stringify(layer));
  copy.id = uid();
  copy.name = (layer.name || "Layer") + " copy";
  copy.box = { ...layer.box, x: clamp(layer.box.x + 0.02, 0, 0.98), y: clamp(layer.box.y + 0.02, 0, 0.98) };

  // Image layers need special handling (cannot JSON-clone HTMLImageElement)
  if (layer.type === "image"){
    copy.img = layer.img || null;
    copy.imgSrc = layer.imgSrc || "";
  }
  state.layers.push(copy);
  state.selectedLayerId = copy.id;
  refreshLayersUI();
  refreshPropsUI();
  render();
});

$("btnBringForward").addEventListener("click", () => {
  const id = state.selectedLayerId;
  if (!id) return;
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx === -1 || idx === state.layers.length-1) return;
  [state.layers[idx], state.layers[idx+1]] = [state.layers[idx+1], state.layers[idx]];
  refreshLayersUI(); render();
});

$("btnSendBackward").addEventListener("click", () => {
  const id = state.selectedLayerId;
  if (!id) return;
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx <= 0) return;
  [state.layers[idx], state.layers[idx-1]] = [state.layers[idx-1], state.layers[idx]];
  refreshLayersUI(); render();
});

$("btnNew").addEventListener("click", resetProject);

// ---------- Templates ----------
function clearLayersKeepBG(){ state.layers = []; state.selectedLayerId = null; }

$("tplYouTubeHook").addEventListener("click", () => {
  state.formatKey = "youtube_16_9";
  $("formatSelect").value = state.formatKey;
  applyCanvasFormat();

  clearLayersKeepBG();
  const hook = makeTextLayer({ name:"Hook", text:"3 MISTAKES\nYOU MUST AVOID", box:{x:0.06,y:0.14,w:0.62,h:0.40} });
  hook.style.fontFamily = "Bebas Neue"; hook.style.fontWeight = 900; hook.style.fontSize = 130;
  hook.style.strokeOn = true; hook.style.strokeWidth = 16; hook.style.shadowOn = true;

  const badge = makeTextLayer({ name:"Badge", text:"WATCH", box:{x:0.72,y:0.12,w:0.24,h:0.18} });
  badge.style.fontFamily = "Anton";
  badge.style.autoFit = true; badge.style.strokeOn = false;
  badge.style.boxOn = true; badge.style.boxColor = "#ff2d2d"; badge.style.boxOpacity = 0.88; badge.style.boxRadius = 26;

  state.layers.push(hook, badge);
  state.selectedLayerId = hook.id;
  refreshLayersUI(); refreshPropsUI(); render();
});

$("tplYouTubeCenter").addEventListener("click", () => {
  state.formatKey = "youtube_16_9";
  $("formatSelect").value = state.formatKey;
  applyCanvasFormat();

  clearLayersKeepBG();
  const main = makeTextLayer({ name:"Center Hook", text:"THIS CHANGES\nEVERYTHING", box:{x:0.10,y:0.22,w:0.80,h:0.42} });
  main.style.fontFamily = "Anton";
  main.style.fontSize = 160;
  main.style.strokeOn = true; main.style.strokeWidth = 18; main.style.shadowOn = true;
  main.style.align = "center";

  state.layers.push(main);
  state.selectedLayerId = main.id;
  refreshLayersUI(); refreshPropsUI(); render();
});

$("tplPinterestTitle").addEventListener("click", () => {
  state.formatKey = "pinterest_2_3";
  $("formatSelect").value = state.formatKey;
  applyCanvasFormat();

  clearLayersKeepBG();
  const title = makeTextLayer({ name:"Title", text:"SOCIAL MEDIA\nCONTENT IDEAS", box:{x:0.07,y:0.08,w:0.86,h:0.22} });
  title.style.fontFamily = "Montserrat"; title.style.fontWeight = 900; title.style.fontSize = 110;
  title.style.strokeOn = true; title.style.strokeWidth = 12; title.style.shadowOn = true;

  const bullets = makeTextLayer({ name:"Bullets", text:"• 30-day plan\n• Hooks + CTAs\n• Templates included", box:{x:0.10,y:0.34,w:0.80,h:0.30} });
  bullets.style.fontFamily = "Inter"; bullets.style.fontWeight = 800; bullets.style.fontSize = 66;
  bullets.style.strokeOn = true; bullets.style.strokeWidth = 10; bullets.style.align = "left";
  bullets.style.uppercase = false;
  bullets.style.boxOn = true; bullets.style.boxColor = "#000000"; bullets.style.boxOpacity = 0.35; bullets.style.boxRadius = 26;

  const footer = makeTextLayer({ name:"Footer", text:"Read more at: yoursite.com", box:{x:0.10,y:0.86,w:0.80,h:0.10} });
  footer.style.fontFamily = "Inter"; footer.style.fontWeight = 700; footer.style.fontSize = 40;
  footer.style.strokeOn = false; footer.style.shadowOn = false;
  footer.style.boxOn = true; footer.style.boxColor = "#000000"; footer.style.boxOpacity = 0.45; footer.style.boxRadius = 22;
  footer.style.uppercase = false;

  state.layers.push(title, bullets, footer);
  state.selectedLayerId = title.id;
  refreshLayersUI(); refreshPropsUI(); render();
});

$("tplStoryPunchy").addEventListener("click", () => {
  state.formatKey = "story_9_16";
  $("formatSelect").value = state.formatKey;
  applyCanvasFormat();

  clearLayersKeepBG();
  const top = makeTextLayer({ name:"Title", text:"ONE TRICK\nTO BOOST VIEWS", box:{x:0.08,y:0.12,w:0.84,h:0.26} });
  top.style.fontFamily = "Anton"; top.style.fontSize = 140;
  top.style.strokeOn = true; top.style.strokeWidth = 14;

  const badge = makeTextLayer({ name:"Badge", text:"SAVE THIS", box:{x:0.24,y:0.72,w:0.52,h:0.12} });
  badge.style.fontFamily = "Montserrat"; badge.style.fontWeight = 900; badge.style.fontSize = 72;
  badge.style.strokeOn = false;
  badge.style.boxOn = true; badge.style.boxColor = "#5aa7ff"; badge.style.boxOpacity = 0.85; badge.style.boxRadius = 28;

  state.layers.push(top, badge);
  state.selectedLayerId = top.id;
  refreshLayersUI(); refreshPropsUI(); render();
});

// ---------- Export ----------
$("btnExport").addEventListener("click", () => {
  const type = $("exportType").value;
  let dataUrl = "";
  if (type === "png"){
    dataUrl = canvas.toDataURL("image/png");
  } else {
    const q = clamp(parseFloat($("jpgQuality").value || "0.92"), 0.4, 1);
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  const { w, h } = formats[state.formatKey];
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  const a = document.createElement("a");
  a.download = `design_${state.formatKey}_${w}x${h}_${ts}.${type}`;
  a.href = dataUrl;
  a.click();
  setStatus(`Exported ${type.toUpperCase()}`);
});

// ---------- Smart Modern Hook Presets ----------
const STOP_WORDS = new Set(["the","a","an","and","or","to","of","for","in","on","with","your","you","is","are","this","that","it","from","at","by","as","how","what","why","when","best","top"]);

function extractKeywords(title){
  const clean = (title || "")
    .replace(/[^\w\s$%-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = clean.split(" ").filter(Boolean);
  const keywords = [];
  for (const w of words){
    const low = w.toLowerCase();
    if (low.length <= 2) continue;
    if (STOP_WORDS.has(low)) continue;
    // keep numbers/$
    keywords.push(w);
  }
  // prefer first few unique
  const uniq = [];
  for (const k of keywords){
    const low = k.toLowerCase();
    if (!uniq.some(u => u.toLowerCase() === low)) uniq.push(k);
  }
  return {
    clean,
    k1: uniq[0] || "THIS",
    k2: uniq[1] || "TRICK",
    k3: uniq[2] || "TODAY",
    uniq
  };
}

function modernStylePresets(){
  // These are “pro thumbnail” style combos you can click-apply.
  return [
    {
      label: "Bold Outline",
      apply: (layer) => {
        layer.style.fontFamily = "Anton";
        layer.style.fontWeight = 900;
        layer.style.fill = "#ffffff";
        layer.style.strokeOn = true;
        layer.style.strokeColor = "#000000";
        layer.style.strokeWidth = 18;
        layer.style.shadowOn = true;
        layer.style.shadowBlur = 18;
        layer.style.shadowDx = 6;
        layer.style.shadowDy = 6;
        layer.style.boxOn = false;
        layer.style.uppercase = true;
        layer.style.align = "center";
        layer.style.autoFit = true;
        layer.style.lineHeight = 1.0;
      }
    },
    {
      label: "Blue Pill",
      apply: (layer) => {
        layer.style.fontFamily = "Montserrat";
        layer.style.fontWeight = 900;
        layer.style.fill = "#ffffff";
        layer.style.strokeOn = false;
        layer.style.shadowOn = true;
        layer.style.shadowBlur = 14;
        layer.style.shadowDx = 4;
        layer.style.shadowDy = 4;
        layer.style.boxOn = true;
        layer.style.boxColor = "#5aa7ff";
        layer.style.boxOpacity = 0.88;
        layer.style.boxRadius = 32;
        layer.style.boxPad = 18;
        layer.style.uppercase = true;
        layer.style.align = "center";
        layer.style.autoFit = true;
        layer.style.lineHeight = 1.0;
      }
    },
    {
      label: "Dark Glass",
      apply: (layer) => {
        layer.style.fontFamily = "Inter";
        layer.style.fontWeight = 900;
        layer.style.fill = "#ffffff";
        layer.style.strokeOn = true;
        layer.style.strokeColor = "#000000";
        layer.style.strokeWidth = 10;
        layer.style.shadowOn = true;
        layer.style.shadowBlur = 16;
        layer.style.shadowDx = 5;
        layer.style.shadowDy = 5;
        layer.style.boxOn = true;
        layer.style.boxColor = "#000000";
        layer.style.boxOpacity = 0.35;
        layer.style.boxRadius = 26;
        layer.style.boxPad = 16;
        layer.style.uppercase = true;
        layer.style.align = "left";
        layer.style.autoFit = true;
        layer.style.lineHeight = 1.05;
      }
    },
    {
      label: "Clean Minimal",
      apply: (layer) => {
        layer.style.fontFamily = "Oswald";
        layer.style.fontWeight = 700;
        layer.style.fill = "#ffffff";
        layer.style.strokeOn = false;
        layer.style.shadowOn = true;
        layer.style.shadowBlur = 12;
        layer.style.shadowDx = 3;
        layer.style.shadowDy = 3;
        layer.style.boxOn = false;
        layer.style.uppercase = true;
        layer.style.align = "center";
        layer.style.autoFit = true;
        layer.style.lineHeight = 1.0;
      }
    },
    {
      label: "Red Alert",
      apply: (layer) => {
        layer.style.fontFamily = "Bebas Neue";
        layer.style.fontWeight = 900;
        layer.style.fill = "#ffffff";
        layer.style.strokeOn = true;
        layer.style.strokeColor = "#000000";
        layer.style.strokeWidth = 16;
        layer.style.shadowOn = true;
        layer.style.shadowBlur = 18;
        layer.style.shadowDx = 6;
        layer.style.shadowDy = 6;
        layer.style.boxOn = true;
        layer.style.boxColor = "#ff2d2d";
        layer.style.boxOpacity = 0.72;
        layer.style.boxRadius = 22;
        layer.style.boxPad = 14;
        layer.style.uppercase = true;
        layer.style.align = "center";
        layer.style.autoFit = true;
        layer.style.lineHeight = 1.0;
      }
    },
  ];
}

function generateHooksFromTitle(title){
  const k = extractKeywords(title);
  const styles = modernStylePresets();

  // “Modern hook” templates (short + punchy).
  const templates = [
    `STOP ${k.k1}`,
    `${k.k1} CHANGES EVERYTHING`,
    `DO THIS FOR ${k.k1}`,
    `I WAS WRONG ABOUT ${k.k1}`,
    `${k.k1} IN 5 MINUTES`,
    `THE ${k.k1} TRICK NOBODY TELLS YOU`,
    `3 ${k.k1} MISTAKES`,
    `DON’T BUY ${k.k1} BEFORE THIS`,
    `${k.k1}: WHAT NO ONE SAYS`,
    `THE FASTEST WAY TO ${k.k1}`,
    `THIS FIXED MY ${k.k1}`,
    `${k.k1} VS ${k.k2}`,
    `THE REAL COST OF ${k.k1}`,
    `MAKE ${k.k1} LOOK EASY`,
  ];

  // Pick 10 (deterministic-ish but varied)
  const picks = [];
  for (let i=0;i<templates.length;i++){
    if (picks.length >= 10) break;
    const t = templates[i];
    // avoid near-duplicates if k1 is small
    if (picks.some(p => p.text === t)) continue;
    picks.push({
      text: t,
      styleIndex: i % styles.length,
      styleLabel: styles[i % styles.length].label,
      subtitle: `Uses keyword: ${k.k1}${k.k2 ? ` • alt: ${k.k2}` : ""}`
    });
  }
  return picks;
}

function renderHooksList(items){
  const host = $("hooksList");
  host.innerHTML = "";
  if (!items || items.length === 0) return;

  items.forEach((it, idx) => {
    const div = document.createElement("div");
    div.className = "hook-item";

    const top = document.createElement("div");
    top.className = "hook-top";

    const txt = document.createElement("div");
    txt.className = "hook-text";
    txt.textContent = it.text;

    const sty = document.createElement("div");
    sty.className = "hook-style";
    sty.textContent = it.styleLabel;

    top.appendChild(txt);
    top.appendChild(sty);

    const sub = document.createElement("div");
    sub.className = "hook-sub";
    sub.textContent = it.subtitle;

    div.appendChild(top);
    div.appendChild(sub);

    div.addEventListener("click", () => applyHookPreset(it));
    host.appendChild(div);
  });
}

function applyHookPreset(hook){
  const styles = modernStylePresets();

  // choose target text layer:
  let layer = selectedLayer();
  if (!layer || layer.type !== "text"){
    // try find a "Hook" text layer
    layer = state.layers.find(l => l.type === "text" && (l.name || "").toLowerCase().includes("hook")) || null;
  }
  if (!layer){
    // create new hook layer
    layer = makeTextLayer({ name: "Hook", text: hook.text, box: { x: 0.07, y: 0.12, w: 0.70, h: 0.34 } });
    state.layers.push(layer);
  }

  layer.text = hook.text;
  layer.style.uppercase = true;
  layer.style.autoFit = true;

  // apply style preset
  const preset = styles[hook.styleIndex] || styles[0];
  preset.apply(layer);

  // smart default placement per format
  if (state.formatKey === "pinterest_2_3"){
    layer.box = { x: 0.08, y: 0.08, w: 0.84, h: 0.22 };
    layer.style.align = "center";
    layer.style.lineHeight = 1.0;
  } else if (state.formatKey === "story_9_16"){
    layer.box = { x: 0.08, y: 0.12, w: 0.84, h: 0.24 };
  } else {
    layer.box = { x: 0.06, y: 0.14, w: 0.62, h: 0.38 };
    layer.style.align = "left";
  }

  state.selectedLayerId = layer.id;
  refreshLayersUI();
  refreshPropsUI();
  render();
  setStatus("Hook applied");
}

$("btnGenerateHooks").addEventListener("click", () => {
  const title = $("smartTitle").value || "";
  if (!title.trim()){
    setStatus("Enter a title to generate hooks");
    return;
  }
  const hooks = generateHooksFromTitle(title);
  renderHooksList(hooks);
  setStatus("Generated 10 hook ideas");
});

$("btnClearHooks").addEventListener("click", () => {
  $("hooksList").innerHTML = "";
  setStatus("Cleared hooks");
});

// ---------- Init ----------
function init(){
  state.dpiScale = 1;
  $("formatSelect").value = state.formatKey;
  $("bgFitSelect").value = state.bgFit;
  $("bgDim").value = state.bgDim;
  $("bgDimVal").textContent = state.bgDim.toFixed(2);
  $("jpgQualityVal").textContent = Number($("jpgQuality").value).toFixed(2);

  bindTextProps();
  bindImageProps();
  applyCanvasFormat();
  resetProject();
}

init();
