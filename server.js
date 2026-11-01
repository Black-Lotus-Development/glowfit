// GlowFit server — zero dependencies (Node 18+). Run: node server.js  ->  http://localhost:3000
// Proxies YouCam API calls so the API key never reaches the browser.
// With no YOUCAM_API_KEY it runs in DEMO mode with deterministic stand-in results.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// minimal .env loader
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const KEY = process.env.YOUCAM_API_KEY || "";
const BASE = process.env.YOUCAM_BASE_URL || "https://yce-api-01.makeupar.com";
const PORT = +process.env.PORT || 3000;
const CONCERNS = ["wrinkle", "acne", "pore", "texture", "redness", "oiliness", "moisture", "radiance"];
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };

// ---------- YouCam client ----------
async function yc(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || `YouCam ${res.status}`, json.error_code, res.status);
  return json;
}
class ApiError extends Error {
  constructor(msg, code, status) { super(msg); this.code = code; this.status = status || 500; }
}

function parseDataUrl(u) {
  const m = /^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/.exec(u || "");
  if (!m) throw new ApiError("Please upload a JPG or PNG image.", "bad_image", 400);
  return { type: m[1], buf: Buffer.from(m[2], "base64") };
}

async function uploadImage(dataUrl, name) {
  const { type, buf } = parseDataUrl(dataUrl);
  if (buf.length > 10 * 1024 * 1024) throw new ApiError("Image must be under 10 MB.", "too_big", 400);
  const reg = await yc("POST", "/s2s/v2.0/file", { files: [{ content_type: type, file_name: name, file_size: buf.length }] });
  const f = reg.data.files[0];
  const put = f.requests[0];
  const up = await fetch(put.url, { method: put.method || "PUT", headers: put.headers, body: buf });
  if (!up.ok) throw new ApiError("Image upload to YouCam storage failed.", "upload_failed", 502);
  return f.file_id;
}

async function pollTask(route, id, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await yc("GET", `${route}/${encodeURIComponent(id)}`);
    const st = r.data && r.data.task_status;
    if (st === "success") return r.data;
    if (st === "error") throw new ApiError(friendly(r.data.error_code || r.data.error), r.data.error_code, 422);
    await new Promise((r) => setTimeout(r, 1800));
  }
  throw new ApiError("YouCam took too long. Please try again.", "timeout", 504);
}

const FRIENDLY = {
  error_src_face_too_small: "Move closer — your face should fill 60–80% of the frame.",
  error_src_face_out_of_bound: "Your face is partly out of frame. Centre it and retry.",
  error_lighting_dark: "That photo is too dark. Try soft, even daylight.",
  error_below_min_image_size: "Image resolution is too low (min 480px short side).",
  error_pose: "We couldn't read the pose — use a full-body, front-facing photo.",
  error_multi_person: "Only one person per photo, please.",
  error_nsfw_content_detected: "That image was rejected by the content filter.",
  error_invalid_ref: "We couldn't recognise a garment in the clothing image.",
};
const friendly = (c) => FRIENDLY[c] || (typeof c === "string" ? c : "Something went wrong.");

// ---------- Skin analysis ----------
async function skinAnalysis(image) {
  if (!KEY) return demoSkin(image);
  const fileId = await uploadImage(image, "scan.jpg");
  const task = await yc("POST", "/s2s/v2.0/task/skin-analysis", {
    src_file_id: fileId, dst_actions: CONCERNS, format: "json",
    miniserver_args: { enable_mask_overlay: false },
  });
  const data = await pollTask("/s2s/v2.0/task/skin-analysis", task.data.task_id);
  const out = data.results.output || [];
  const scores = {};
  for (const o of out) if (CONCERNS.includes(o.type)) scores[o.type] = { score: o.ui_score, raw: o.raw_score, masks: o.mask_urls || [] };
  return { mode: "live", scores };
}

// Demo: deterministic per-image pseudo-scores so the UI is fully explorable without a key.
function demoSkin(image) {
  const h = crypto.createHash("sha256").update(image.slice(-4000)).digest();
  const scores = {};
  CONCERNS.forEach((c, i) => { scores[c] = { score: 38 + Math.round((h[i] / 255) * 55), raw: null, masks: [] }; });
  return { mode: "demo", scores };
}

// ---------- Virtual try-on ----------
async function tryOn({ person, garment, garmentUrl, category }) {
  const cat = ["upper_body", "lower_body", "full_body", "shoes"].includes(category) ? category : "auto";
  if (!KEY) {
    await new Promise((r) => setTimeout(r, 1200));
    return { mode: "demo", url: null, note: "Demo mode: add a YOUCAM_API_KEY to generate real try-on images." };
  }
  const body = { garment_category: cat };
  body.src_file_id = await uploadImage(person, "person.jpg");
  if (garment) body.ref_file_id = await uploadImage(garment, "garment.jpg");
  else if (garmentUrl && /^https:\/\//.test(garmentUrl)) body.ref_file_url = garmentUrl;
  else throw new ApiError("Choose or upload a garment.", "no_garment", 400);
  const task = await yc("POST", "/s2s/v2.0/task/cloth-v4", body);
  const data = await pollTask("/s2s/v2.0/task/cloth-v4", task.data.task_id, 120000);
  return { mode: "live", url: data.results.url };
}

// ---------- HTTP ----------
function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new ApiError("Payload too large", "too_big", 413)); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(new ApiError("Bad JSON", "bad_json", 400)); } });
  });
}
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const routes = {
  "GET /api/status": async () => ({ mode: KEY ? "live" : "demo", concerns: CONCERNS }),
  "POST /api/skin": async (req) => skinAnalysis((await readBody(req)).image),
  "POST /api/tryon": async (req) => tryOn(await readBody(req)),
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const h = routes[`${req.method} ${url.pathname}`];
  if (h) {
    try { send(res, 200, await h(req)); }
    catch (e) { console.error(e.message); send(res, e.status || 500, { error: e.message, code: e.code }); }
    return;
  }
  let file = path.normalize(path.join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`GlowFit on http://localhost:${PORT}  [${KEY ? "LIVE YouCam API" : "DEMO mode (no YOUCAM_API_KEY)"}]`));
