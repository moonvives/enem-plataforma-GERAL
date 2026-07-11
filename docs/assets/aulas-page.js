/* Aulas — renderiza o conteúdo extraído das videoaulas (window.ENEM_AULAS).
   Aguarda o desbloqueio pessoal (evento enem:unlocked). */
(function () {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  document.addEventListener("enem:unlocked", function () {
    var D = window.ENEM_AULAS;
    if (!D) return;
    var meta = D.meta, aulas = D.aulas || [];

    function kpi(n, l) { return '<div class="kpi"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
    el("kpis").innerHTML =
      kpi(meta.n_aulas, "Aulas") +
      kpi(meta.n_modelos, "Modelos ensinados") +
      kpi(meta.temas.length, meta.temas.length === 1 ? "Tema" : "Temas");
    el("foot-src").textContent = "Fonte: " + meta.fonte;

    function block(label, text) {
      return text ? '<div class="block"><div class="l">' + label + '</div><p>' + esc(text) + "</p></div>" : "";
    }

    function modeloEl(m, i) {
      var conc = (m.conceitos || []).map(function (c) { return '<span class="badge">' + esc(c) + "</span>"; }).join("");
      return '<details class="modelo"' + (i === 0 ? " open" : "") + '>' +
        '<summary><span class="idx">' + (i + 1) + "</span>" + esc(m.nome) +
          '<span class="chev">›</span></summary>' +
        '<div class="body">' +
          (conc ? '<div class="conc">' + conc + "</div>" : "") +
          block("Ideia central", m.ideia) +
          block("Como funciona", m.como_funciona) +
          block("Como cai no ENEM", m.como_cai) +
          (m.atalho ? '<div class="atalho block"><div class="l">Atalho</div><p>' + esc(m.atalho) + "</p></div>" : "") +
        "</div></details>";
    }

    el("aulas").innerHTML = aulas.map(function (a) {
      var temaQ = a.tema_banco
        ? '<a class="cta" href="modelos.html">Praticar questões de ' + esc(a.tema_banco) + " no banco de modelos →</a>"
        : "";
      return '<section class="aula">' +
        '<div class="ahead"><div><h2>' + esc(a.titulo) + "</h2>" +
          '<div class="curso">' + esc(a.curso) + " · " + esc(a.area) + "</div></div>" +
          '<span class="badge hab">' + esc(a.tema_banco || "") + "</span></div>" +
        '<p class="resumo">' + esc(a.resumo) + "</p>" +
        '<div class="mlist">' + (a.modelos || []).map(modeloEl).join("") + "</div>" +
        (a.fechamento ? '<div class="fechamento">' + esc(a.fechamento) + "</div>" : "") +
        temaQ +
        "</section>";
    }).join("");
  });
})();
