/* Modo Estudar: pratica questões de duas fontes e registra no Tracker.
   - "provas": provas oficiais do ENEM com alternativas reais (window.ENEM_PROVAS).
   - "ppl": banco de 540 questões PPL (window.ENEM_DATA), correção pelo gabarito. */
(function () {
  "use strict";
  document.addEventListener("enem:unlocked", init, { once: true });

  function init() {
    var DATA = window.ENEM_DATA;
    var PROVAS = window.ENEM_PROVAS;
    var META = DATA ? DATA.meta : null;

    var fonte = PROVAS && PROVAS.questoes.length ? "provas" : "ppl";
    var mode = "sequencia";
    var queue = [], pos = 0, answered = 0, correct = 0;

    // ---- normalização de questões por fonte ------------------------------
    function bankProvas() {
      // apenas questões com alternativas em texto (respondíveis)
      return PROVAS.questoes.filter(function (q) {
        return q.alternativas_tipo === "texto" && q.gabarito;
      }).map(function (q) {
        return {
          id: q.codigo, habilidade: q.habilidade, area: q.area,
          aplicacao: "ENEM " + q.ano + " · " + (q.cor || ""),
          enunciado: q.enunciado, gabarito: q.gabarito, b: q.b_enem,
          tier: q.tier, alternativas: q.alternativas, fonte: "prova"
        };
      });
    }
    function bankPPL() {
      return DATA.questoes.filter(function (q) { return q.gabarito; }).map(function (q) {
        return {
          id: q.codigo, habilidade: q.habilidade, area: q.area,
          aplicacao: q.aplicacao, enunciado: q.enunciado, gabarito: q.gabarito,
          b: q.b, tier: q.tier, alternativas: null, fonte: "ppl"
        };
      });
    }
    function bank() { return fonte === "provas" ? bankProvas() : bankPPL(); }

    // ---- filtros ---------------------------------------------------------
    var habSel = document.getElementById("s-hab");
    if (META) META.habilidades.forEach(function (h) {
      var o = document.createElement("option"); o.value = h.id; o.textContent = "H" + h.id; habSel.appendChild(o);
    });
    var nivelSel = document.getElementById("s-nivel");
    [[1, "Muito fácil"], [2, "Fácil"], [3, "Mediana"], [4, "Difícil"], [5, "Muito difícil"]].forEach(function (r) {
      var o = document.createElement("option"); o.value = r[0]; o.textContent = "Nível " + r[0] + " · " + r[1]; nivelSel.appendChild(o);
    });

    function areaClass(a) { return "area-" + (a || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

    function build() {
      var list = bank();
      var h = habSel.value, nv = nivelSel.value, ined = document.getElementById("s-inedito").value;
      if (h) list = list.filter(function (q) { return q.habilidade === +h; });
      if (nv) list = list.filter(function (q) { return q.tier && q.tier.nivel === +nv; });
      if (ined) { var okIds = Tracker.idsCorretos(); list = list.filter(function (q) { return !okIds[q.id]; }); }

      if (mode === "sequencia") list.sort(function (a, b) { return (a.b || 9999) - (b.b || 9999); });
      else if (mode === "aleatorio") list.sort(function () { return Math.random() - 0.5; });
      else if (mode === "fracas") {
        var byh = Tracker.byHabilidade();
        var taxa = function (q) { var s = byh[q.habilidade]; return s && s.total ? s.ok / s.total : 0.5; };
        list.sort(function (a, b) { return taxa(a) - taxa(b) || (a.b || 0) - (b.b || 0); });
      } else if (mode === "revisar") {
        var erros = Tracker.errosParaRevisar(300).map(function (e) { return e.id; });
        var idx = {}; erros.forEach(function (id, i) { idx[id] = i; });
        list = list.filter(function (q) { return idx[q.id] != null; }).sort(function (a, b) { return idx[a.id] - idx[b.id]; });
      }
      queue = list; pos = 0; answered = 0; correct = 0;
      render();
    }

    var stage = document.getElementById("stage");

    function render() {
      if (!queue.length) {
        stage.innerHTML = '<div class="studycard"><div class="empty">' +
          (mode === "revisar" ? "Você ainda não tem erros registrados para revisar nesta fonte." : "Nenhuma questão para os filtros escolhidos.") +
          "</div></div>";
        return;
      }
      if (pos >= queue.length) {
        stage.innerHTML = '<div class="studycard" style="text-align:center">' +
          "<h2>Sessão concluída</h2>" +
          '<p style="color:var(--muted)">Você respondeu <b>' + answered + "</b> questões, com <b>" + correct + "</b> acertos" +
          (answered ? " (" + Math.round(correct / answered * 100) + "%)" : "") + ".</p>" +
          '<div class="studybar" style="justify-content:center"><button class="btn" id="again">Nova sessão</button> ' +
          '<a class="btn" href="meu-painel.html">Ver meu painel</a></div></div>';
        document.getElementById("again").addEventListener("click", build);
        return;
      }
      var q = queue[pos];
      var tier = q.tier ? '<span class="tier t' + q.tier.nivel + '"><span class="lvl l' + q.tier.nivel + '">' + q.tier.nivel + "</span>" + q.tier.rotulo + "</span>" : "";
      var letters = ["A", "B", "C", "D", "E"];
      var altsHtml = letters.map(function (L, i) {
        var texto = q.alternativas ? q.alternativas[i].texto : "Alternativa " + L;
        return '<button class="alt" data-l="' + L + '"><span class="l">' + L + '</span><span>' + escapeHtml(texto) + "</span></button>";
      }).join("");
      stage.innerHTML =
        '<div class="studycard">' +
          '<div class="qhead"><div class="tags">' +
            '<span class="code">' + q.id + "</span> " +
            (q.habilidade ? '<span class="badge hab">H' + q.habilidade + "</span> " : "") +
            '<span class="badge ' + areaClass(q.area) + '">' + q.area + "</span> " +
            '<span class="badge hab">' + q.aplicacao + "</span></div>" + tier + "</div>" +
          '<div class="enun">' + (q.enunciado ? escapeHtml(q.enunciado) : "Enunciado indisponível.") + "</div>" +
          '<div class="alts" id="alts">' + altsHtml + "</div>" +
          '<div class="feedback" id="fb"></div>' +
          '<div class="studybar"><span class="miniprog">Questão <b>' + (pos + 1) + "</b> de <b>" + queue.length +
            "</b> · sessão: <b>" + correct + "/" + answered + "</b></span>" +
            '<button class="btn" id="next" style="display:none">Próxima →</button></div>' +
        "</div>";

      var done = false;
      Array.prototype.forEach.call(document.querySelectorAll("#alts .alt"), function (btn) {
        btn.addEventListener("click", function () {
          if (done) return; done = true;
          var chosen = btn.getAttribute("data-l");
          var ok = chosen === q.gabarito;
          answered++; if (ok) correct++;
          Array.prototype.forEach.call(document.querySelectorAll("#alts .alt"), function (b2) {
            b2.setAttribute("disabled", "");
            var L = b2.getAttribute("data-l");
            if (L === q.gabarito) b2.classList.add("correct");
            else if (L === chosen) b2.classList.add("wrong");
          });
          var fb = document.getElementById("fb");
          var svgOk = '<svg class="ico" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
          var svgNo = '<svg class="ico" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          fb.className = "feedback " + (ok ? "ok" : "no");
          fb.innerHTML = ok
            ? svgOk + "<span>Correto. Gabarito <b>" + q.gabarito + "</b>.</span>"
            : svgNo + "<span>Incorreto. Resposta correta: <b>" + q.gabarito + "</b>. Item registrado para revisão.</span>";
          Tracker.record({ id: q.id, fonte: q.fonte, area: q.area, habilidade: q.habilidade, b: q.b, tier: q.tier, escolha: chosen, correta: ok });
          document.getElementById("next").style.display = "";
        });
      });
      document.getElementById("next").addEventListener("click", function () { pos++; render(); });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }

    // ---- controles -------------------------------------------------------
    document.getElementById("fontes").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-fonte]"); if (!b) return;
      Array.prototype.forEach.call(document.querySelectorAll("#fontes button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on"); fonte = b.getAttribute("data-fonte"); build();
    });
    document.getElementById("modes").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]"); if (!b) return;
      Array.prototype.forEach.call(document.querySelectorAll("#modes button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on"); mode = b.getAttribute("data-mode"); build();
    });
    ["s-hab", "s-nivel", "s-inedito"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", build);
    });

    if (location.hash === "#revisar") {
      mode = "revisar";
      Array.prototype.forEach.call(document.querySelectorAll("#modes button"), function (x) { x.classList.remove("on"); });
      var mb = document.querySelector('#modes button[data-mode="revisar"]'); if (mb) mb.classList.add("on");
    }
    // se não houver provas, esconde o seletor de fonte
    if (!(PROVAS && PROVAS.questoes.length)) document.getElementById("fontes").style.display = "none";
    build();
  }
})();
