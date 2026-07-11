/* Bootstrap comum: registra o service worker (PWA / offline) e ativa a trava
   de acesso pessoal. Incluído em todas as páginas. */
(function () {
  "use strict";
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
  if (window.Auth) window.Auth.require();
})();
