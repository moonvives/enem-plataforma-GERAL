/* Mapa de Itens (TRI): posiciona itens oficiais do ENEM na escala de
   proficiência (b_enem = 500 + 100·b) a partir dos microdados do INEP. */
(function () {
  "use strict";
  document.addEventListener("enem:unlocked", init, { once: true });

  var MIN = 350, MAX = 850; // limites visuais da escala

  function init() {
    var M = window.ENEM_MICRO;
    if (!M) return;
    var itens = (M.itens || []).filter(function (x) {
      return x.area === "CN" && !x.abandonado && x.b_enem != null &&
        x.ano >= 2010 && x.b_enem >= 320 && x.b_enem <= 900;
    });

    // enunciados do eBook (quando houver) para enriquecer o card
    var textoPorHab = {};
    if (window.ENEM_DATA) {
      window.ENEM_DATA.questoes.forEach(function (q) {
        if (q.enunciado && !textoPorHab[q.habilidade]) textoPorHab[q.habilidade] = null;
      });
    }

    var anoSel = document.getElementById("m-ano");
    var anos = Array.prototype.slice.call(new Set(itens.map(function (x) { return x.ano; }))).sort();
    // Set não é iterável direto em alguns ambientes antigos; garantir array único:
    anos = itens.map(function (x) { return x.ano; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    var opTodos = document.createElement("option"); opTodos.value = ""; opTodos.textContent = "Todos os anos"; anoSel.appendChild(opTodos);
    anos.forEach(function (a) { var o = document.createElement("option"); o.value = a; o.textContent = a; anoSel.appendChild(o); });
    anoSel.value = anos.indexOf(2023) >= 0 ? "2023" : String(anos[anos.length - 1]);

    var habSel = document.getElementById("m-hab");
    for (var h = 1; h <= 30; h++) { var o = document.createElement("option"); o.value = h; o.textContent = "H" + h; habSel.appendChild(o); }

    // barra em gradiente por faixas (régua TRI)
    function pos(b) { return Math.max(0, Math.min(100, (b - MIN) / (MAX - MIN) * 100)); }
    var stops = [
      ["var(--t1)", 0, pos(560)], ["var(--t2)", pos(560), pos(620)],
      ["var(--t3)", pos(620), pos(680)], ["var(--t4)", pos(680), pos(740)],
      ["var(--t5)", pos(740), 100]
    ];
    var grad = "linear-gradient(90deg," + stops.map(function (s) {
      return s[0] + " " + s[1] + "%," + s[0] + " " + s[2] + "%";
    }).join(",") + ")";
    document.getElementById("bar").style.background = grad;

    // ticks
    document.getElementById("ticks").innerHTML = [350, 560, 620, 680, 740, 850].map(function (t) {
      return '<span style="left:' + pos(t) + '%">' + t + "</span>";
    }).join("");

    // legenda
    document.getElementById("legend").innerHTML = (M.meta.regua || []).map(function (r) {
      return '<span class="tier t' + r.nivel + '"><span class="lvl l' + r.nivel + '">' + r.nivel + "</span>" + r.rotulo + "</span>";
    }).join("");

    var scale = document.getElementById("scale");
    var list = document.getElementById("itemlist");
    var card = document.getElementById("itemcard");
    var countEl = document.getElementById("m-count");

    function filtered() {
      return itens.filter(function (x) {
        if (anoSel.value && x.ano !== +anoSel.value) return false;
        if (habSel.value && x.habilidade !== +habSel.value) return false;
        return true;
      }).sort(function (a, b) { return a.b_enem - b.b_enem; });
    }

    function tierChip(x) {
      return '<span class="tier t' + x.tier.nivel + '"><span class="lvl l' + x.tier.nivel + '">' + x.tier.nivel + "</span>" + x.tier.rotulo + "</span>";
    }

    function selecionar(id) {
      var x = itens.find(function (i) { return i.co_item === id; });
      if (!x) return;
      Array.prototype.forEach.call(document.querySelectorAll(".scale .dot"), function (d) { d.classList.toggle("sel", +d.dataset.id === id); });
      Array.prototype.forEach.call(document.querySelectorAll(".il li"), function (li) { li.classList.toggle("sel", +li.dataset.id === id); });
      card.className = "itemcard on";
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">' +
          "<h3 style='margin:0'>Item " + x.co_item + " · ENEM " + x.ano + "</h3>" + tierChip(x) + "</div>" +
        '<ul class="meta-list" style="margin-top:.75rem">' +
          li2("Dificuldade (escala ENEM)", x.b_enem.toFixed(1).replace(".", ",")) +
          li2("Habilidade", x.habilidade ? "H" + x.habilidade : "—") +
          li2("Gabarito", x.gabarito || "—") +
          li2("Discriminação (a)", (x.a != null ? x.a.toFixed(2) : "—")) +
          li2("Parâmetro b (padrão)", (x.b != null ? x.b.toFixed(3).replace(".", ",") : "—")) +
          li2("Acerto ao acaso (c)", (x.c != null ? x.c.toFixed(2).replace(".", ",") : "—")) +
        "</ul>";
    }
    function li2(k, v) { return '<li><span class="k">' + k + '</span><span class="v">' + v + "</span></li>"; }

    function render() {
      var arr = filtered();
      countEl.innerHTML = "<b>" + arr.length + "</b> itens" + (anoSel.value ? " em " + anoSel.value : " (todos os anos)");
      // dots
      Array.prototype.forEach.call(document.querySelectorAll(".scale .dot"), function (d) { d.remove(); });
      arr.forEach(function (x, i) {
        var d = document.createElement("div");
        d.className = "dot";
        d.dataset.id = x.co_item;
        d.style.left = pos(x.b_enem) + "%";
        // jitter vertical determinístico para reduzir sobreposição
        var lane = i % 6;
        d.style.top = (18 + lane * 14) + "px";
        d.style.background = "var(--t" + x.tier.nivel + ")";
        d.title = "ENEM " + x.ano + " · " + x.b_enem.toFixed(0) + (x.habilidade ? " · H" + x.habilidade : "");
        d.addEventListener("click", function () { selecionar(x.co_item); });
        scale.appendChild(d);
      });
      // list
      list.innerHTML = arr.map(function (x) {
        return '<li data-id="' + x.co_item + '">' +
          '<span class="bpos">' + x.b_enem.toFixed(0) + "</span>" +
          '<span class="gab">' + (x.gabarito || "?") + "</span>" +
          tierChip(x) +
          '<span class="muted">ENEM ' + x.ano + (x.habilidade ? " · H" + x.habilidade : "") + " · item " + x.co_item + "</span>" +
          "</li>";
      }).join("");
      Array.prototype.forEach.call(list.querySelectorAll("li"), function (li) {
        li.addEventListener("click", function () { selecionar(+li.dataset.id); });
      });
      card.className = "itemcard";
    }

    anoSel.addEventListener("change", render);
    habSel.addEventListener("change", render);
    render();
  }
})();
