const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const money = (n) => "$" + n.toFixed(0);
const VIEWS = ["scan", "report", "shop", "tryon"];
const NEEDS_SCAN = ["report", "shop"];
const MIN_SELFIE = 480; // YouCam SD skin analysis: short side >= 480px
const state = { selfie: null, scores: null, mode: "demo", bag: [], budget: 120, person: null, garment: null, garmentItem: null, tryUrl: null, routine: null };
const MIN_PERSON = [512, 384]; // cloth-v4: long side >= 512, short side >= 384

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
state.bag = store.get("gf_bag", []);
state.budget = store.get("gf_budget", 120);

// ---------- helpers ----------
function toast(msg, err) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), err ? 6500 : 4200);
}
function busy(msg) {
  $("#busyMsg").textContent = msg || ""; $("#busy").hidden = !msg;
  document.body.setAttribute("aria-busy", msg ? "true" : "false");
}
function fieldError(id, msg) { const el = $(id); el.textContent = msg || ""; el.hidden = !msg; }

// ---------- routing: every view has a URL, back/forward work ----------
function canOpen(view) { return VIEWS.includes(view) && (!NEEDS_SCAN.includes(view) || !!state.scores); }
function show(view, push = true) {
  if (!canOpen(view)) { if (NEEDS_SCAN.includes(view)) toast("Scan your skin first to unlock that step."); view = "scan"; }
  if (view === "shop") renderRoutine();
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === view));
  $$(".tab").forEach((t) => { const on = t.dataset.view === view; t.classList.toggle("on", on); on ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"); });
  if (push && location.hash.slice(1) !== view) history.pushState({ view }, "", "#" + view);
  document.title = { scan: "GlowFit — Skin scan, routine and try-on", report: "Your skin report · GlowFit", shop: "Your routine · GlowFit", tryon: "Virtual try-on · GlowFit" }[view];
  window.scrollTo({ top: 0 });
  const h = $(`#${view} h1, #${view} h2`); if (h && push) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}
window.addEventListener("popstate", () => show(location.hash.slice(1) || "scan", false));
$$(".tab").forEach((t) => (t.onclick = () => show(t.dataset.view)));
function unlockTabs() { $$(".tab").forEach((t) => { t.disabled = false; t.removeAttribute("title"); }); }

// ---------- images ----------
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("We couldn't read that image. Try a JPG or PNG.")); i.src = src; }); }
// Downscale to <=1600px JPEG: keeps payloads small and inside the API's size limits.
async function fileToDataUrl(file, max = 1600) {
  if (!/^image\/(jpeg|png)$/.test(file.type)) throw new Error("Please choose a JPG or PNG image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { url: c.toDataURL("image/jpeg", 0.9), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
async function sampleFile(url) {
  const r = await fetch(url); if (!r.ok) throw new Error("Couldn't load the sample photo.");
  const b = await r.blob(); return new File([b], url.split("/").pop(), { type: b.type });
}
async function api(path, body) {
  let r;
  try { r = await fetch(path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }); }
  catch { throw new Error("Can't reach the GlowFit server. Is it running?"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

// ---------- status ----------
api("/api/status").then((s) => {
  state.mode = s.mode;
  if (s.mode === "demo") { const b = $("#modeBanner"); b.hidden = false; b.textContent = "Demo mode: add YOUCAM_API_KEY to .env for real skin analysis and virtual try-on. Scores are placeholders until then."; }
}).catch(() => toast("Can't reach the GlowFit server. Is it running?", true));

// ---------- drop zones (mouse, keyboard, drag) ----------
function setupDrop(dropEl, input, cb) {
  dropEl.onclick = () => input.click();
  dropEl.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
  dropEl.ondragover = (e) => { e.preventDefault(); dropEl.classList.add("over"); };
  dropEl.ondragleave = () => dropEl.classList.remove("over");
  dropEl.ondrop = (e) => { e.preventDefault(); dropEl.classList.remove("over"); if (e.dataTransfer.files[0]) cb(e.dataTransfer.files[0]); };
  input.onchange = () => { if (input.files[0]) cb(input.files[0]); input.value = ""; };
}

// ---------- scan ----------
function setSelfieUrl(url) {
  state.selfie = url; $("#preview").src = url; $("#preview").hidden = false; $("#dropIdle").hidden = true;
  $("#analyze").disabled = false; fieldError("#scanErr", "");
}
async function useSelfie(file) {
  try {
    const img = await fileToDataUrl(file);
    if (Math.min(img.w, img.h) < MIN_SELFIE) throw new Error(`That photo is ${img.w}×${img.h}px. Skin analysis needs at least ${MIN_SELFIE}px on the short side.`);
    setSelfieUrl(img.url);
  } catch (e) { fieldError("#scanErr", e.message); }
}
setupDrop($("#drop"), $("#file"), useSelfie);
$("#sampleFace").onclick = async () => { stopCamera(); try { await useSelfie(await sampleFile("samples/sample-face.jpg")); } catch (e) { fieldError("#scanErr", e.message); } };
let stream = null;
function stopCamera() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; $("#video").hidden = true; $("#camBtn").textContent = "Use camera"; }
$("#camBtn").onclick = async () => {
  const v = $("#video");
  if (stream) {
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0); stopCamera();
    if (Math.min(c.width, c.height) < MIN_SELFIE) { fieldError("#scanErr", "Your camera resolution is too low for skin analysis. Upload a photo instead."); return; }
    setSelfieUrl(c.toDataURL("image/jpeg", 0.92)); return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } });
    v.srcObject = stream; v.hidden = false; $("#camBtn").textContent = "Take photo";
  } catch { fieldError("#scanErr", "Camera unavailable or blocked. Upload a photo instead."); }
};
$("#analyze").onclick = async () => {
  busy("Analyzing your skin. This takes about 10 to 30 seconds.");
  try {
    const r = await api("/api/skin", { image: state.selfie });
    state.scores = r.scores; state.mode = r.mode;
    saveScan(); renderReport(); unlockTabs(); show("report");
  } catch (e) { fieldError("#scanErr", e.message); } finally { busy(""); }
};

// ---------- report ----------
const overallOf = (sc) => Math.round(Object.values(sc).reduce((a, v) => a + v.score, 0) / Object.keys(sc).length);
function renderReport() {
  const sc = state.scores, ov = overallOf(sc);
  $("#reportImg").src = state.selfie || "";
  $("#maskImg").hidden = true;
  $("#overall").textContent = ov;
  const sorted = Object.entries(sc).sort((a, b) => a[1].score - b[1].score);
  $("#headline").textContent = ov >= 75 ? "Your skin is in great shape" : ov >= 55 ? "A solid base with a few things to tune" : "Let's give your skin some focused care";
  $("#subline").textContent = `Strongest: ${CONCERN_META[sorted.at(-1)[0]].label}. Focus on: ${CONCERN_META[sorted[0][0]].label}.`;
  // "Focus" marks exactly the concerns the routine targets: the three lowest under 72
  const focus = new Set(sorted.filter(([, v]) => v.score < 72).slice(0, 3).map(([k]) => k));
  $("#bars").innerHTML = sorted.map(([k, v]) => `<button class="bar" data-k="${k}" aria-pressed="false"><span class="t"><span>${CONCERN_META[k].label}${focus.has(k) ? '<em class="focus">Focus</em>' : ""}</span><i>${v.score}<span class="sr"> out of 100</span></i></span><span class="track" aria-hidden="true"><span style="width:${v.score}%;background:${focus.has(k) ? "var(--accent)" : "#8f8f8f"}"></span></span><small>${CONCERN_META[k].tip}</small></button>`).join("");
  $("#maskNote").textContent = state.mode === "live" ? "Select a concern to see where it was detected." : "Detection overlays appear with a live API key.";
  $$(".bar").forEach((b) => (b.onclick = () => {
    const was = b.getAttribute("aria-pressed") === "true";
    $$(".bar").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
    const img = $("#maskImg"), m = sc[b.dataset.k].masks[0];
    if (was) { img.hidden = true; return; }
    b.classList.add("on"); b.setAttribute("aria-pressed", "true");
    if (m) { img.src = m; img.hidden = false; } else img.hidden = true;
  }));
  renderHistory();
}
function saveScan() {
  const h = store.get("gf_hist", []); h.push({ t: Date.now(), o: overallOf(state.scores) }); store.set("gf_hist", h.slice(-12));
  // keep the last scan so a reload or a shared #report link still works; the photo is optional if storage is full
  if (!store.set("gf_last", { scores: state.scores, mode: state.mode, selfie: state.selfie })) store.set("gf_last", { scores: state.scores, mode: state.mode });
}
function renderHistory() {
  const h = store.get("gf_hist", []);
  if (h.length < 2) { $("#history").innerHTML = `<p class="note">Scan again in a few weeks to see your trend. Saved on this device only.</p>`; return; }
  const w = 300, ht = 70, pts = h.map((p, i) => [(i / (h.length - 1)) * (w - 20) + 10, ht - 8 - ((p.o - 30) / 70) * (ht - 16)]);
  const d = h.at(-1).o - h[0].o;
  $("#history").innerHTML = `<svg viewBox="0 0 ${w} ${ht}" role="img" aria-label="Overall score over ${h.length} scans, from ${h[0].o} to ${h.at(-1).o}"><polyline fill="none" stroke="#dafa9c" stroke-width="2.5" points="${pts.map((p) => p.join(",")).join(" ")}"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#dafa9c"><title>${new Date(h[i].t).toLocaleDateString()}: ${h[i].o}</title></circle>`).join("")}</svg><p class="note">${h.length} scans. Latest ${h.at(-1).o}, ${d >= 0 ? "+" : ""}${d} since your first.</p>`;
}
$("#toShop").onclick = () => show("shop");
$("#rescan").onclick = () => { state.selfie = null; $("#preview").hidden = true; $("#dropIdle").hidden = false; $("#analyze").disabled = true; show("scan"); $("#drop").focus(); };

// ---------- routine builder ----------
function findClashes(items) {
  const out = [], has = (p, a) => a.some((x) => p.actives.includes(x));
  for (const [A, B, msg] of CLASHES) {
    const pa = items.filter((p) => has(p, A)), pb = items.filter((p) => has(p, B));
    // a clash only matters if the two products can land in the same AM/PM slot
    for (const a of pa) for (const b of pb) if (a !== b && (a.slot === "both" || b.slot === "both" || a.slot === b.slot)) out.push({ a, b, msg });
  }
  return out;
}
function buildRoutine(sc, budget) {
  const needs = Object.entries(sc).filter(([, v]) => v.score < 72).sort((a, b) => a[1].score - b[1].score).slice(0, 3).map(([k, v]) => ({ k, w: 100 - v.score }));
  const chosen = PRODUCTS.filter((p) => p.essential);
  let spent = chosen.reduce((s, p) => s + p.price, 0);
  const covered = new Set(chosen.flatMap((p) => p.concerns));
  const pool = PRODUCTS.filter((p) => !p.essential);
  for (;;) {
    let best = null, bestV = 0;
    for (const p of pool) {
      if (chosen.includes(p) || spent + p.price > budget) continue;
      const gain = needs.reduce((s, n) => s + (p.concerns.includes(n.k) ? n.w * (covered.has(n.k) ? 0.35 : 1) : 0), 0);
      const clashPenalty = findClashes([...chosen, p]).length > findClashes(chosen).length ? 0.4 : 1;
      const v = (gain * clashPenalty) / Math.sqrt(p.price);
      if (v > bestV) { bestV = v; best = p; }
    }
    if (!best || bestV < 4 || chosen.length >= 6) break;
    chosen.push(best); spent += best.price; best.concerns.forEach((c) => covered.add(c));
  }
  return { needs, items: chosen, total: spent, uncovered: needs.filter((n) => !covered.has(n.k)), overBudget: spent > budget };
}
const inBag = (id) => state.bag.some((b) => b.id === id);
function renderRoutine() {
  if (!state.scores) return;
  const r = buildRoutine(state.scores, state.budget); state.routine = r;
  $("#budget").value = state.budget; $("#budgetVal").textContent = money(state.budget);
  $("#routineIntro").textContent = r.needs.length ? `Targeting your lowest scores: ${r.needs.map((n) => CONCERN_META[n.k].label.toLowerCase()).join(", ")}.` : "Your scores are strong, so a simple maintenance routine is all you need.";
  const order = { Cleanse: 0, Treat: 1, Moisturize: 2, Protect: 3 };
  const slotName = { am: "Morning", pm: "Evening", both: "Morning and evening" };
  $("#routine").innerHTML = [...r.items].sort((a, b) => order[a.step] - order[b.step]).map((p) => `
    <div class="prod"><span class="step">${p.step}</span>
      <div><b>${p.name}</b> <span class="muted">${p.brand}</span><div class="tags">${p.concerns.map((c) => `<span class="tag">${CONCERN_META[c].label}</span>`).join("")}<span class="slot">${slotName[p.slot]}</span></div></div>
      <div class="pr"><b>${money(p.price)}</b><button class="alt sm" data-add="${p.id}" ${inBag(p.id) ? "disabled" : ""}>${inBag(p.id) ? "In bag" : "Add"}</button></div></div>`).join("");
  const clashes = findClashes(r.items);
  $("#warnings").innerHTML = clashes.map((c) => `<div class="warn" role="note"><b>${c.a.name}</b> and <b>${c.b.name}</b>: ${c.msg}</div>`).join("")
    + (r.overBudget ? `<div class="warn" role="note">Cleanser and SPF alone cost ${money(r.total)}, over your ${money(state.budget)} budget. They stay in: every routine needs them.</div>` : "")
    + (r.uncovered.length ? `<div class="warn" role="note">Your budget doesn't stretch to ${r.uncovered.map((n) => CONCERN_META[n.k].label.toLowerCase()).join(", ")}. Raise it to include ${r.uncovered.length > 1 ? "them" : "it"}.</div>` : "")
    + (!clashes.length ? `<div class="warn okmsg" role="note">No ingredient clashes in this routine.</div>` : "");
  $("#routineTotal").innerHTML = `${money(r.total)}<small>of ${money(state.budget)} budget, ${r.items.length} products</small>`;
  const allIn = r.items.every((p) => inBag(p.id));
  $("#addAll").disabled = allIn; $("#addAll").textContent = allIn ? "Routine is in your bag" : "Add routine to bag";
  $$("[data-add]").forEach((b) => (b.onclick = () => { addToBag(PRODUCTS.find((p) => p.id === b.dataset.add)); renderRoutine(); }));
}
let budgetT;
$("#budget").oninput = (e) => { state.budget = +e.target.value; $("#budgetVal").textContent = money(state.budget); clearTimeout(budgetT); budgetT = setTimeout(() => { store.set("gf_budget", state.budget); renderRoutine(); }, 60); };
$("#addAll").onclick = () => { const n = state.routine.items.filter((p) => !inBag(p.id)); n.forEach((p) => addToBag(p, true)); toast(`Added ${n.length} product${n.length === 1 ? "" : "s"} to your bag.`); renderRoutine(); };

// ---------- bag (dialog with focus handling) ----------
function addToBag(p, quiet) { if (!inBag(p.id)) state.bag.push({ id: p.id, name: p.name, price: p.price, kind: p.kind || "skincare" }); persistBag(); if (!quiet) toast(`${p.name} added to your bag.`); }
function persistBag() { store.set("gf_bag", state.bag); renderBag(); }
function renderBag() {
  const n = state.bag.length, total = state.bag.reduce((s, b) => s + b.price, 0);
  $("#cartCount").textContent = n; $("#cartBtn").setAttribute("aria-label", `Bag, ${n} item${n === 1 ? "" : "s"}`);
  $("#bagItems").innerHTML = n ? state.bag.map((b, i) => `<div class="bagRow"><span>${b.name}<small>${b.kind === "garment" ? "Clothing" : "Skincare"}</small></span><span>${money(b.price)}<button data-rm="${i}" aria-label="Remove ${b.name}">Remove</button></span></div>`).join("") : `<p class="muted">Your bag is empty. Scan your skin or try on a look to fill it.</p>`;
  $("#bagTotal").innerHTML = `${money(total)}<small>${n} item${n === 1 ? "" : "s"}</small>`;
  $("#checkout").disabled = !n;
  $$("[data-rm]").forEach((b) => (b.onclick = () => { state.bag.splice(+b.dataset.rm, 1); persistBag(); if ($("#shop").classList.contains("on")) renderRoutine(); $("#bagClose").focus(); }));
}
let lastFocus = null;
function openBag() { lastFocus = document.activeElement; $("#bag").hidden = false; $("#scrim").hidden = false; $("#bagClose").focus(); }
function closeBag() { $("#bag").hidden = true; $("#scrim").hidden = true; $("#orderDone").hidden = true; if (lastFocus) lastFocus.focus(); }
$("#cartBtn").onclick = () => ($("#bag").hidden ? openBag() : closeBag());
$("#bagClose").onclick = closeBag; $("#scrim").onclick = closeBag;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#bag").hidden) closeBag();
  if (e.key === "Tab" && !$("#bag").hidden) { // keep focus inside the open bag
    const f = [...$("#bag").querySelectorAll("button:not([disabled]),a[href]")]; if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});
$("#checkout").onclick = () => {
  const total = state.bag.reduce((s, b) => s + b.price, 0), id = "GF-" + Date.now().toString(36).toUpperCase().slice(-6);
  $("#orderDone").innerHTML = `<b>Order ${id} placed (demo).</b> ${state.bag.length} items, ${money(total)}. No payment was taken.`;
  $("#orderDone").hidden = false; state.bag = []; persistBag(); if ($("#shop").classList.contains("on")) renderRoutine();
};
renderBag();

// ---------- try-on ----------
$("#garments").innerHTML = GARMENTS.map((g) => `<button class="garment" data-g="${g.id}" aria-pressed="false"><img src="${g.img}" alt=""><span>${g.name}<br><b>${money(g.price)}</b></span></button>`).join("");
$$(".garment").forEach((el) => (el.onclick = () => {
  $$(".garment").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); }); el.classList.add("on"); el.setAttribute("aria-pressed", "true");
  const g = GARMENTS.find((x) => x.id === el.dataset.g);
  state.garment = null; state.garmentItem = g; $("#category").value = g.category;
  $("#garmentIdle").textContent = "Or upload your own garment photo"; refreshTry();
}));
async function usePerson(f) {
  try {
    const img = await fileToDataUrl(f);
    if (Math.max(img.w, img.h) < MIN_PERSON[0] || Math.min(img.w, img.h) < MIN_PERSON[1]) throw new Error(`That photo is ${img.w}×${img.h}px. Try-on needs at least ${MIN_PERSON[0]}×${MIN_PERSON[1]}px.`);
    state.person = img.url; $("#personPrev").src = img.url; $("#personPrev").hidden = false; $("#personIdle").hidden = true; fieldError("#tryErr", ""); refreshTry();
  } catch (e) { fieldError("#tryErr", e.message); }
}
setupDrop($("#personDrop"), $("#personFile"), usePerson);
$("#sampleModel").onclick = async () => { try { await usePerson(await sampleFile("samples/sample-model.jpg")); } catch (e) { fieldError("#tryErr", e.message); } };
setupDrop($("#garmentDrop"), $("#garmentFile"), async (f) => {
  try { const img = await fileToDataUrl(f); state.garment = img.url; state.garmentItem = null; $$(".garment").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); }); $("#garmentIdle").textContent = "Your garment photo is loaded. Click to change it."; fieldError("#tryErr", ""); refreshTry(); }
  catch (e) { fieldError("#tryErr", e.message); }
});
const hasGarment = () => !!(state.garment || state.garmentItem);
function refreshTry() {
  const ok = state.person && hasGarment(); $("#tryBtn").disabled = !ok;
  $("#tryHint").textContent = ok ? "" : !state.person && !hasGarment() ? "Add your photo and pick a garment." : !state.person ? "Add a full-body photo of yourself." : "Pick or upload a garment.";
}
$("#tryBtn").onclick = async () => {
  busy("Dressing you up. This can take up to a minute.");
  try {
    const g = state.garmentItem;
    const r = await api("/api/tryon", { person: state.person, garment: state.garment, garmentUrl: state.garment ? null : g.ref, category: $("#category").value });
    if (r.url) {
      state.tryUrl = r.url; $("#tryResult").innerHTML = `<img src="${r.url}" alt="You wearing the selected garment">`; $("#tryDl").href = r.url; $("#tryDl").hidden = false;
    } else {
      $("#tryResult").innerHTML = `<div class="compare"><img src="${state.person}" alt="Your photo"><img src="${state.garment || g.img}" alt="Selected garment"></div><p class="note" style="padding:12px">${r.note}</p>`; $("#tryDl").hidden = true;
    }
    $("#tryAdd").hidden = !state.garmentItem;
    if (state.garmentItem) { const inb = inBag(state.garmentItem.id); $("#tryAdd").disabled = inb; $("#tryAdd").textContent = inb ? "In bag" : `Add ${state.garmentItem.name} to bag`; }
    $("#tryActions").hidden = !(state.garmentItem || r.url);
  } catch (e) { fieldError("#tryErr", e.message); } finally { busy(""); }
};
$("#tryAdd").onclick = () => { const g = state.garmentItem; if (g) { addToBag({ ...g, kind: "garment" }); $("#tryAdd").disabled = true; $("#tryAdd").textContent = "In bag"; } };
refreshTry();

// ---------- home: brand, footer links, feature finder ----------
$("#home").onclick = (e) => { e.preventDefault(); show("scan"); };
$$("[data-go]").forEach((el) => (el.onclick = (e) => { e.preventDefault(); show(el.dataset.go); }));
const CMDS = [
  { n: "Scan your skin", k: "S", d: "One selfie, eight concerns scored from 1 to 100 by YouCam's skin analysis.", go: "scan" },
  { n: "Read the report", k: "R", d: "Select any concern to see where it was detected on your face.", go: "report" },
  { n: "Build my routine", k: "B", d: "Targets your three weakest concerns with the best value per concern.", go: "shop" },
  { n: "Check ingredient clashes", k: "C", d: "Flags pairs like retinol and exfoliating acids before they reach your bag.", go: "shop" },
  { n: "Set a budget", k: "$", d: "Drag the budget and the routine rebuilds within it.", go: "shop" },
  { n: "Try on a garment", k: "T", d: "Upload a full-body photo and a garment and see it on you.", go: "tryon" },
  { n: "Fill one bag", k: "G", d: "Skincare and clothes land in the same bag.", go: "bag" },
];
let cmdSel = 0, cmdShown = CMDS;
function runCmd(c) { if (c.go === "bag") openBag(); else if (c.go === "scan") $("#drop").focus(); else show(c.go); }
function renderCmd() {
  const q = $("#cmdq").value.trim().toLowerCase();
  cmdShown = CMDS.filter((c) => c.n.toLowerCase().includes(q) || c.d.toLowerCase().includes(q));
  cmdSel = Math.min(cmdSel, Math.max(cmdShown.length - 1, 0));
  $("#cmdlist").innerHTML = cmdShown.length ? cmdShown.map((c, i) => `<li role="option" id="cmd-${i}" aria-selected="${i === cmdSel}" data-i="${i}"><span class="row"><span class="nm">${c.n}</span><small>${c.d}</small></span><span class="keys" aria-hidden="true"><i>${c.k}</i></span></li>`).join("") : `<li class="none" role="option" aria-disabled="true">No feature matches "${q.replace(/[<>&"]/g, "")}".</li>`;
  $("#cmdq").setAttribute("aria-activedescendant", cmdShown.length ? `cmd-${cmdSel}` : "");
  $$("#cmdlist li[data-i]").forEach((li) => { li.onmouseenter = () => { cmdSel = +li.dataset.i; markCmd(); }; li.onclick = () => { cmdSel = +li.dataset.i; markCmd(); runCmd(cmdShown[cmdSel]); }; });
}
function markCmd() { $$("#cmdlist li[data-i]").forEach((li) => li.setAttribute("aria-selected", +li.dataset.i === cmdSel)); $("#cmdq").setAttribute("aria-activedescendant", `cmd-${cmdSel}`); }
$("#cmdq").oninput = () => { cmdSel = 0; renderCmd(); };
$("#cmdq").onkeydown = (e) => {
  if (e.key === "ArrowDown") { cmdSel = Math.min(cmdSel + 1, cmdShown.length - 1); markCmd(); e.preventDefault(); }
  if (e.key === "ArrowUp") { cmdSel = Math.max(cmdSel - 1, 0); markCmd(); e.preventDefault(); }
  if (e.key === "Enter" && cmdShown[cmdSel]) { e.preventDefault(); runCmd(cmdShown[cmdSel]); }
};
renderCmd();

// ---------- restore last scan, then route from the URL ----------
const last = store.get("gf_last", null);
if (last && last.scores) {
  state.scores = last.scores; state.mode = last.mode || "demo"; state.selfie = last.selfie || null;
  renderReport(); unlockTabs();
}
show(location.hash.slice(1) || "scan", false);
history.replaceState({ view: location.hash.slice(1) || "scan" }, "", location.hash || "#scan");

// Entrances: shown once as each part enters; content is visible without script.
const io = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
  ? new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 }) : null;
if (io) $$(".hero-text h1,.lede,.stage,.cmdbox input,.steps h2,.step,.tile").forEach((el, i) => { el.classList.add("rv"); el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
