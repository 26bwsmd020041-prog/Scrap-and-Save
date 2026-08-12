(function () {
  "use strict";

  var STORAGE_KEY = "scrapAndSave.entries";
  var GOAL_KEY = "scrapAndSave.goal";

  // Rough estimated retail value per kg, by category (USD). Used only to
  // give a sense of scale — not a precise accounting figure.
  var VALUE_PER_KG = {
    "Fruits & Veg": 2.5,
    "Dairy": 4.0,
    "Meat & Fish": 9.0,
    "Bread & Grains": 3.0,
    "Leftovers": 5.0,
    "Other": 3.0
  };

  var CATEGORY_COLORS = {
    "Fruits & Veg": "#4c6b3f",
    "Dairy": "#d9a441",
    "Meat & Fish": "#a8481a",
    "Bread & Grains": "#8a6d3b",
    "Leftovers": "#6b8f5e",
    "Other": "#7a7a68"
  };

  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) { /* storage unavailable — app still works this session */ }
  }

  function loadGoal() {
    var raw = localStorage.getItem(GOAL_KEY);
    var n = parseFloat(raw);
    return isNaN(n) || n <= 0 ? 10 : n;
  }

  function saveGoal(n) {
    try { localStorage.setItem(GOAL_KEY, String(n)); } catch (e) {}
  }

  function isThisMonth(iso) {
    var d = new Date(iso);
    var now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function fmtMoney(n) {
    return "$" + n.toFixed(n >= 100 ? 0 : 2);
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  var entries = loadEntries();
  var goal = loadGoal();

  // ---------- Rendering ----------

  function monthEntries() {
    return entries.filter(function (e) { return isThisMonth(e.date); });
  }

  function renderStats() {
    var monthly = monthEntries();
    var totalKg = monthly.reduce(function (s, e) { return s + e.weight; }, 0);
    var totalValue = monthly.reduce(function (s, e) {
      return s + e.weight * (VALUE_PER_KG[e.category] || 3);
    }, 0);

    var byCategory = {};
    monthly.forEach(function (e) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.weight;
    });
    var topCategory = "—";
    var topAmount = 0;
    Object.keys(byCategory).forEach(function (cat) {
      if (byCategory[cat] > topAmount) { topAmount = byCategory[cat]; topCategory = cat; }
    });

    var totalKgEl = document.getElementById("statTotalKg");
    var valueEl = document.getElementById("statValue");
    var entriesEl = document.getElementById("statEntries");
    var topEl = document.getElementById("statTop");
    if (!totalKgEl) return;

    totalKgEl.textContent = totalKg.toFixed(1);
    valueEl.textContent = fmtMoney(totalValue);
    entriesEl.textContent = String(monthly.length);
    topEl.textContent = topCategory;

    return { totalKg: totalKg, byCategory: byCategory };
  }

  function renderJar(totalKg) {
    var fill = document.getElementById("jarFill");
    var percentEl = document.getElementById("jarPercent");
    if (!fill) return;

    var pct = Math.max(0, Math.min(1, totalKg / goal));
    var maxHeight = 188; // matches jar interior height in the SVG
    var fillHeight = maxHeight * pct;
    var y = 228 - fillHeight;

    fill.setAttribute("height", String(fillHeight));
    fill.setAttribute("y", String(y));

    var color = "#4c6b3f";
    if (pct > 0.9) color = "#a8481a";
    else if (pct > 0.65) color = "#d9a441";
    fill.setAttribute("fill", color);

    percentEl.textContent = Math.round(pct * 100) + "%";
  }

  function renderChart(byCategory) {
    var canvas = document.getElementById("categoryChart");
    var emptyMsg = document.getElementById("chartEmpty");
    if (!canvas) return;

    var categories = Object.keys(byCategory).sort(function (a, b) {
      return byCategory[b] - byCategory[a];
    });

    if (categories.length === 0) {
      canvas.style.display = "none";
      if (emptyMsg) emptyMsg.style.display = "block";
      return;
    }
    canvas.style.display = "block";
    if (emptyMsg) emptyMsg.style.display = "none";

    var dpr = window.devicePixelRatio || 1;
    var cssWidth = canvas.parentElement.clientWidth - 48; // minus panel padding
    var cssHeight = Math.max(160, categories.length * 46 + 20);
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    var max = Math.max.apply(null, categories.map(function (c) { return byCategory[c]; }));
    var labelWidth = 120;
    var barAreaWidth = cssWidth - labelWidth - 60;
    var rowHeight = 46;

    ctx.font = "500 13px 'Work Sans', sans-serif";
    ctx.textBaseline = "middle";

    categories.forEach(function (cat, i) {
      var y = i * rowHeight + rowHeight / 2;
      var value = byCategory[cat];
      var barWidth = Math.max(4, (value / max) * barAreaWidth);

      ctx.fillStyle = "#22301a";
      ctx.textAlign = "right";
      ctx.fillText(cat, labelWidth - 12, y);

      ctx.fillStyle = CATEGORY_COLORS[cat] || "#7a7a68";
      var barHeight = 20;
      roundRect(ctx, labelWidth, y - barHeight / 2, barWidth, barHeight, 3);
      ctx.fill();

      ctx.fillStyle = "#22301a";
      ctx.textAlign = "left";
      ctx.font = "600 12px 'Space Mono', monospace";
      ctx.fillText(value.toFixed(1) + " kg", labelWidth + barWidth + 10, y);
      ctx.font = "500 13px 'Work Sans', sans-serif";
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderLedger() {
    var body = document.getElementById("ledgerBody");
    var emptyMsg = document.getElementById("ledgerEmpty");
    if (!body) return;

    var sorted = entries.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    body.innerHTML = "";
    if (sorted.length === 0) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    sorted.forEach(function (e) {
      var tr = document.createElement("tr");

      var tdDate = document.createElement("td");
      tdDate.textContent = fmtDate(e.date);

      var tdItem = document.createElement("td");
      tdItem.textContent = e.item;

      var tdCat = document.createElement("td");
      var pill = document.createElement("span");
      pill.className = "cat-pill";
      pill.textContent = e.category;
      tdCat.appendChild(pill);

      var tdWeight = document.createElement("td");
      tdWeight.textContent = e.weight.toFixed(2) + " kg";

      var tdReason = document.createElement("td");
      tdReason.textContent = e.reason;

      var tdDel = document.createElement("td");
      var delBtn = document.createElement("button");
      delBtn.className = "row-delete";
      delBtn.setAttribute("aria-label", "Delete entry");
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", function () { deleteEntry(e.id); });
      tdDel.appendChild(delBtn);

      tr.appendChild(tdDate);
      tr.appendChild(tdItem);
      tr.appendChild(tdCat);
      tr.appendChild(tdWeight);
      tr.appendChild(tdReason);
      tr.appendChild(tdDel);
      body.appendChild(tr);
    });
  }

  function renderAll() {
    var stats = renderStats();
    if (!stats) return; // not on the tracker page
    renderJar(stats.totalKg);
    renderChart(stats.byCategory);
    renderLedger();
  }

  function deleteEntry(id) {
    entries = entries.filter(function (e) { return e.id !== id; });
    saveEntries(entries);
    renderAll();
  }

  // ---------- Events ----------

  var form = document.getElementById("wasteForm");
  if (form) {
    form.addEventListener("submit", function (evt) {
      evt.preventDefault();
      var item = document.getElementById("itemName").value.trim();
      var category = document.getElementById("category").value;
      var weight = parseFloat(document.getElementById("weight").value);
      var reason = document.getElementById("reason").value;

      if (!item || !weight || weight <= 0) return;

      entries.push({
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        item: item,
        category: category,
        weight: weight,
        reason: reason,
        date: new Date().toISOString()
      });
      saveEntries(entries);
      form.reset();
      renderAll();
    });
  }

  var goalInput = document.getElementById("goalInput");
  if (goalInput) {
    goalInput.value = goal;
    goalInput.addEventListener("change", function () {
      var n = parseFloat(goalInput.value);
      if (isNaN(n) || n <= 0) return;
      goal = n;
      saveGoal(goal);
      renderAll();
    });
  }

  var clearBtn = document.getElementById("clearAll");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (entries.length === 0) return;
      if (!window.confirm("Clear every logged entry? This can't be undone.")) return;
      entries = [];
      saveEntries(entries);
      renderAll();
    });
  }

  window.addEventListener("resize", function () {
    var stats = renderStats();
    if (stats) renderChart(stats.byCategory);
    renderWorldChart();
  });

  // ---------- World page ----------

  // Source: UNEP & WRAP, Food Waste Index Report 2024 (2022 data).
  // Global total: 1.05 billion tonnes/year. Rate below is that annual
  // figure spread evenly across the year for illustration — not a live feed.
  var WORLD_KG_PER_YEAR = 1.05e12;
  var WORLD_KG_PER_MS = WORLD_KG_PER_YEAR / (365 * 24 * 3600 * 1000);

  var WORLD_SECTORS = [
    { label: "Households", tonnes: 631, color: "#a8481a" },
    { label: "Food service", tonnes: 290, color: "#d9a441" },
    { label: "Retail", tonnes: 131, color: "#4c6b3f" }
  ];

  function initWorldCounter() {
    var el = document.getElementById("worldCounter");
    if (!el) return;
    var start = Date.now();
    function tick() {
      var elapsedMs = Date.now() - start;
      var kg = elapsedMs * WORLD_KG_PER_MS;
      el.textContent = Math.round(kg).toLocaleString();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderWorldChart() {
    var canvas = document.getElementById("worldChart");
    if (!canvas) return;

    var dpr = window.devicePixelRatio || 1;
    var cssWidth = canvas.parentElement.clientWidth - 48;
    var rowHeight = 50;
    var cssHeight = WORLD_SECTORS.length * rowHeight + 20;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    var max = Math.max.apply(null, WORLD_SECTORS.map(function (s) { return s.tonnes; }));
    var labelWidth = 130;
    var barAreaWidth = cssWidth - labelWidth - 90;

    ctx.textBaseline = "middle";

    WORLD_SECTORS.forEach(function (sector, i) {
      var y = i * rowHeight + rowHeight / 2 + 10;
      var barWidth = Math.max(4, (sector.tonnes / max) * barAreaWidth);

      ctx.fillStyle = "#22301a";
      ctx.font = "500 13px 'Work Sans', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(sector.label, labelWidth - 12, y);

      ctx.fillStyle = sector.color;
      roundRect(ctx, labelWidth, y - 12, barWidth, 24, 3);
      ctx.fill();

      ctx.fillStyle = "#22301a";
      ctx.font = "600 12px 'Space Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(sector.tonnes + "M t", labelWidth + barWidth + 10, y);
    });
  }

  renderAll();
  initWorldCounter();
  renderWorldChart();
})();
