// Demo catalog. Prices & brands are fictional. `actives` drive the ingredient-clash checker.
const CONCERN_META = {
  wrinkle:   { label: "Fine lines & wrinkles", tip: "Retinoids and peptides support collagen." },
  acne:      { label: "Blemishes", tip: "Salicylic acid and niacinamide help clear and calm." },
  pore:      { label: "Pores", tip: "BHA and niacinamide refine the look of pores." },
  texture:   { label: "Smoothness", tip: "Gentle exfoliation evens out texture." },
  redness:   { label: "Redness", tip: "Barrier-repair and soothing actives reduce reactivity." },
  oiliness:  { label: "Oil balance", tip: "Lightweight, oil-control formulas keep shine in check." },
  moisture:  { label: "Hydration", tip: "Humectants like hyaluronic acid plump and hydrate." },
  radiance:  { label: "Radiance", tip: "Vitamin C brightens and protects." },
};

const PRODUCTS = [
  { id: "p1", name: "Calm Barrier Cream", brand: "Lumera", price: 28, concerns: ["redness", "moisture"], actives: ["ceramides", "centella"], slot: "both", step: "Moisturize" },
  { id: "p2", name: "Clear BHA 2% Serum", brand: "Veyra", price: 24, concerns: ["acne", "pore", "texture"], actives: ["salicylic acid"], slot: "pm", step: "Treat" },
  { id: "p3", name: "Niacinamide 10% + Zinc", brand: "Pure Theory", price: 14, concerns: ["pore", "oiliness", "acne"], actives: ["niacinamide"], slot: "both", step: "Treat" },
  { id: "p4", name: "Retinal Night Concentrate", brand: "Veyra", price: 46, concerns: ["wrinkle", "texture", "radiance"], actives: ["retinol"], slot: "pm", step: "Treat" },
  { id: "p5", name: "Peptide Firm Serum", brand: "Lumera", price: 38, concerns: ["wrinkle"], actives: ["peptides"], slot: "both", step: "Treat" },
  { id: "p6", name: "Vitamin C 15% Brightener", brand: "Solenne", price: 34, concerns: ["radiance", "texture"], actives: ["vitamin c"], slot: "am", step: "Treat" },
  { id: "p7", name: "Hyaluronic Water Gel", brand: "Pure Theory", price: 19, concerns: ["moisture", "oiliness"], actives: ["hyaluronic acid"], slot: "both", step: "Moisturize" },
  { id: "p8", name: "Glycolic Smoothing Toner", brand: "Solenne", price: 22, concerns: ["texture", "radiance", "pore"], actives: ["glycolic acid"], slot: "pm", step: "Treat" },
  { id: "p9", name: "Mineral SPF 50 Fluid", brand: "Solenne", price: 26, concerns: ["redness", "wrinkle", "radiance"], actives: ["zinc oxide"], slot: "am", step: "Protect", essential: true },
  { id: "p10", name: "Soft Gel Cleanser", brand: "Lumera", price: 16, concerns: ["oiliness", "acne", "redness"], actives: [], slot: "both", step: "Cleanse", essential: true },
  { id: "p11", name: "Azelaic Acid 10%", brand: "Veyra", price: 29, concerns: ["redness", "acne"], actives: ["azelaic acid"], slot: "pm", step: "Treat" },
];

// Pairs that shouldn't share a routine slot (or need alternating nights).
const CLASHES = [
  [["retinol"], ["glycolic acid", "salicylic acid"], "Retinol + exfoliating acids can over-irritate — alternate nights."],
  [["retinol"], ["vitamin c"], "Retinol and vitamin C work best apart: vitamin C in the morning, retinol at night."],
];

const GARMENTS = [
  { id: "g1", name: "Linen Shirt", price: 59, color: "#7aa6c2", kind: "top", category: "upper_body" },
  { id: "g2", name: "Rust Knit Tee", price: 42, color: "#c9673a", kind: "top", category: "upper_body" },
  { id: "g3", name: "Sage Wrap Dress", price: 88, color: "#8fae8b", kind: "dress", category: "full_body" },
  { id: "g4", name: "Ink Slip Dress", price: 96, color: "#25304f", kind: "dress", category: "full_body" },
];

// Draws a simple flat-lay garment as SVG (used as thumbnail and as the reference image for one-click try-on).
function garmentSvg(g) {
  const c = g.color;
  const shapes = g.kind === "dress"
    ? `<path d="M150 40 L120 70 L130 120 L95 330 Q200 360 305 330 L270 120 L280 70 L250 40 Q200 70 150 40Z" fill="${c}"/><path d="M150 40 Q200 70 250 40" stroke="#00000022" stroke-width="3" fill="none"/>`
    : `<path d="M140 50 L70 90 L95 140 L125 120 L125 320 L275 320 L275 120 L305 140 L330 90 L260 50 Q200 90 140 50Z" fill="${c}"/><path d="M140 50 Q200 90 260 50" stroke="#00000022" stroke-width="3" fill="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 380" width="400" height="380"><rect width="400" height="380" fill="#f4efe9"/>${shapes}</svg>`;
}
const garmentSvgUrl = (g) => "data:image/svg+xml;utf8," + encodeURIComponent(garmentSvg(g));
