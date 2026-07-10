/* Registro de desempenho pessoal (offline, localStorage).
   Guarda cada tentativa e expõe agregações para o painel pessoal. */
(function () {
  "use strict";
  var KEY = "enemcn.progress.v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

  function nowISO() { return new Date().toISOString(); }

  var Tracker = {
    /* meta: {id, fonte, area, habilidade, ano, b, tier, escolha, correta} */
    record: function (meta) {
      var db = load();
      db.attempts = db.attempts || [];
      db.attempts.push({
        id: String(meta.id), fonte: meta.fonte || "ppl",
        area: meta.area || "CN", hab: meta.habilidade || null,
        ano: meta.ano || null, b: meta.b == null ? null : meta.b,
        tier: meta.tier || null, escolha: meta.escolha || null,
        ok: !!meta.correta, t: nowISO()
      });
      save(db);
      return db.attempts.length;
    },
    all: function () { return (load().attempts || []); },
    clear: function () { if (confirm("Apagar TODO o seu histórico de estudo? Não dá para desfazer.")) { localStorage.removeItem(KEY); return true; } return false; },
    export: function () { return JSON.stringify(load(), null, 2); },
    import: function (json) {
      try { var d = JSON.parse(json); if (!d.attempts) throw 0; save(d); return true; } catch (e) { return false; }
    },
    // agregações -----------------------------------------------------------
    summary: function () {
      var a = this.all();
      var total = a.length, ok = a.filter(function (x) { return x.ok; }).length;
      return { total: total, ok: ok, err: total - ok, taxa: total ? Math.round(ok / total * 100) : 0 };
    },
    byKey: function (keyFn) {
      var a = this.all(), m = {};
      a.forEach(function (x) {
        var k = keyFn(x); if (k == null) return;
        m[k] = m[k] || { total: 0, ok: 0 };
        m[k].total++; if (x.ok) m[k].ok++;
      });
      return m;
    },
    byHabilidade: function () { return this.byKey(function (x) { return x.hab; }); },
    byTier: function () { return this.byKey(function (x) { return x.tier && x.tier.rotulo; }); },
    byDia: function () { return this.byKey(function (x) { return (x.t || "").slice(0, 10); }); },
    // últimos itens errados (para revisão), sem repetir id
    errosParaRevisar: function (limit) {
      var a = this.all(), seen = {}, out = [];
      for (var i = a.length - 1; i >= 0 && out.length < (limit || 30); i--) {
        var x = a[i];
        if (x.ok || seen[x.id]) continue;
        seen[x.id] = 1; out.push(x);
      }
      return out;
    },
    // conjunto de ids já respondidos corretamente
    idsCorretos: function () {
      var s = {}; this.all().forEach(function (x) { if (x.ok) s[x.id] = 1; }); return s;
    }
  };
  window.Tracker = Tracker;
})();
