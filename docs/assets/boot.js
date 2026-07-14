/* Bootstrap comum: remove instalações PWA antigas e ativa a trava de acesso
   pessoal. A plataforma é exclusivamente online. */
(function () {
  "use strict";
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) { registration.unregister(); });
      }).catch(function () {});
    });
  }
  if ("caches" in window) {
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf("enem-") === 0;
      }).map(function (key) { return caches.delete(key); }));
    }).catch(function () {});
  }
  if (window.Auth) window.Auth.require();
})();
