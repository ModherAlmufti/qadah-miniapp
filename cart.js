// Qadah Mini App (H5) - cart logic.
// Same design as the store: store only { id, qty } per line, never the price.
// Prices and product details are always re-fetched from catalog_public,
// so a stored price can never go stale and the client is never trusted on price.

const CART_KEY = "qadah_cart";

const Cart = {
  items() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  save(list) {
    localStorage.setItem(CART_KEY, JSON.stringify(list));
    this.updateBadges();
  },

  add(id, qty) {
    qty = qty || 1;
    const list = this.items();
    const line = list.find((l) => l.id === id);
    if (line) {
      line.qty += qty;
    } else {
      list.push({ id: id, qty: qty });
    }
    this.save(list);
  },

  setQty(id, qty) {
    let list = this.items();
    if (qty <= 0) {
      list = list.filter((l) => l.id !== id);
    } else {
      const line = list.find((l) => l.id === id);
      if (line) line.qty = qty;
    }
    this.save(list);
  },

  remove(id) {
    this.save(this.items().filter((l) => l.id !== id));
  },

  clear() {
    this.save([]);
  },

  count() {
    return this.items().reduce((sum, l) => sum + l.qty, 0);
  },

  updateBadges() {
    const n = this.count();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = n;
      el.style.display = n > 0 ? "" : "none";
    });
  },
};

document.addEventListener("DOMContentLoaded", function () {
  Cart.updateBadges();
});
