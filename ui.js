// Qadah Mini App - shared UI helpers for the home and product pages (v2).
// Loaded after config.js and cart.js. No checkout or payment logic here.

var WISH_KEY = "qadah_wish_v1";
var BADGES = { best_seller: "الأكثر طلباً", new: "جديد", premium: "بريميوم" };

// Icon keys are chosen per occasion/recipient in the dashboard.
var ICONS = {
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  cake: '<path d="M4 20h16M5 20v-7h14v7M8 13v-3M12 13v-3M16 13v-3M8 7v.01M12 6v.01M16 7v.01"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 5l2-2 2 2"/>',
  star: '<path d="M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.6-.8z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7"/>',
  gift: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
  dove: '<path d="M4 14c3 0 5-2 6-5 1 3 4 5 8 5-2 3-5 5-9 5-2 0-4-1-5-2M10 9c0-3 2-5 5-5"/>',
  flower: '<circle cx="12" cy="9" r="2.5"/><path d="M12 6.5c-1-3-5-2-4 1M12 6.5c1-3 5-2 4 1M9.6 10.5c-3 1-2 5 1 4M14.4 10.5c3 1 2 5-1 4M12 12v9M12 17c-2-1-4 0-5 2M12 18c2-1 4 0 5 2"/>',
  baby: '<circle cx="12" cy="10" r="5"/><path d="M10 10v.01M14 10v.01M10.5 12.5c1 .7 2 .7 3 0M7 20c1-3 3-4 5-4s4 1 5 4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  crown: '<path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z"/>',
  her: '<circle cx="12" cy="9" r="4"/><path d="M12 13v8M9 18h6"/>',
  him: '<circle cx="10" cy="14" r="4"/><path d="M13 11l6-6M15 5h4v4"/>',
  mother: '<circle cx="12" cy="7" r="3"/><path d="M6 21c0-5 3-8 6-8s6 3 6 8M12 13v4"/>',
  friend: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-4 2-6 5-6s5 2 5 6M11 20c0-4 2-6 5-6s5 2 5 6"/>',
  family: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="12" cy="12" r="2"/><path d="M3 20c0-4 2-7 4-7s4 3 4 7M13 20c0-4 2-7 4-7s4 3 4 7"/>',
  briefcase: '<path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16"/>',
  all: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>'
};

function icon(key) {
  var d = ICONS[key];
  if (!d) return "";
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// Real product image or empty string (the .ph placeholder shows behind it).
function photo(p) {
  if (!p || !p.image_url) return "";
  return p.image_url.indexOf("http") === 0 ? p.image_url : STORAGE_URL + p.image_url;
}

async function rest(path) {
  var res = await fetch(REST_URL + "/" + path, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
  });
  if (!res.ok) throw new Error("Supabase read failed: " + res.status);
  return res.json();
}

// Active occasions/recipients, ordered as set in the dashboard. Never throws.
async function loadTags() {
  try {
    var r = await Promise.all([
      rest("occasions?select=id,name_ar,icon,sort_order&is_active=eq.true&order=sort_order.asc"),
      rest("recipients?select=id,name_ar,icon,sort_order&is_active=eq.true&order=sort_order.asc")
    ]);
    return { occasions: r[0], recipients: r[1] };
  } catch (e) {
    console.warn("tags", e);
    return { occasions: [], recipients: [] };
  }
}

// Wishlist lives on this device only until customer accounts exist.
var Wish = {
  all: function () {
    try { var a = JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  },
  has: function (id) { return this.all().indexOf(id) !== -1; },
  toggle: function (id) {
    var a = this.all(), i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else a.push(id);
    try { localStorage.setItem(WISH_KEY, JSON.stringify(a)); } catch (e) {}
    return i < 0;
  }
};

function toast(html) {
  var t = document.getElementById("qtoast");
  if (!t) return;
  t.innerHTML = html;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
}

function countWord(n) {
  if (n === 0) return "لا توجد هدايا";
  if (n === 1) return "هدية واحدة";
  if (n === 2) return "هديتان";
  if (n <= 10) return n + " هدايا";
  return n + " هدية";
}
