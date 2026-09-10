// SuperQi (Alipay Mini Program) bridge for the H5 app.
// Inside the SuperQi web-view, the "my" object is injected by web-view.min.js
// (loaded in the page head). In a normal browser it is undefined, so every
// wrapper below degrades safely and the read-only pages still work.

const SuperQi = {
  inApp: function () {
    return typeof my !== "undefined" && my !== null;
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
  // Uses the silent auth_base scope (matches Mustafa's live app).
  // BLOCKED on Qi UAT credentials (this is the source of error 3). Wired later.
  getAuthCode: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.inApp() || !my.getAuthCode) {
        reject(new Error("Not running inside SuperQi"));
        return;
      }
      my.getAuthCode({
        scopes: ["auth_base"],
        success: function (r) {
          resolve(r.authCode);
        },
        fail: function (e) {
          reject(e);
        },
      });
    });
  },

  // Payment. Opens the cashier URL returned by superqi-pay-create.
  // Final parameter shape is confirmed with Qi at integration time.
  // BLOCKED on Qi. Wired later.
  tradePay: function (paymentUrl) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.inApp() || !my.tradePay) {
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
  },
};
