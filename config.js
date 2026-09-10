// Qadah Mini App (H5) - shared configuration
// Same Supabase project as the dashboard and the store.

const SUPABASE_URL = "https://tsqkqoibfxachknfmzjj.supabase.co";

// Publishable (anon) key. Same key used in the store and the dashboard.
// Paste it here. It is safe in the frontend because RLS guards the tables.
// Rotate it before launch and update it in every file.
const SUPABASE_KEY = "sb_publishable_JyCAQnMnltVq9nESIZjNew_St2FI6Ch";

const REST_URL = SUPABASE_URL + "/rest/v1";
const STORAGE_URL = SUPABASE_URL + "/storage/v1/object/public/product-images/";

// Cream placeholder shown when a product image fails to load.
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">' +
      '<rect width="300" height="300" fill="#f6efe2"/>' +
      '<text x="150" y="158" font-size="20" fill="#b7a99a" text-anchor="middle" font-family="sans-serif">قدح</text>' +
      "</svg>"
  );

// Build a usable image URL from catalog_public.image_url.
// After the migration image_url is a full URL, but stay tolerant of old relative paths.
function imageUrl(value) {
  if (!value) return PLACEHOLDER_IMG;
  return value.indexOf("http") === 0 ? value : STORAGE_URL + value;
}

// Format an integer price with thousands separators (Iraqi dinar).
function formatPrice(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US");
}

// Read helper for catalog_public over the Supabase REST API.
// The visitor (anon) has SELECT on catalog_public only, never on products.
async function fetchCatalog(query) {
  const url = REST_URL + "/catalog_public" + (query ? "?" + query : "");
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
    },
  });
  if (!res.ok) throw new Error("Supabase read failed: " + res.status);
  return res.json();
}
