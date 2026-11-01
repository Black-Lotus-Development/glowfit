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

// Worn-outfit reference photos from YouCam's own API samples. `img` is the local thumbnail;
// `ref` is the full-size original, passed to cloth-v4 as ref_file_url so nothing is re-uploaded.
const YC_SAMPLES = "https://plugins-media.makeupar.com/strapi/assets/";
const GARMENTS = [
  { id: "g1", name: "Grey Pocket Tee", price: 32, category: "upper_body", img: "samples/look-pocket-tee.jpg", ref: YC_SAMPLES + "small_clothes_04_441e848298.png" },
  { id: "g2", name: "Oxford Shirt & Chinos", price: 110, category: "full_body", img: "samples/look-oxford-chinos.jpg", ref: YC_SAMPLES + "body_reshape_02_7777218379.jpg" },
  { id: "g3", name: "Faux Fur Jacket Look", price: 139, category: "full_body", img: "samples/look-fur-jacket.jpg", ref: YC_SAMPLES + "clothes_reference_full_body_01_5a000d999f.png" },
];
