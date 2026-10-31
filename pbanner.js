/* =========================================================
   قدّاح — الشريط المتحرك للأصناف (الصفحة الرئيسية)
   نفس الملف في المتجر (Qadah.Store) والميني اب (qadah-miniapp).
   QadahBanner.mount(section, items, { img(p), href(p), price(p) })
   - items: الأصناف المختارة من الداشبورد (in_banner) بترتيب العرض.
   - يتحرك وحده ببطء، ويمكن سحبه باليد، ويتوقف عند اللمس أو مرور الفأرة.
   - مع "تقليل الحركة" في الجهاز: لا حركة تلقائية، سحب يدوي فقط.
   - لا أصناف = القسم يبقى مخفياً.
   ========================================================= */
(function () {
  var SPEED = 32;          // بكسل في الثانية
  var RESUME_MS = 2500;    // استئناف الحركة بعد اللمس
  var css = false;

  function injectCSS() {
    if (css) return; css = true;
    var s = document.createElement("style");
    s.textContent =
      ".qb{margin:8px 0 4px}" +
      ".qb-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 var(--qb-pad,16px);margin-bottom:10px}" +
      ".qb-head b{font-size:17px;font-weight:800;color:var(--navy,#01183a)}" +
      ".qb-head span{font-size:12px;color:var(--muted,#8f8781)}" +
      ".qb-scroll{direction:ltr;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;" +
        "-webkit-mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent)}" +
      ".qb-scroll::-webkit-scrollbar{display:none}" +
      ".qb-track{display:flex;gap:12px;width:max-content;padding:4px var(--qb-pad,16px) 10px}" +
      ".qb-item{direction:rtl;flex:0 0 auto;width:var(--qb-w,150px);background:var(--card,#fffdfa);border-radius:18px;overflow:hidden;" +
        "box-shadow:0 6px 18px rgba(1,24,58,.08);display:block;color:inherit;text-decoration:none;-webkit-user-drag:none}" +
      ".qb-media{position:relative;aspect-ratio:4/5;background:var(--rose-soft,#f4e4df)}" +
      ".qb-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none;pointer-events:none}" +
      ".qb-body{padding:8px 10px 10px}" +
      ".qb-name{font-size:13px;font-weight:700;color:var(--navy,#01183a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".qb-price{font-size:13px;font-weight:800;color:var(--rose-deep,#b0705f);margin-top:2px}" +
      ".qb-price small{font-size:11px;font-weight:600;color:var(--muted,#8f8781)}" +
      "@media (min-width:821px){.qb{--qb-w:190px}.qb-head b{font-size:20px}}";
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function mount(section, items, o) {
    if (!section) return;
    items = (items || []).filter(Boolean);
    if (!items.length) { section.hidden = true; return; }
    injectCSS();
    o = o || {};
    var img = o.img || function (p) { return p.image_url || ""; };
    var href = o.href || function (p) { return "product.html?id=" + encodeURIComponent(p.id); };
    var price = o.price || function (p) { return Number(p.price || 0).toLocaleString("en-US"); };

    // نكرر القائمة حتى تكفي لعرض متصل، ثم ننسخها مرتين للدوران بلا قفزة
    var need = Math.max(8, Math.ceil(((window.innerWidth || 400) + 400) / 162));
    var set = items.slice();
    while (set.length < need) set = set.concat(items);
    // المسار باتجاه ltr للتمرير، فنعكس الترتيب: أول صنف يظهر في اليمين، والجديد يدخل من اليسار
    var one = set.slice().reverse().map(function (p) {
      var src = img(p);
      return '<a class="qb-item" href="' + esc(href(p)) + '" draggable="false">' +
        '<div class="qb-media">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") + "</div>" +
        '<div class="qb-body"><div class="qb-name">' + esc(p.name_ar || p.name_en || "") + "</div>" +
        '<div class="qb-price">' + price(p) + " <small>د.ع</small></div></div></a>";
    }).join("");

    section.classList.add("qb");
    section.innerHTML =
      '<div class="qb-head"><b>' + esc(o.title || "من تشكيلتنا") + "</b><span>" + esc(o.sub || "اسحب للمزيد") + "</span></div>" +
      '<div class="qb-scroll" aria-label="أصناف مختارة"><div class="qb-track">' + one + one + "</div></div>";
    section.hidden = false;
    // النسخة الثانية للدوران فقط، لا يقرأها قارئ الشاشة ولا يصلها التبويب
    var all = section.querySelectorAll(".qb-item");
    for (var i = set.length; i < all.length; i++) { all[i].setAttribute("aria-hidden", "true"); all[i].tabIndex = -1; }

    var sc = section.querySelector(".qb-scroll");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var paused = false, holdUntil = 0, visible = true, lastT = 0, acc = 0;
    function half() { return sc.scrollWidth / 2; }
    // نبدأ وأول صنف في أقصى اليمين، والحركة نحو اليمين فتدخل الأصناف التالية من اليسار
    function start() { sc.scrollLeft = Math.max(0, half() - sc.clientWidth); }
    function tick(t) {
      if (!lastT) lastT = t;
      var dt = Math.min(64, t - lastT); lastT = t;
      if (!reduce && !paused && visible && !document.hidden && t > holdUntil) {
        acc += SPEED * dt / 1000;
        var step = Math.floor(acc);
        if (step) { acc -= step; sc.scrollLeft -= step; }
      }
      // دوران: إذا وصلنا للبداية نقفز نصف المسافة (نفس المحتوى، لا يلاحظ)
      var h = half();
      if (h > 0) {
        if (sc.scrollLeft <= 1) sc.scrollLeft += h;
        else if (sc.scrollLeft >= h * 2 - sc.clientWidth - 1) sc.scrollLeft -= h;
      }
      requestAnimationFrame(tick);
    }
    function hold() { holdUntil = performance.now() + RESUME_MS; }
    sc.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") paused = true; });
    sc.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { paused = false; hold(); } });
    sc.addEventListener("touchstart", hold, { passive: true });
    sc.addEventListener("touchmove", hold, { passive: true });
    sc.addEventListener("wheel", hold, { passive: true });
    sc.addEventListener("focusin", function () { paused = true; });
    sc.addEventListener("focusout", function () { paused = false; });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(sc);
    }
    // ننتظر الصور الأولى قليلاً حتى يكون العرض صحيحاً
    requestAnimationFrame(function () { start(); requestAnimationFrame(tick); });
  }

  window.QadahBanner = { mount: mount };
})();
