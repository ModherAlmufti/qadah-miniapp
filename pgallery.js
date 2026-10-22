/* ============================================================
   قدّاح — معرض صور صفحة المنتج (الميني آب + المتجر)
   نفس الملف في المستودعين. يعرض صورة الغلاف (image_url) أولاً
   ثم الصور الإضافية من catalog_public.gallery.
   سحب بالإصبع (scroll-snap أصلي)، نقاط أسفل الصورة،
   وأسهم تظهر فقط على الأجهزة التي فيها ماوس.
   صورة واحدة فقط = تُعرض كما كانت بلا نقاط ولا أسهم.
============================================================ */
(function () {
  var cssDone = false;
  function injectCSS() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement("style");
    s.textContent =
      ".pg-track{position:absolute;inset:0;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none}" +
      ".pg-track::-webkit-scrollbar{display:none}" +
      ".pg-slide{position:relative;flex:0 0 100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always}" +
      ".pg-slide img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
      ".pg-dots{position:absolute;bottom:12px;left:0;right:0;display:flex;justify-content:center;gap:6px;z-index:2;pointer-events:none}" +
      ".pg-dot{width:7px;height:7px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.55);box-shadow:0 0 0 1px rgba(1,24,58,.15);pointer-events:auto;cursor:pointer;transition:width .2s,background .2s}" +
      ".pg-dot.on{width:18px;border-radius:4px;background:#fff}" +
      ".pg-count{position:absolute;bottom:10px;left:12px;z-index:2;font-size:12px;font-weight:700;color:#fff;background:rgba(1,24,58,.45);padding:2px 8px;border-radius:999px;direction:ltr}" +
      ".pg-arrow{display:none;position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.9);color:#01183a;font-size:20px;line-height:38px;text-align:center;cursor:pointer;box-shadow:0 2px 8px rgba(1,24,58,.15)}" +
      ".pg-arrow[disabled]{opacity:.35;cursor:default}" +
      ".pg-prev{right:12px}.pg-next{left:12px}" +
      "@media (hover:hover) and (pointer:fine){.pg-arrow{display:block}}";
    document.head.appendChild(s);
  }

  function escAttr(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* القائمة النهائية: الغلاف ثم المعرض، بلا تكرار ولا قيم فارغة */
  function buildList(cover, gallery) {
    var out = [];
    [cover].concat(Array.isArray(gallery) ? gallery : []).forEach(function (u) {
      if (u && typeof u === "string" && out.indexOf(u) === -1) out.push(u);
    });
    return out;
  }

  /* box: عنصر الصورة الحالي (position:relative + aspect-ratio + overflow:hidden)
     يُضاف المعرض في أوله، فتبقى الشارات (badge) الموجودة فيه فوقه */
  function mount(box, cover, gallery, alt) {
    if (!box) return;
    injectCSS();
    var urls = buildList(cover, gallery);
    if (!urls.length) return;
    var n = urls.length, a = escAttr(alt || "");

    var html = '<div class="pg-track" dir="rtl">' + urls.map(function (u, i) {
      return '<div class="pg-slide"><img src="' + escAttr(u) + '" alt="' + (i === 0 ? a : a + " " + (i + 1)) + '"' +
        (i ? ' loading="lazy"' : "") + ' decoding="async" onerror="this.style.display=\'none\'"></div>';
    }).join("") + "</div>";

    if (n > 1) {
      html += '<button type="button" class="pg-arrow pg-prev" aria-label="الصورة السابقة">&#8250;</button>' +
              '<button type="button" class="pg-arrow pg-next" aria-label="الصورة التالية">&#8249;</button>' +
              '<div class="pg-dots">' + urls.map(function (_, i) {
                return '<button type="button" class="pg-dot' + (i ? "" : " on") + '" aria-label="الصورة ' + (i + 1) + ' من ' + n + '"></button>';
              }).join("") + "</div>" +
              '<span class="pg-count">1 / ' + n + "</span>";
    }
    box.insertAdjacentHTML("afterbegin", html);
    if (n < 2) return;

    var track = box.querySelector(".pg-track"),
        slides = track.querySelectorAll(".pg-slide"),
        dots = box.querySelectorAll(".pg-dot"),
        prev = box.querySelector(".pg-prev"),
        next = box.querySelector(".pg-next"),
        count = box.querySelector(".pg-count"),
        cur = 0;

    function index() {
      var w = track.clientWidth || 1;
      return Math.max(0, Math.min(n - 1, Math.round(Math.abs(track.scrollLeft) / w)));
    }
    function paint(i) {
      cur = i;
      for (var k = 0; k < dots.length; k++) dots[k].classList.toggle("on", k === i);
      prev.disabled = i === 0; next.disabled = i === n - 1;
      count.textContent = (i + 1) + " / " + n;
    }
    function go(i) {
      i = Math.max(0, Math.min(n - 1, i));
      /* inline:nearest يحرّك الشريط أفقياً فقط دون تمرير الصفحة */
      try { slides[i].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" }); }
      catch (e) { slides[i].scrollIntoView(false); }
      paint(i);
    }

    var t;
    track.addEventListener("scroll", function () {
      clearTimeout(t); t = setTimeout(function () { paint(index()); }, 60);
    }, { passive: true });
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });
    for (var k = 0; k < dots.length; k++) (function (k) {
      dots[k].addEventListener("click", function () { go(k); });
    })(k);
    track.setAttribute("tabindex", "0");
    track.setAttribute("aria-label", "صور الهدية، " + n + " صور");
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(cur + 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(cur - 1); }
    });
    paint(0);
  }

  window.QadahPGallery = { mount: mount, buildList: buildList };
})();
