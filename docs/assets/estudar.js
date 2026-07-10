/* Modo Estudar: seleciona questões do banco (540 questões PPL com enunciado e
   gabarito), corrige e registra no Tracker. */
(function () {
  "use strict";
  document.addEventListener("enem:unlocked", init, { once: true });

  function init() {
    var DATA = window.ENEM_DATA;
    if (!DATA) return;
    // apenas questões com gabarito válido
    var BANK = DATA.questoes.filter(function (q) { return q.gabarito; });
    var META = DATA.meta;

    var hab = document.getElementById("s-hab");
    META.habilidades.forEach(function (h) {
      var o = document.createElement("option"); o.value = h.id; o.textContent = "H" + h.id; hab.appendChild(o);
    });
    var nivel = document.getElementById("s-nivel");
    META.regua.forEach(function (r) {
      var o = document.createElement("option"); o.value = r.nivel; o.textContent = r.icone + " " + r.rotulo; nivel.appendChild(o);
    });

    var mode = "sequencia";
    var queue = [], pos = 0, answered = 0, correct = 0;

    function areaClass(a) { return "area-" + a.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

    function build() {
      var list = BANK.slice();
      var h = hab.value, nv = nivel.value, ined = document.getElementById("s-inedito").value;
      if (h) list = list.filter(function (q) { return q.habilidade === +h; });
      if (nv) list = list.filter(function (q) { return q.tier && q.tier.nivel === +nv; });
      if (ined) { var okIds = Tracker.idsCorretos(); list = list.filter(function (q) { return !okIds[q.codigo]; }); }

      if (mode === "sequencia") {
        list.sort(function (a, b) { return (a.b || 9999) - (b.b || 9999); });
      } else if (mode === "aleatorio") {
        list.sort(function () { return Math.random() - 0.5; });
      } else if (mode === "fracas") {
        var byh = Tracker.byHabilidade();
        function taxa(q) { var s = byh[q.habilidade]; return s && s.total ? s.ok / s.total : 0.5; }
        list.sort(function (a, b) { return taxa(a) - taxa(b) || (a.b || 0) - (b.b || 0); });
      } else if (mode === "revisar") {
        var erros = Tracker.errosParaRevisar(200).map(function (e) { return e.id; });
        var idset = {}; erros.forEach(function (id, i) { idset[id] = i; });
        list = list.filter(function (q) { return idset[q.codigo] != null; })
          .sort(function (a, b) { return idset[a.codigo] - idset[b.codigo]; });
      }
      queue = list; pos = 0;
      render();
    }

    var stage = document.getElementById("stage");

    function render() {
      if (!queue.length) {
        stage.innerHTML = '<div class="studycard"><div class="empty">' +
          (mode === "revisar" ? "Você ainda não tem erros registrados para revisar. 🎉" : "Nenhuma questão para os filtros escolhidos.") +
          "</div></div>";
        return;
      }
      if (pos >= queue.length) {
        stage.innerHTML = '<div class="studycard" style="text-align:center">' +
          '<div style="font-size:2.4rem">🏁</div><h2>Sessão concluída</h2>' +
          '<p style="color:var(--muted)">Você respondeu <b>' + answered + '</b> questões nesta sessão, com <b>' + correct + '</b> acertos' +
          (answered ? " (" + Math.round(correct / answered * 100) + "%)" : "") + ".</p>" +
          '<div class="studybar" style="justify-content:center"><button class="btn" id="again">Nova sessão</button>' +
          '<a class="btn" href="meu-painel.html">Ver meu painel</a></div></div>';
        document.getElementById("again").addEventListener("click", build);
        return;
      }
      var q = queue[pos];
      var letters = ["A", "B", "C", "D", "E"];
      var tier = q.tier ? '<span class="tier t' + q.tier.nivel + '"><span class="dot"></span>' + q.tier.icone + " " + q.tier.rotulo + "</span>" : "";
      stage.innerHTML =
        '<div class="studycard">' +
          '<div class="qhead"><div class="tags">' +
            '<span class="code">' + q.codigo + "</span> " +
            '<span class="badge hab">H' + q.habilidade + '</span> ' +
            '<span class="badge ' + areaClass(q.area) + '">' + q.area + "</span> " +
            '<span class="badge hab">' + q.aplicacao + "</span></div>" + tier + "</div>" +
          '<div class="enun">' + (q.enunciado || "Enunciado indisponível — responda pelo gabarito que você lembra.") + "</div>" +
          '<div class="alts" id="alts">' +
            letters.map(function (L) {
              return '<button class="alt" data-l="' + L + '"><span class="l">' + L + "</span><span>Alternativa " + L + "</span></button>";
            }).join("") +
          "</div>" +
          '<div class="feedback" id="fb"></div>' +
          '<div class="studybar">' +
            '<span class="miniprog">Questão <b>' + (pos + 1) + "</b> de <b>" + queue.length + "</b> · sessão: <b>" + correct + "/" + answered + "</b></span>" +
            '<button class="btn" id="next" style="display:none">Próxima →</button>' +
          "</div>" +
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
          fb.className = "feedback " + (ok ? "ok" : "no");
          fb.innerHTML = ok
            ? "✓ Acertou! Gabarito <b>" + q.gabarito + "</b>."
            : "✗ Resposta correta: <b>" + q.gabarito + "</b>. Item registrado para revisão.";
          Tracker.record({
            id: q.codigo, fonte: "ppl", area: q.area, habilidade: q.habilidade,
            ano: q.ano, b: q.b, tier: q.tier, escolha: chosen, correta: ok
          });
          document.getElementById("next").style.display = "";
        });
      });
      document.getElementById("next").addEventListener("click", function () { pos++; render(); });
    }

    document.getElementById("modes").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]"); if (!b) return;
      Array.prototype.forEach.call(document.querySelectorAll("#modes button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on"); mode = b.getAttribute("data-mode");
      answered = 0; correct = 0; build();
    });
    ["s-hab", "s-nivel", "s-inedito"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", build);
    });

    // se veio de "revisar erros"
    if (location.hash === "#revisar") {
      mode = "revisar";
      var mb = document.querySelector('#modes button[data-mode="revisar"]');
      Array.prototype.forEach.call(document.querySelectorAll("#modes button"), function (x) { x.classList.remove("on"); });
      mb.classList.add("on");
    }
    build();
  }
})();
