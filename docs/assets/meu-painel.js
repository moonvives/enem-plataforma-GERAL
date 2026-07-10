/* Painel pessoal: agrega o histórico do Tracker em KPIs, taxa por habilidade,
   por faixa de dificuldade, evolução diária e lista de erros para revisar. */
(function () {
  "use strict";
  document.addEventListener("enem:unlocked", init, { once: true });

  function init() {
    var META = window.ENEM_DATA ? window.ENEM_DATA.meta : null;
    var nome = window.Auth ? window.Auth.name() : "";
    document.getElementById("ola").textContent = nome ? "Olá, " + nome + " 👋" : "Meu painel";

    wireActions();
    render();
  }

  function rateClass(p) { return p >= 70 ? "rate-good" : p >= 50 ? "rate-mid" : "rate-bad"; }
  function bar(pct, color) {
    return '<span class="bar-track"><span class="bar-fill" style="width:' + pct + "%;background:" + (color || "var(--brand)") + '"></span></span>';
  }

  function render() {
    var root = document.getElementById("conteudo");
    var s = Tracker.summary();
    if (!s.total) {
      root.innerHTML = '<div class="card empty-cta"><div style="font-size:2.6rem">📊</div>' +
        "<h2>Seu painel está pronto para começar</h2>" +
        '<p style="color:var(--muted)">Responda algumas questões no modo Estudar e seu desempenho aparece aqui: acertos, taxa por habilidade, pontos fracos e itens para revisar.</p>' +
        '<a class="btn" href="estudar.html" style="background:var(--brand);color:#fff;border-color:var(--brand)">Começar a estudar</a></div>';
      return;
    }

    var tierColors = { "Muito fácil": "var(--t1)", "Fácil": "var(--t2)", "Mediana": "var(--t3)", "Difícil": "var(--t4)", "Muito difícil": "var(--t5)" };
    var byH = Tracker.byHabilidade();
    var byT = Tracker.byTier();
    var byD = Tracker.byDia();
    var erros = Tracker.errosParaRevisar(20);
    var streak = calcStreak(Object.keys(byD));

    // KPIs
    var kpis = '<section class="kpis">' +
      kpi(s.total, "Respondidas") +
      kpi(s.ok, "Acertos") +
      kpi('<span class="' + rateClass(s.taxa) + '">' + s.taxa + "%</span>", "Aproveitamento") +
      kpi(streak + (streak === 1 ? " dia" : " dias"), "Sequência") +
      "</section>";

    // habilidade
    var habRows = [];
    for (var h = 1; h <= 30; h++) {
      var d = byH[h]; if (!d) continue;
      var p = Math.round(d.ok / d.total * 100);
      habRows.push({ p: p, html: '<div class="bar-row"><span class="lab">H' + h + " (" + d.total + ")</span>" +
        bar(p, p >= 70 ? "var(--t1)" : p >= 50 ? "var(--t3)" : "var(--t5)") +
        '<span class="val ' + rateClass(p) + '">' + p + "%</span></div>" });
    }
    habRows.sort(function (a, b) { return a.p - b.p; });
    var habPanel = panel("Aproveitamento por habilidade", "Ordenado das mais fracas para as mais fortes",
      habRows.length ? habRows.map(function (r) { return r.html; }).join("") : "<p class='sub'>Sem dados.</p>");

    // faixa de dificuldade
    var ordem = ["Muito fácil", "Fácil", "Mediana", "Difícil", "Muito difícil"];
    var tierRows = ordem.filter(function (t) { return byT[t]; }).map(function (t) {
      var d = byT[t], p = Math.round(d.ok / d.total * 100);
      return '<div class="bar-row"><span class="lab">' + t + " (" + d.total + ")</span>" + bar(p, tierColors[t]) +
        '<span class="val ' + rateClass(p) + '">' + p + "%</span></div>";
    }).join("");
    var tierPanel = panel("Aproveitamento por dificuldade (TRI)", "Coerência pedagógica: o esperado é acertar mais os fáceis",
      tierRows || "<p class='sub'>Sem dados.</p>");

    // evolução diária
    var dias = Object.keys(byD).sort();
    var maxDia = Math.max.apply(null, dias.map(function (k) { return byD[k].total; }));
    var evoRows = dias.slice(-14).map(function (k) {
      var d = byD[k], p = Math.round(d.ok / d.total * 100);
      var lab = k.slice(8, 10) + "/" + k.slice(5, 7);
      return '<div class="bar-row"><span class="lab">' + lab + "</span>" +
        bar(Math.round(d.total / maxDia * 100), "var(--brand)") +
        '<span class="val">' + d.ok + "/" + d.total + " · " + p + "%</span></div>";
    }).join("");
    var evoPanel = panel("Evolução (últimos dias)", "Questões respondidas e acertos por dia", evoRows);

    // revisar
    var revHtml;
    if (!erros.length) {
      revHtml = "<p class='sub'>Nenhum erro pendente — mandou bem! 🎯</p>";
    } else {
      var qById = {}; if (window.ENEM_DATA) window.ENEM_DATA.questoes.forEach(function (q) { qById[q.codigo] = q; });
      revHtml = '<div class="revlist">' + erros.map(function (e) {
        var q = qById[e.id] || {};
        return '<a class="revitem" href="questao.html?q=' + (q.numero || "") + '">' +
          '<span><span class="code">' + e.id + "</span> · H" + (e.hab || "?") + " · " + (q.aplicacao || "") + "</span>" +
          '<span class="tier t5"><span class="dot"></span>errei</span></a>';
      }).join("") + "</div>" +
      '<div style="margin-top:1rem"><a class="btn" href="estudar.html#revisar" style="background:var(--brand);color:#fff;border-color:var(--brand)">Revisar meus erros no modo Estudar</a></div>';
    }
    var revPanel = panel("Para revisar (" + erros.length + ")", "Itens que você errou e ainda não acertou depois", revHtml);

    root.innerHTML = kpis +
      '<section class="panels">' + tierPanel + evoPanel + "</section>" +
      '<section class="panels" style="margin-top:1.25rem">' + habPanel + revPanel + "</section>";
  }

  function calcStreak(diasKeys) {
    if (!diasKeys.length) return 0;
    var set = {}; diasKeys.forEach(function (d) { set[d] = 1; });
    var streak = 0, cur = new Date();
    for (;;) {
      var key = cur.toISOString().slice(0, 10);
      if (set[key]) { streak++; cur.setDate(cur.getDate() - 1); }
      else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) { cur.setDate(cur.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function kpi(n, l) { return '<div class="kpi"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
  function panel(title, sub, body) {
    return '<div class="panel"><h3>' + title + '</h3><p class="sub">' + sub + "</p>" + body + "</div>";
  }

  function wireActions() {
    document.getElementById("btn-logout").addEventListener("click", function () { window.Auth.logout(); });
    document.getElementById("btn-clear").addEventListener("click", function () { if (Tracker.clear()) render(); });
    document.getElementById("btn-export").addEventListener("click", function () {
      var blob = new Blob([Tracker.export()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "meu-progresso-cn-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
    });
    var fileEl = document.getElementById("file-import");
    document.getElementById("btn-import").addEventListener("click", function () { fileEl.click(); });
    fileEl.addEventListener("change", function () {
      var f = fileEl.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { alert(Tracker.import(r.result) ? "Progresso importado!" : "Arquivo inválido."); render(); };
      r.readAsText(f);
    });
  }
})();
