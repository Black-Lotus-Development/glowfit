# GlowFit — skin-smart shopping (YouCam API Skin AI & eCommerce VTO Hackathon)

One flow for beauty **and** fashion shopping:

1. **Scan** — selfie → YouCam **AI Skin Analysis** (8 concerns: wrinkle, acne, pore, texture, redness, oiliness, moisture, radiance).
2. **Report** — overall score, per-concern scores, tap a concern to overlay the detection mask; progress trend saved on-device.
3. **Routine & shop** — builds a budget-aware routine from the weakest concerns, picks best value per concern, and runs an **ingredient-clash checker** (e.g. retinol + exfoliating acids). Add to bag.
4. **Try-on** — YouCam **AI Clothes Virtual Try-On** (`cloth-v4`) with a catalog look or your own garment photo, then add the item to the same bag.

No photo handy? **Try a sample face** and **Use a sample model** load YouCam's own API sample images, so the whole flow can be tried in one click.

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

## YouCam APIs used
| Feature | Endpoint |
|---|---|
| File upload | `POST /s2s/v2.0/file`, then `PUT` to the pre-signed URL |
| AI Skin Analysis (SD: wrinkle, acne, pore, texture, redness, oiliness, moisture, radiance) | `POST /s2s/v2.0/task/skin-analysis` with `format: json`, then poll |
| AI Clothes Virtual Try-On | `POST /s2s/v2.0/task/cloth-v4` (`ref_file_url` for catalog looks, `ref_file_id` for uploads), then poll |

## Notes
- Catalog prices and skincare brands are fictional. The try-on looks and sample photos in `public/samples/` are YouCam's own API sample images (plugins-media.makeupar.com), used to demo their API.
- Catalog looks are sent by URL, and the server only passes through URLs on YouCam's sample host.

## License
MIT, see [LICENSE](LICENSE).
