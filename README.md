# GlowFit — skin-smart shopping (YouCam API Skin AI & eCommerce VTO Hackathon)

One flow for beauty **and** fashion shopping:

1. **Scan** — selfie → YouCam **AI Skin Analysis** (8 concerns: wrinkle, acne, pore, texture, redness, oiliness, moisture, radiance).
2. **Report** — overall score, per-concern scores, tap a concern to overlay the detection mask; progress trend saved on-device.
3. **Routine & shop** — builds a budget-aware routine from the weakest concerns, picks best value per concern, and runs an **ingredient-clash checker** (e.g. retinol + exfoliating acids). Add to bag.
4. **Try-on** — YouCam **AI Clothes Virtual Try-On** (`cloth-v4`) with a catalog garment or your own garment photo, then add the item to the same bag.

Also: every step has its own URL and the back button works; your last scan, budget and bag survive a reload; photos below 480px are rejected with an inline message before any API call; the bag is a keyboard-accessible dialog with a demo checkout.

## Run
```bash
cp .env.example .env     # add YOUCAM_API_KEY (optional)
node server.js           # Node 18+, no npm install needed
# http://localhost:3000
```
Without a key the app runs in **demo mode** (placeholder scores, no try-on image) so the whole UI is explorable.

## Architecture
- `server.js` — zero-dependency Node server. Keeps the API key server-side and implements the YouCam flow: `POST /s2s/v2.0/file` → `PUT` to pre-signed URL → `POST /s2s/v2.0/task/{skin-analysis|cloth-v4}` → poll `GET .../{task_id}`. Maps API error codes (face too small, lighting, multi-person…) to friendly messages.
- `public/` — vanilla JS front end (`app.js`), product/garment data and clash rules (`catalog.js`).

## Known gaps / verify before submitting
- Catalog prices/brands are fictional; garment thumbnails are flat SVGs (real garment photos give better try-on results).
- Not yet tested against the live API (no key was available when this was built).
