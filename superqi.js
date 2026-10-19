// SuperQi (Alipay+ mini program) bridge helper for the H5+ app.
//
// The page head loads the official hylid-bridge only inside the SuperQi
// container and exposes:
//   window.QADAH_IN_SUPERQI  true when the user agent is the SuperQi container
//   window.QADAH_BRIDGE      Promise -> true once "my" is ready, else false
// In a normal browser hylid-bridge is never loaded, so every wrapper below
// degrades safely and the read-only pages still work.
//
// Do not test "typeof my" alone: hylid-bridge defines "my" in desktop browsers
// too, so the user-agent flag is the real "inside SuperQi" signal.

const SuperQi = {
  // True only inside the SuperQi container with the bridge loaded.
  inApp: function () {
    return window.QADAH_IN_SUPERQI === true && typeof my !== "undefined" && my !== null;
  },

  // Resolves true when the bridge is ready (inside SuperQi), false otherwise.
  ready: function () {
    return window.QADAH_BRIDGE || Promise.resolve(false);
  },

  // Short toast. Falls back to the browser console outside the app.
  toast: function (text) {
    if (this.inApp() && my.showToast) {
      my.showToast({ content: text, type: "none", duration: 1500 });
    } else {
      console.log("[toast]", text);
    }
  },

  // Login. Returns a short-lived, single-use authCode that the backend
  // exchanges for tokens via the superqi-login Edge Function.
  // Silent auth_base scope (verified on Test, 17 Oct, v1.0.2).
  getAuthCode: function () {
    var self = this;
    return self.ready().then(function () {
      return new Promise(function (resolve, reject) {
        if (!self.inApp() || typeof my.getAuthCode !== "function") {
          reject(new Error("Not running inside SuperQi"));
          return;
        }
        my.getAuthCode({
          scopes: ["auth_base"],
          success: function (r) {
            if (r && r.authCode) resolve(r.authCode);
            else reject(new Error("getAuthCode returned no authCode"));
          },
          fail: function (e) {
            reject(e);
          },
        });
      });
    });
  },

  // ---------------------------------------------------------------------------
  // Auto-login (step 3, 18 Oct). Silent, no screen: auth_base authCode ->
  // superqi-login -> opaque session kept in localStorage. Qi tokens never reach
  // the app. Every call below resolves (never throws) so a login problem can
  // never break browsing or checkout; it only means the order is not linked.
  // ---------------------------------------------------------------------------
  SESSION_KEY: "qadah_qi_session",
  PENDING_KEY: "qadah_qi_pending_links",
  _loginPromise: null,

  getSession: function () {
    try {
      var s = JSON.parse(localStorage.getItem(this.SESSION_KEY) || "null");
      // Treat a session as gone one hour before it really expires.
      if (s && s.sessionToken && new Date(s.expiresAt).getTime() - 3600000 > Date.now()) return s;
    } catch (e) {}
    return null;
  },

  _saveSession: function (s) {
    try { localStorage.setItem(this.SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  },

  clearSession: function () {
    try { localStorage.removeItem(this.SESSION_KEY); } catch (e) {}
  },

  // Name / phone / email of the signed-in user (to prefill checkout), or null.
  profile: function () {
    var s = this.getSession();
    return (s && s.profile) || null;
  },

  _post: function (fn, body) {
    return fetch(SUPABASE_URL + "/functions/v1/" + fn, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data || {} };
      });
    });
  },

  // Resolves to the session object, or null (outside SuperQi / on any failure).
  // One login at a time; a valid stored session is reused without a new authCode.
  login: function (force) {
    var self = this;
    if (!force) {
      var cached = self.getSession();
      if (cached) return Promise.resolve(cached);
      if (self._loginPromise) return self._loginPromise;
    }
    if (window.QADAH_IN_SUPERQI !== true) return Promise.resolve(null);

    function attempt(retry) {
      return self.getAuthCode().then(function (code) {
        return self._post("superqi-login", { authCode: code });
      }).then(function (r) {
        if (r.status === 200 && r.data.sessionToken) {
          var s = { sessionToken: r.data.sessionToken, expiresAt: r.data.expiresAt, profile: r.data.profile || null };
          self._saveSession(s);
          return s;
        }
        // A used/expired authCode: get a fresh one once.
        if (r.data.reauth && retry) return attempt(false);
        console.warn("[qadah] login failed", r.status, r.data.error || "", r.data.resultCode || "");
        return null;
      });
    }

    self._loginPromise = attempt(true).catch(function (e) {
      console.warn("[qadah] login error", e && (e.error || e.message || e));
      return null;
    }).then(function (s) {
      self._loginPromise = null;
      return s;
    });
    return self._loginPromise;
  },

  // Attribute a just-created order to the signed-in user (customers.superqi_id).
  // order = the "order" object returned by create_order. Resolves true/false.
  // The link is queued first and removed once the server answers, so leaving
  // the page early or a network failure means it is retried on the next load.
  linkOrder: function (order) {
    var self = this;
    if (window.QADAH_IN_SUPERQI !== true || !order) return Promise.resolve(false);
    var ref = { orderId: order.id || order.order_id || null, orderCode: order.order_code || null };
    if (!ref.orderId && !ref.orderCode) return Promise.resolve(false);
    self._queue(ref);

    function send(session, again) {
      if (!session) return false;
      return self._post("superqi-link-order", {
        sessionToken: session.sessionToken, orderId: ref.orderId, orderCode: ref.orderCode,
      }).then(function (r) {
        if (!r.data.reauth) self._unqueue(ref);
        if (r.status === 200 && r.data.ok) {
          if (r.data.profile) { session.profile = r.data.profile; self._saveSession(session); }
          return true;
        }
        if (r.data.reauth && again) {
          self.clearSession();
          return self.login(true).then(function (s) { return send(s, false); });
        }
        console.warn("[qadah] link failed", r.status, r.data.error || "");
        return false; // a refusal (window passed, wrong channel...) is final, not queued
      });
    }

    return self.login().then(function (s) { return send(s, true); }).catch(function (e) {
      console.warn("[qadah] link error, will retry", e && e.message);
      return false;
    });
  },

  _sameRef: function (a, b) {
    return (a.orderId && a.orderId === b.orderId) || (!a.orderId && !b.orderId && a.orderCode === b.orderCode);
  },

  _queue: function (ref) {
    var self = this;
    try {
      var list = JSON.parse(localStorage.getItem(this.PENDING_KEY) || "[]");
      var old = list.filter(function (x) { return self._sameRef(x, ref); })[0];
      list = list.filter(function (x) { return !self._sameRef(x, ref); });
      list.push({ orderId: ref.orderId, orderCode: ref.orderCode, at: old ? old.at : Date.now() });
      localStorage.setItem(this.PENDING_KEY, JSON.stringify(list.slice(-5)));
    } catch (e) {}
  },

  _unqueue: function (ref) {
    var self = this;
    try {
      var list = JSON.parse(localStorage.getItem(this.PENDING_KEY) || "[]");
      localStorage.setItem(this.PENDING_KEY, JSON.stringify(list.filter(function (x) { return !self._sameRef(x, ref); })));
    } catch (e) {}
  },

  // Retry links that did not get a server answer (the server accepts them for 30 min).
  _flushQueue: function () {
    var self = this, list;
    try { list = JSON.parse(localStorage.getItem(self.PENDING_KEY) || "[]"); } catch (e) { list = []; }
    list.forEach(function (ref) {
      if (Date.now() - ref.at < 30 * 60000) self.linkOrder({ id: ref.orderId, order_code: ref.orderCode });
      else self._unqueue(ref);
    });
  },

  // Payment. Opens the cashier URL returned by superqi-pay-create.
  // Resolves with the raw result; resultCode "9000" means success.
  // Any other code is handled by the caller (pending -> wait for webhook).
  tradePay: function (paymentUrl) {
    var self = this;
    return self.ready().then(function () {
      return new Promise(function (resolve, reject) {
        if (!self.inApp() || typeof my.tradePay !== "function") {
          reject(new Error("Not running inside SuperQi"));
          return;
        }
        my.tradePay({
          paymentUrl: paymentUrl,
          success: function (r) {
            resolve(r);
          },
          fail: function (e) {
            reject(e);
          },
        });
      });
    });
  },

  // ---------------------------------------------------------------------------
  // Payment flow (step 4, 19 Oct). The order is created by create_order first
  // (unchanged); then superqi-pay-create returns the cashier URL, tradePay
  // opens it, and the server confirms with Qi before the app says "paid".
  // Every call resolves (never throws). States the caller gets:
  //   paid      money confirmed (or tradePay 9000)
  //   pending   unknown yet (8000 / 6004 / 6002 / Qi "U"); check again, do not pay twice
  //   failed    nothing charged (4000 / 6001 cancel / Qi "F"); the cart is kept
  //   error     could not start (no login, network, bridge missing)
  // ---------------------------------------------------------------------------
  PAY_KEY: "qadah_qi_pending_pay",

  _orderRef: function (order) {
    return { orderId: (order && (order.id || order.order_id)) || null, orderCode: (order && order.order_code) || null };
  },

  // The order waiting for payment (kept so "retry" pays the same order).
  pendingPayment: function () {
    try {
      var p = JSON.parse(localStorage.getItem(this.PAY_KEY) || "null");
      if (p && Date.now() - p.at < 2 * 3600000) return p;
    } catch (e) {}
    return null;
  },
  _savePending: function (p) {
    try { localStorage.setItem(this.PAY_KEY, JSON.stringify(p)); } catch (e) {}
  },
  clearPendingPayment: function () {
    try { localStorage.removeItem(this.PAY_KEY); } catch (e) {}
  },

  // Calls superqi-pay-create, handling an expired session and an order that
  // is not linked yet (link it, then try once more).
  _payCall: function (order, action) {
    var self = this;
    var ref = self._orderRef(order);
    function call(session, retried) {
      if (!session) return { state: "error", error: "login" };
      return self._post("superqi-pay-create", {
        sessionToken: session.sessionToken, orderId: ref.orderId, orderCode: ref.orderCode, action: action,
      }).then(function (r) {
        if (r.status === 200 && r.data.state) return r.data;
        if (!retried && r.data.reauth) {
          self.clearSession();
          return self.login(true).then(function (s) { return call(s, true); });
        }
        if (!retried && r.data.error === "order_not_linked") {
          return self.linkOrder(order).then(function () { return call(session, true); });
        }
        console.warn("[qadah] pay-create", action, r.status, r.data.error || "", r.data.message || "");
        return { state: "error", error: r.data.error || "http_" + r.status };
      });
    }
    return self.login().then(function (s) { return call(s, false); }).catch(function (e) {
      console.warn("[qadah] pay-create error", e && e.message);
      return { state: "error", error: "network" };
    });
  },

  // Ask the server for the latest state (it asks Qi and marks the order paid).
  checkPayment: function (order) {
    var self = this;
    return self._payCall(order, "status").then(function (r) {
      if (r.state === "paid") self.clearPendingPayment();
      return r;
    });
  },

  // Full flow for one order: get the cashier URL, open tradePay, read the result.
  payOrder: function (order) {
    var self = this;
    if (window.QADAH_IN_SUPERQI !== true) return Promise.resolve({ state: "error", error: "not_in_app" });
    var ref = self._orderRef(order);
    var prev = self.pendingPayment();
    var same = prev && ((ref.orderId && prev.orderId === ref.orderId) || (!ref.orderId && prev.orderCode === ref.orderCode));
    var saved = { orderId: ref.orderId, orderCode: ref.orderCode, total: order.total, url: same ? prev.url : null, at: Date.now() };
    self._savePending(saved);

    return self._payCall(order, "pay").then(function (r) {
      if (r.state === "redirect") {
        saved.url = r.paymentUrl; saved.at = Date.now(); self._savePending(saved);
        return self._openCashier(order, r.paymentUrl);
      }
      // Qi says the earlier attempt is still open: reopen the same cashier page.
      if (r.state === "pending" && r.resultCode === "PAYMENT_IN_PROCESS" && saved.url) {
        return self._openCashier(order, saved.url);
      }
      if (r.state === "paid") self.clearPendingPayment();
      return r;
    });
  },

  _openCashier: function (order, url) {
    var self = this;
    return self.tradePay(url).then(function (res) {
      return self._readTradePay(order, res);
    }, function (err) {
      if (err && err.message === "Not running inside SuperQi") return { state: "error", error: "bridge" };
      return self._readTradePay(order, err);
    });
  },

  // tradePay result codes (SuperQi docs): 9000 success, 8000 processing,
  // 4000 failed, 6001 cancelled, 6002 network error, 6004 unknown.
  _readTradePay: function (order, res) {
    var self = this;
    var code = String((res && (res.resultCode || res.error || res.errorCode)) || "");
    console.log("[qadah] tradePay", code);
    if (code === "9000") {
      // Paid per the wallet. Ask the server to confirm and mark the order paid.
      self.checkPayment(order);
      self.clearPendingPayment();
      return { state: "paid", tradePayCode: code };
    }
    if (code === "8000" || code === "6004" || code === "6002") return { state: "pending", tradePayCode: code };
    if (code === "6001") return { state: "failed", tradePayCode: code, cancelled: true };
    return { state: "failed", tradePayCode: code || "unknown" };
  },
};

// Start the silent login as soon as any page loads inside SuperQi, then retry
// any queued order links. Outside SuperQi this does nothing.
if (window.QADAH_IN_SUPERQI === true) {
  SuperQi.login().then(function (s) { if (s) SuperQi._flushQueue(); });
}
