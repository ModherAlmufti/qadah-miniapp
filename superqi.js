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
};
