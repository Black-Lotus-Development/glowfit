const $ = (s) => document.querySelector(s);
const money = (n) => "$" + n.toFixed(0);
const state = { selfie: null, scores: null, mode: "demo", bag: [], budget: 120, person: null, garment: null, garmentThumb: null, tryUrl: null };
try { state.bag = JSON.parse(localStorage.getItem("gf_bag") || "[]"); } catch {}

// ---------- helpers ----------
function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4200); }
function busy(msg) { $("#busyMsg").textContent = msg || ""; $("#busy").hidden = !msg; }
function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === view));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.view === view));
  window.scrollTo({ top: 0 });
}
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => !t.disabled && show(t.dataset.view)));

// Downscale to <=1600px JPEG: keeps payloads small and inside the API's size limits.
function fileToDataUrl(file, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => rej(new Error("Couldn't read that image."));
    img.src = url;
  });
}
function svgToPng(svgUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = 800; c.height = 760; const x = c.getContext("2d"); x.fillStyle = "#f4efe9"; x.fillRect(0, 0, 800, 760); x.drawImage(img, 0, 0, 800, 760); res(c.toDataURL("image/jpeg", 0.92)); };
    img.onerror = rej; img.src = svgUrl;
  });
}
async function api(path, body) {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

// ---------- status ----------
api("/api/status").then((s) => {
  state.mode = s.mode;
  if (s.mode === "demo") { const b = $("#modeBanner"); b.hidden = false; b.textContent = "Demo mode — add YOUCAM_API_KEY to .env for real skin analysis and virtual try-on. Scores below are placeholders."; }
});

// ---------- scan ----------
function setupDrop(dropEl, input, cb) {
  dropEl.onclick = () => input.click();
  dropEl.ondragover = (e) => { e.preventDefault(); dropEl.classList.add("over"); };
  dropEl.ondragleave = () => dropEl.classList.remove("over");
  dropEl.ondrop = (e) => { e.preventDefault(); dropEl.classList.remove("over"); if (e.dataTransfer.files[0]) cb(e.dataTransfer.files[0]); };
  input.onchange = () => input.files[0] && cb(input.files[0]);
}
async function setSelfie(file) {
  try {
    state.selfie = await fileToDataUrl(file);
    $("#preview").src = state.selfie; $("#preview").hidden = false; $("#dropIdle").hidden = true; $("#analyze").disabled = false;
  } catch (e) { toast(e.message, true); }
}
setupDrop($("#drop"), $("#file"), setSelfie);
$("#camBtn").onclick = async () => {
  const v = $("#video");
  if (!v.hidden && v.srcObject) { // capture
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    state.selfie = c.toDataURL("image/jpeg", 0.92); v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null; v.hidden = true;
    $("#preview").src = state.selfie; $("#preview").hidden = false; $("#dropIdle").hidden = true; $("#analyze").disabled = false; $("#camBtn").textContent = "Use camera"; return;
  }
  try { v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }); v.hidden = false; $("#camBtn").textContent = "Capture photo"; }
  catch { toast("Camera unavailable — upload a photo instead.", true); }
};

$("#analyze").onclick = async () => {
  busy("Analyzing your skin… this takes ~10–20 seconds");
  try {
    const r = await api("/api/skin", { image: state.selfie });
    state.scores = r.scores; state.mode = r.mode;
    saveHistory(); renderReport();
    document.querySelectorAll(".tab").forEach((t) => (t.disabled = false));
    show("report");
  } catch (e) { toast(e.message, true); } finally { busy(""); }
};

// ---------- report ----------
const colorFor = (s) => (s < 72 ? "#dafa9c" : "#8f8f8f");
const overallOf = (sc) => Math.round(Object.values(sc).reduce((a, v) => a + v.score, 0) / Object.keys(sc).length);
function renderReport() {
  const sc = state.scores, ov = overallOf(sc);
  $("#reportImg").src = state.selfie;
  $("#overall").textContent = ov; $(".big").style.setProperty("--p", ov);
  const sorted = Object.entries(sc).sort((a, b) => a[1].score - b[1].score);
  $("#headline").textContent = ov >= 75 ? "Your skin is in great shape" : ov >= 55 ? "A solid base with a few things to tune" : "Let's give your skin some focused care";
  $("#subline").textContent = `Strongest: ${CONCERN_META[sorted.at(-1)[0]].label} · Focus on: ${CONCERN_META[sorted[0][0]].label}`;
  $("#bars").innerHTML = sorted.map(([k, v]) => `<div class="bar" data-k="${k}"><div class="t"><span>${CONCERN_META[k].label}</span><i>${v.score}</i></div><div class="track"><div style="width:${v.score}%;background:${colorFor(v.score)}"></div></div><small>${CONCERN_META[k].tip}</small></div>`).join("");
  $("#maskNote").textContent = state.mode === "live" ? "Tap a concern to see where it was detected on your face." : "Region overlays appear with a live API key.";
  document.querySelectorAll(".bar").forEach((b) => (b.onclick = () => {
    document.querySelectorAll(".bar").forEach((x) => x.classList.remove("on")); b.classList.add("on");
    const m = sc[b.dataset.k].masks[0], img = $("#maskImg");
    if (m) { img.src = m; img.hidden = false; } else img.hidden = true;
  }));
  renderHistory();
}
function saveHistory() {
  try { const h = JSON.parse(localStorage.getItem("gf_hist") || "[]"); h.push({ t: Date.now(), o: overallOf(state.scores) }); localStorage.setItem("gf_hist", JSON.stringify(h.slice(-12))); } catch {}
}
function renderHistory() {
  let h = []; try { h = JSON.parse(localStorage.getItem("gf_hist") || "[]"); } catch {}
  if (h.length < 2) { $("#history").innerHTML = `<p class="fine">Scan again in a few weeks to see your trend. (Saved on this device only.)</p>`; return; }
  const w = 300, ht = 70, pts = h.map((p, i) => [(i / (h.length - 1)) * (w - 20) + 10, ht - 8 - ((p.o - 30) / 70) * (ht - 16)]);
  $("#history").innerHTML = `<svg viewBox="0 0 ${w} ${ht}"><polyline fill="none" stroke="#dafa9c" stroke-width="2.5" points="${pts.map((p) => p.join(",")).join(" ")}"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#dafa9c"><title>${h[i].o}</title></circle>`).join("")}</svg><p class="fine">${h.length} scans · latest ${h.at(-1).o} (${h.at(-1).o - h[0].o >= 0 ? "+" : ""}${h.at(-1).o - h[0].o} since first)</p>`;
}
$("#toShop").onclick = () => { renderRoutine(); show("shop"); };

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
  while (true) {
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
  return { needs, items: chosen, total: spent, uncovered: needs.filter((n) => !covered.has(n.k)) };
}
function renderRoutine() {
  const r = buildRoutine(state.scores, state.budget); state.routine = r;
  $("#routineIntro").textContent = r.needs.length ? `Targeting: ${r.needs.map((n) => CONCERN_META[n.k].label).join(", ")}.` : "Your scores are strong — a simple maintenance routine is all you need.";
  const order = { Cleanse: 0, Treat: 1, Moisturize: 2, Protect: 3 };
  $("#routine").innerHTML = [...r.items].sort((a, b) => order[a.step] - order[b.step]).map((p) => `
    <div class="prod"><span class="step">${p.step}</span>
      <div><b>${p.name}</b> <span class="muted">· ${p.brand}</span><div class="tags">${p.concerns.map((c) => `<span class="tag">${CONCERN_META[c].label}</span>`).join("")}<span class="slot">${{ am: "AM only", pm: "PM only", both: "AM + PM" }[p.slot]}</span></div></div>
      <div style="text-align:right"><b>${money(p.price)}</b><br><button class="btn ghost" style="padding:6px 14px;font-size:13px" data-add="${p.id}">Add</button></div></div>`).join("");
  const clashes = findClashes(r.items);
  $("#warnings").innerHTML = clashes.map((c) => `<div class="warn">⚠ <b>${c.a.name}</b> + <b>${c.b.name}</b>: ${c.msg}</div>`).join("")
    + (r.uncovered.length ? `<div class="warn">Budget too tight to cover: ${r.uncovered.map((n) => CONCERN_META[n.k].label).join(", ")}. Raise the budget to include them.</div>` : "")
    + (!clashes.length ? `<div class="warn okmsg">No ingredient clashes in this routine.</div>` : "");
  $("#routineTotal").innerHTML = `${money(r.total)}<small>of ${money(state.budget)} budget · ${r.items.length} products</small>`;
  document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addToBag(PRODUCTS.find((p) => p.id === b.dataset.add))));
}
$("#budget").oninput = (e) => { state.budget = +e.target.value; $("#budgetVal").textContent = money(state.budget); renderRoutine(); };
$("#addAll").onclick = () => { state.routine.items.forEach((p) => addToBag(p, true)); toast(`Added ${state.routine.items.length} products to your bag.`); };

// ---------- bag ----------
function addToBag(p, quiet) { if (!state.bag.find((x) => x.id === p.id)) state.bag.push({ id: p.id, name: p.name, price: p.price }); persistBag(); if (!quiet) toast(`${p.name} added to bag.`); }
function persistBag() { try { localStorage.setItem("gf_bag", JSON.stringify(state.bag)); } catch {} renderBag(); }
function renderBag() {
  $("#cartCount").textContent = state.bag.length;
  $("#bagItems").innerHTML = state.bag.length ? state.bag.map((b, i) => `<div class="bagRow"><span>${b.name}</span><span>${money(b.price)} <button data-rm="${i}">✕</button></span></div>`).join("") : `<p class="muted">Your bag is empty.</p>`;
  $("#bagTotal").innerHTML = `${money(state.bag.reduce((s, b) => s + b.price, 0))}<small>${state.bag.length} items</small>`;
  document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { state.bag.splice(+b.dataset.rm, 1); persistBag(); }));
}
$("#cartBtn").onclick = () => ($("#bag").hidden = !$("#bag").hidden);
$("#bagClose").onclick = () => ($("#bag").hidden = true);
$("#checkout").onclick = () => toast("Demo checkout — no payment is taken.");
renderBag();

// ---------- try-on ----------
$("#garments").innerHTML = GARMENTS.map((g) => `<div class="garment" data-g="${g.id}"><img src="${garmentSvgUrl(g)}" alt="${g.name}"><div>${g.name}<br><b>${money(g.price)}</b></div></div>`).join("");
document.querySelectorAll(".garment").forEach((el) => (el.onclick = async () => {
  document.querySelectorAll(".garment").forEach((x) => x.classList.remove("on")); el.classList.add("on");
  const g = GARMENTS.find((x) => x.id === el.dataset.g);
  state.garment = await svgToPng(garmentSvgUrl(g)); state.garmentItem = g; $("#category").value = g.category; refreshTry();
}));
setupDrop($("#personDrop"), $("#personFile"), async (f) => { state.person = await fileToDataUrl(f); $("#personPrev").src = state.person; $("#personPrev").hidden = false; $("#personIdle").hidden = true; refreshTry(); });
setupDrop($("#garmentDrop"), $("#garmentFile"), async (f) => { state.garment = await fileToDataUrl(f); state.garmentItem = null; document.querySelectorAll(".garment").forEach((x) => x.classList.remove("on")); $("#garmentDrop span").textContent = "Custom garment loaded ✓"; refreshTry(); });
function refreshTry() { $("#tryBtn").disabled = !(state.person && state.garment); }
$("#tryBtn").onclick = async () => {
  busy("Dressing you up… this can take up to a minute");
  try {
    const r = await api("/api/tryon", { person: state.person, garment: state.garment, category: $("#category").value });
    if (r.url) {
      state.tryUrl = r.url; $("#tryResult").innerHTML = `<img src="${r.url}" alt="Virtual try-on result">`; $("#tryDl").href = r.url; $("#tryDl").hidden = false;
    } else {
      $("#tryResult").innerHTML = `<div class="compare"><img src="${state.person}" alt="You"><img src="${state.garment}" alt="Garment"></div><p class="fine" style="padding:10px">${r.note}</p>`; $("#tryDl").hidden = true;
    }
    $("#tryActions").hidden = !state.garmentItem; if (!state.garmentItem) $("#tryActions").hidden = true;
  } catch (e) { toast(e.message, true); } finally { busy(""); }
};
$("#tryAdd").onclick = () => { const g = state.garmentItem; if (g) addToBag({ id: g.id, name: g.name, price: g.price }); };

// ---------- home: brand, footer links, command list, entrances ----------
$("#home").onclick = (e) => { e.preventDefault(); show("scan"); };
document.querySelectorAll("[data-go]").forEach((el) => (el.onclick = (e) => { e.preventDefault(); const v = el.dataset.go; const t = document.querySelector(`.tab[data-view="${v}"]`); if (t && !t.disabled) show(v); else { show("scan"); if (v !== "scan") toast("Scan your skin first to unlock that step."); } }));
const CMDS = [
  { n: "Scan your skin", k: "S", d: "One selfie, eight concerns scored from 1 to 100 by YouCam's skin analysis.", go: "scan" },
  { n: "Read the report", k: "R", d: "Tap any concern to see where it was detected on your face.", go: "report" },
  { n: "Build my routine", k: "B", d: "Targets your three weakest concerns with the best value per concern.", go: "shop" },
  { n: "Check ingredient clashes", k: "C", d: "Flags pairs like retinol and exfoliating acids before they reach your bag.", go: "shop" },
  { n: "Set a budget", k: "$", d: "Drag the budget and the routine rebuilds within it.", go: "shop" },
  { n: "Try on a garment", k: "T", d: "Upload a full-body photo and a garment and see it on you.", go: "tryon" },
  { n: "Fill one bag", k: "G", d: "Skincare and clothes land in the same bag.", go: "scan" },
];
let cmdSel = 0, cmdShown = CMDS;
function renderCmd() {
  const q = $("#cmdq").value.trim().toLowerCase();
  cmdShown = CMDS.filter((c) => c.n.toLowerCase().includes(q) || c.d.toLowerCase().includes(q));
  cmdSel = Math.min(cmdSel, Math.max(cmdShown.length - 1, 0));
  $("#cmdlist").innerHTML = cmdShown.length ? cmdShown.map((c, i) => `<li role="option" aria-selected="${i === cmdSel}" data-i="${i}"><span class="row"><span class="nm">${c.n}</span><small>${c.d}</small></span><span class="keys"><i>${c.k}</i></span></li>`).join("") : `<li class="none">No feature matches "${q}".</li>`;
  document.querySelectorAll("#cmdlist li[data-i]").forEach((li) => { li.onmouseenter = () => { cmdSel = +li.dataset.i; markCmd(); }; li.onclick = () => { cmdSel = +li.dataset.i; markCmd(); const t = document.querySelector(`.tab[data-view="${cmdShown[cmdSel].go}"]`); if (t && !t.disabled) show(cmdShown[cmdSel].go); }; });
}
function markCmd() { document.querySelectorAll("#cmdlist li[data-i]").forEach((li) => li.setAttribute("aria-selected", +li.dataset.i === cmdSel)); }
$("#cmdq").oninput = () => { cmdSel = 0; renderCmd(); };
$("#cmdq").onkeydown = (e) => { if (e.key === "ArrowDown") { cmdSel = Math.min(cmdSel + 1, cmdShown.length - 1); markCmd(); e.preventDefault(); } if (e.key === "ArrowUp") { cmdSel = Math.max(cmdSel - 1, 0); markCmd(); e.preventDefault(); } };
renderCmd();
// Entrances: heading, then text, then picture; shown only once, never hidden if script fails (class added by JS).
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 }) : null;
document.querySelectorAll(".hero-text h1,.lede,.stage,.cmdbox input,.cmdbox li,.steps h2,.step,.tile").forEach((el, i) => { if (!io) return; el.classList.add("rv"); el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
