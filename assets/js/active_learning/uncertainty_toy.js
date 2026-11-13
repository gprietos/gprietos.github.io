/* Interactive uncertainty sampler toy (_includes/active_learning/uncertainty_toy.html). Builds the widget inside
   every .ust[data-ust="toy"] element; all toys on a page share one state. Styles: assets/css/active_learning/uncertainty_toy.css. */
(function () {
  if (window.__ustToy) return;
  window.__ustToy = true;
  const DEF = {alpha: 0.3, beta: 0.2, k: 10, uc: 0.25, keep: 3,
    classes: {car: {n: 400, ap: 0.80}, pedestrian: {n: 60, ap: 0.55}, cyclist: {n: 8, ap: 0.40}}};
  const clone = o => JSON.parse(JSON.stringify(o));
  const S = clone(DEF);
  const CLS = Object.keys(DEF.classes);
  // Example images: boxes in relative coords (x, y, w, h), p = confidence of the box
  const IMAGES = [
    {id: "A", note: "Street, one doubtful pedestrian", boxes: [
      {c: "car", p: 0.92, x: .05, y: .50, w: .30, h: .30}, {c: "car", p: 0.88, x: .55, y: .52, w: .28, h: .26},
      {c: "pedestrian", p: 0.45, x: .40, y: .24, w: .08, h: .42}, {c: "car", p: 0.12, x: .86, y: .58, w: .12, h: .14}]},
    {id: "B", note: "Half-seen cyclist", boxes: [
      {c: "cyclist", p: 0.55, x: .20, y: .28, w: .16, h: .46}, {c: "car", p: 0.97, x: .52, y: .44, w: .40, h: .36}]},
    {id: "C", note: "Parking lot, all obvious", boxes: [
      {c: "car", p: 0.95, x: .03, y: .50, w: .21, h: .22}, {c: "car", p: 0.96, x: .27, y: .52, w: .21, h: .22},
      {c: "car", p: 0.93, x: .51, y: .50, w: .21, h: .22}, {c: "car", p: 0.91, x: .75, y: .52, w: .21, h: .22}]},
    {id: "D", note: "Crowded crossing", boxes: [
      {c: "pedestrian", p: 0.40, x: .04, y: .20, w: .07, h: .40}, {c: "pedestrian", p: 0.60, x: .14, y: .22, w: .07, h: .40},
      {c: "pedestrian", p: 0.33, x: .25, y: .24, w: .06, h: .38}, {c: "pedestrian", p: 0.88, x: .35, y: .20, w: .07, h: .42},
      {c: "cyclist", p: 0.70, x: .45, y: .24, w: .12, h: .40}, {c: "car", p: 0.94, x: .60, y: .46, w: .20, h: .28},
      {c: "car", p: 0.91, x: .80, y: .50, w: .18, h: .26}, {c: "car", p: 0.85, x: .64, y: .76, w: .24, h: .20}]},
    {id: "E", note: "Two pedestrians at night", boxes: [
      {c: "pedestrian", p: 0.30, x: .30, y: .28, w: .09, h: .45}, {c: "pedestrian", p: 0.35, x: .55, y: .30, w: .09, h: .42}]},
    {id: "F", note: "Faint cyclist (a miss?)", boxes: [
      {c: "cyclist", p: 0.22, x: .28, y: .30, w: .14, h: .40}, {c: "car", p: 0.96, x: .58, y: .46, w: .34, h: .34}]},
    {id: "G", note: "No predictions", boxes: []},
    {id: "H", note: "Cars at the band edge", boxes: [
      {c: "car", p: 0.74, x: .08, y: .48, w: .32, h: .30}, {c: "car", p: 0.77, x: .56, y: .50, w: .30, h: .28}]},
  ];
  const EPS = 1e-6;
  const fx = (v, n = 3) => Number(v).toFixed(n);
  const col = c => "var(--ust-" + c + ")";
  // --- the sampler's maths ---
  function difficulty(c) {
    const {n, ap} = S.classes[c];
    if (n <= 0) return S.k > 0 ? 1 : null; // no val boxes: hard (d = 1), or w = 1 when k = 0
    return (n * (1 - ap) + S.k) / (n + S.k);
  }
  function weight(d) {
    if (d === null) return 1;
    const g = Math.exp(1 / S.alpha) - 1;
    return 1 + S.alpha * S.beta * Math.log(1 + g * d);
  }
  function H(p) { p = Math.min(Math.max(p, EPS), 1 - EPS); return -p * Math.log(p) - (1 - p) * Math.log(1 - p); }
  const tau = () => H(S.uc);
  const counts = p => H(p) >= tau() - 1e-12; // same as uc ≤ p ≤ 1 − uc
  function scoreImage(img) {
    const rows = img.boxes.map(b => {
      const w = weight(difficulty(b.c)), h = H(b.p);
      return Object.assign({}, b, {on: counts(b.p), w: w, h: h, wh: w * h});
    });
    return {rows: rows, U: rows.filter(r => r.on).reduce((s, r) => s + r.wh, 0)};
  }
  // --- SVG helpers ---
  function axes(o) {
    const W = 400, Hh = 240, L = 44, R = 12, T = 10, B = 36;
    const sx = x => L + (x - o.xmin) / (o.xmax - o.xmin) * (W - L - R);
    const sy = y => T + (1 - (y - o.ymin) / (o.ymax - o.ymin)) * (Hh - T - B);
    let s = "";
    o.yticks.forEach(t => { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(t) + '" y2="' + sy(t) + '" style="stroke:var(--ust-line);stroke-dasharray:2 4"/><text x="' + (L - 6) + '" y="' + (sy(t) + 4) + '" text-anchor="end">' + t + '</text>'; });
    o.xticks.forEach(t => { s += '<text x="' + sx(t) + '" y="' + (Hh - B + 16) + '" text-anchor="middle">' + t + '</text>'; });
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (Hh - B) + '" y2="' + (Hh - B) + '" style="stroke:var(--ust-line)"/><line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (Hh - B) + '" style="stroke:var(--ust-line)"/>';
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (Hh - 3) + '" text-anchor="middle">' + o.xlabel + '</text>';
    s += '<text x="11" y="' + ((T + Hh - B) / 2) + '" text-anchor="middle" transform="rotate(-90 11 ' + ((T + Hh - B) / 2) + ')">' + o.ylabel + '</text>';
    return {s: s, sx: sx, sy: sy, W: W, Hh: Hh, L: L, R: R, T: T, B: B};
  }
  function curve(f, sx, sy, a, b) {
    let d = "";
    for (let i = 0; i <= 160; i++) { const x = a + (b - a) * i / 160; d += (i ? "L" : "M") + sx(x).toFixed(1) + " " + sy(f(x)).toFixed(1); }
    return d;
  }
  const chip = (c, on, label) => '<span class="ust-chip"><span class="ust-dot" style="background:' + (on === false ? "var(--ust-off)" : col(c)) + '"></span>' + (label || c) + '</span>';
  // --- figures ---
  function renderWeight(svg) {
    const top = Math.max(1.25, 1 + S.beta + 0.05);
    const step = top - 1 > 0.5 ? 0.25 : top - 1 > 0.3 ? 0.1 : 0.05;
    const yt = []; for (let v = 1; v <= top + 1e-9; v += step) yt.push(+v.toFixed(2));
    const P = axes({xmin: 0, xmax: 1, ymin: 0.98, ymax: top, xticks: [0, 0.5, 1], yticks: yt, xlabel: "class difficulty d", ylabel: "weight w"});
    let s = P.s;
    s += '<line x1="' + P.L + '" x2="' + (P.W - P.R) + '" y1="' + P.sy(1 + S.beta) + '" y2="' + P.sy(1 + S.beta) + '" style="stroke:var(--ust-hot);stroke-dasharray:5 4"/>';
    s += '<text x="' + (P.L + 6) + '" y="' + (P.sy(1 + S.beta) - 6) + '" style="fill:var(--ust-hot)">1 + β = ' + fx(1 + S.beta, 2) + '</text>';
    s += '<path d="' + curve(weight, P.sx, P.sy, 0, 1) + '" style="fill:none;stroke:var(--ust-accent);stroke-width:2.2"/>';
    CLS.forEach(c => {
      const d = difficulty(c); if (d === null) return;
      const w = weight(d);
      s += '<circle cx="' + P.sx(d) + '" cy="' + P.sy(w) + '" r="5.5" style="fill:' + col(c) + ';stroke:var(--ust-card);stroke-width:1.5"/>';
      s += '<text x="' + (P.sx(d) + (d > 0.8 ? -6 : 6)) + '" y="' + (P.sy(w) + 18) + '" text-anchor="' + (d > 0.8 ? "end" : "start") + '" style="fill:' + col(c) + '">' + c + '</text>';
    });
    svg.innerHTML = s;
  }
  function renderEntropy(svg) {
    const P = axes({xmin: 0, xmax: 1, ymin: 0, ymax: 1, xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 0.25, 0.5, 0.75, 1], xlabel: "box confidence p", ylabel: "entropy H(p)"});
    const t = tau(), x1 = P.sx(S.uc), x2 = P.sx(1 - S.uc), y0 = P.T, ph = P.Hh - P.T - P.B;
    let s = '<rect x="' + P.L + '" y="' + y0 + '" width="' + (x1 - P.L) + '" height="' + ph + '" style="fill:var(--ust-off);opacity:.2"/>' +
      '<rect x="' + x2 + '" y="' + y0 + '" width="' + (P.W - P.R - x2) + '" height="' + ph + '" style="fill:var(--ust-off);opacity:.2"/>' +
      '<rect x="' + x1 + '" y="' + y0 + '" width="' + (x2 - x1) + '" height="' + ph + '" style="fill:var(--ust-hot-soft);opacity:.7"/>';
    s += P.s;
    [x1, x2].forEach(x => { s += '<line x1="' + x + '" x2="' + x + '" y1="' + y0 + '" y2="' + (P.Hh - P.B) + '" style="stroke:var(--ust-hot);stroke-dasharray:4 4"/>'; });
    s += '<line x1="' + P.L + '" x2="' + (P.W - P.R) + '" y1="' + P.sy(t) + '" y2="' + P.sy(t) + '" style="stroke:var(--ust-hot);stroke-dasharray:5 4"/>';
    s += '<path d="' + curve(H, P.sx, P.sy, 0.0005, 0.9995) + '" style="fill:none;stroke:var(--ust-accent);stroke-width:2.2"/>';
    IMAGES.forEach(img => img.boxes.forEach(b => {
      const on = counts(b.p);
      s += '<circle cx="' + P.sx(b.p) + '" cy="' + P.sy(H(b.p)) + '" r="4.5" style="fill:' + (on ? col(b.c) : "var(--ust-card)") + ';stroke:' + col(b.c) + ';stroke-width:1.5"/>';
    }));
    s += '<circle cx="' + x1 + '" cy="' + P.sy(t) + '" r="4.5" style="fill:var(--ust-hot)"/><circle cx="' + x2 + '" cy="' + P.sy(t) + '" r="4.5" style="fill:var(--ust-hot)"/>';
    // Threshold readout above the curve's peak (ln 2 ≈ 0.69 leaves the top of the plot empty)
    const cx = (P.L + P.W - P.R) / 2;
    s += '<text x="' + cx + '" y="' + (P.T + 16) + '" text-anchor="middle" style="fill:var(--ust-hot);font-weight:600">uncertainty_conf = ' + fx(S.uc, 2) + '</text>';
    s += '<text x="' + cx + '" y="' + (P.T + 32) + '" text-anchor="middle" style="fill:var(--ust-hot);font-weight:600">H(' + fx(S.uc, 2) + ') = ' + fx(t) + '</text>';
    svg.innerHTML = s;
  }
  function thumb(img) {
    const W = 200, Hh = 110;
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" aria-hidden="true"><rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (Hh - 1) + '" rx="3" style="fill:var(--ust-sunk);stroke:var(--ust-line)"/>';
    s += '<line x1="0" x2="' + W + '" y1="' + (Hh * 0.62) + '" y2="' + (Hh * 0.62) + '" style="stroke:var(--ust-line)"/>';
    if (!img.boxes.length) s += '<text x="' + (W / 2) + '" y="' + (Hh / 2 + 4) + '" text-anchor="middle">no boxes</text>';
    img.boxes.forEach(b => {
      const on = counts(b.p), x = b.x * W, y = b.y * Hh, w = b.w * W, h = b.h * Hh, c = on ? col(b.c) : "var(--ust-off)";
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" style="fill:none;stroke:' + c + ';stroke-width:' + (on ? 2.4 : 1.2) + ';' + (on ? "" : "stroke-dasharray:3 3") + '"/>';
      s += '<text x="' + (x + 1) + '" y="' + Math.max(11, y - 3) + '" style="font-size:11px;fill:' + c + (on ? ";font-weight:600" : "") + '">' + b.p.toFixed(2).slice(1) + '</text>';
    });
    return s + '</svg>';
  }
  const openDetails = new Set();
  function renderImages(el) {
    const scored = IMAGES.map(img => ({img: img, r: scoreImage(img)}));
    const sorted = scored.slice().sort((a, b) => b.r.U - a.r.U);
    sorted.forEach((o, i) => { o.rank = (i > 0 && Math.abs(o.r.U - sorted[i - 1].r.U) < 1e-12) ? sorted[i - 1].rank : i + 1; });
    const kept = new Set(sorted.slice(0, S.keep).map(o => o.img.id));
    el.innerHTML = scored.map(o => {
      const img = o.img, r = o.r;
      let t = '<tr><th>box</th><th>p</th><th>H</th><th>w·H</th></tr>';
      r.rows.forEach(b => {
        t += '<tr class="' + (b.on ? "" : "ust-offrow") + '"><td>' + chip(b.c, b.on, b.c.slice(0, 3)) + '</td><td>' + fx(b.p, 2) + '</td><td>' + fx(b.h) + '</td><td>' + (b.on ? fx(b.wh) : "–") + '</td></tr>';
      });
      const det = img.boxes.length ? '<details data-ust-img="' + img.id + '"' + (openDetails.has(img.id) ? " open" : "") + '><summary>' + r.rows.filter(b => b.on).length + ' of ' + r.rows.length + ' boxes count</summary><div class="ust-tw"><table>' + t + '</table></div></details>' : '<details><summary>no boxes</summary></details>';
      return '<div class="ust-card' + (kept.has(img.id) ? " ust-top" : "") + '">' + thumb(img) +
        '<div class="ust-card-h"><b>' + img.id + '</b><span>U ' + fx(r.U) + '</span><span class="ust-rankb">#' + o.rank + '</span></div>' +
        '<div class="ust-note">' + img.note + '</div>' + det + '</div>';
    }).join("");
  }
  // --- layout and controls ---
  const LABELS = {alpha: "α (shape)", beta: "β (ceiling)", k: "k (prior)", uc: "uncertainty_conf", keep: "keep top"};
  const RANGES = {alpha: [0.05, 1, 0.05], beta: [0.05, 1, 0.05], k: [0, 60, 1], uc: [0.05, 0.45, 0.01], keep: [1, IMAGES.length, 1]};
  const TIPS = {alpha: "Smaller: the weight rises faster for easy classes", beta: "The hardest class weighs 1 + β",
    k: "Imaginary missed boxes added to each class", uc: "Boxes from uc to 1 − uc count", keep: "Images kept from the examples"};
  const fmtKey = (k, v) => (k === "k" || k === "keep") ? String(v) : Number(v).toFixed(2);
  function slider(key) {
    const r = RANGES[key];
    return '<div class="ust-ctl" title="' + TIPS[key] + '"><label for="ust-' + key + '"><span>' + LABELS[key] + '</span><output data-ust-out="' + key + '"></output></label>' +
      '<input type="range" id="ust-' + key + '" data-ust-key="' + key + '" min="' + r[0] + '" max="' + r[1] + '" step="' + r[2] + '"></div>';
  }
  function build(root) {
    let tbl = '<div class="ust-tw"><table><thead><tr><th>class</th><th>val boxes n</th><th>AP</th><th>d</th><th>w</th></tr></thead><tbody>';
    CLS.forEach(c => {
      tbl += '<tr><td>' + chip(c) + '</td>' +
        '<td><input type="number" id="ust-' + c + '-n" aria-label="' + c + ' val boxes" data-ust-cls="' + c + '" data-ust-field="n" min="0" max="5000" step="1"></td>' +
        '<td class="ust-ap"><div><input type="range" id="ust-' + c + '-ap" aria-label="' + c + ' AP" data-ust-cls="' + c + '" data-ust-field="ap" min="0" max="1" step="0.01"><output class="ust-out" data-ust-clsout="' + c + ':ap"></output></div></td>' +
        '<td data-ust-cell="' + c + ':d"></td><td data-ust-cell="' + c + ':w"></td></tr>';
    });
    tbl += '</tbody></table></div>';
    root.innerHTML = '<div class="ust-grid">' +
      '<div class="ust-panel"><div class="ust-head"><span class="ust-eyebrow">Class difficulty</span></div>' + tbl + '</div>' +
      '<div class="ust-panel"><div class="ust-head"><span class="ust-eyebrow">Settings</span><button type="button" class="ust-reset" data-ust-reset>Reset</button></div>' +
        '<div class="ust-ctls">' + ["alpha", "beta", "k", "uc", "keep"].map(slider).join("") + '</div></div>' +
      '<div class="ust-panel"><div class="ust-head"><span class="ust-eyebrow">Class weight w(d)</span></div><svg viewBox="0 0 400 240" role="img" aria-label="Class weight as a function of difficulty" data-ust-w></svg></div>' +
      '<div class="ust-panel"><div class="ust-head"><span class="ust-eyebrow">Box entropy H(p)</span></div><svg viewBox="0 0 400 240" role="img" aria-label="Binary entropy curve with the uncertainty band" data-ust-h></svg></div>' +
      '<div class="ust-panel ust-wide"><div class="ust-head"><span class="ust-eyebrow">Image score U</span><span class="ust-rankb" style="font-family:var(--ust-mono);font-size:11.5px">top ' + '<span data-ust-out="keep"></span> kept</span></div><div class="ust-imgs" data-ust-imgs></div></div>' +
      '</div>';
  }
  const roots = [];
  function syncInputs(except) {
    document.querySelectorAll(".ust input[data-ust-key]").forEach(i => { if (i !== except) i.value = S[i.getAttribute("data-ust-key")]; });
    document.querySelectorAll(".ust [data-ust-out]").forEach(o => { const k = o.getAttribute("data-ust-out"); o.textContent = fmtKey(k, S[k]); });
    document.querySelectorAll(".ust input[data-ust-cls]").forEach(i => { if (i !== except) i.value = S.classes[i.getAttribute("data-ust-cls")][i.getAttribute("data-ust-field")]; });
    document.querySelectorAll(".ust [data-ust-clsout]").forEach(o => { const a = o.getAttribute("data-ust-clsout").split(":"); o.textContent = fx(S.classes[a[0]][a[1]], 2); });
  }
  function renderAll() {
    roots.forEach(root => {
      CLS.forEach(c => {
        const d = difficulty(c);
        root.querySelector('[data-ust-cell="' + c + ':d"]').textContent = d === null ? "–" : fx(d);
        root.querySelector('[data-ust-cell="' + c + ':w"]').textContent = fx(weight(d));
      });
      renderWeight(root.querySelector("[data-ust-w]"));
      renderEntropy(root.querySelector("[data-ust-h]"));
      renderImages(root.querySelector("[data-ust-imgs]"));
    });
  }
  function onInput(e) {
    const i = e.target;
    if (!i.closest || !i.closest(".ust")) return;
    if (i.hasAttribute("data-ust-key")) S[i.getAttribute("data-ust-key")] = +i.value;
    else if (i.hasAttribute("data-ust-cls")) {
      const f = i.getAttribute("data-ust-field");
      if (i.value === "" || isNaN(+i.value)) return;
      let v = +i.value;
      v = f === "n" ? Math.max(0, Math.round(v)) : Math.min(1, Math.max(0, v));
      S.classes[i.getAttribute("data-ust-cls")][f] = v;
    } else return;
    syncInputs(i);
    renderAll();
  }
  function init() {
    document.querySelectorAll('.ust[data-ust="toy"]').forEach(root => { if (!root.__ust) { root.__ust = true; build(root); roots.push(root); } });
    document.addEventListener("input", onInput);
    document.addEventListener("toggle", e => {
      const d = e.target;
      if (!d.getAttribute || !d.hasAttribute("data-ust-img")) return;
      const id = d.getAttribute("data-ust-img");
      if (d.open) openDetails.add(id); else openDetails.delete(id);
    }, true);
    document.addEventListener("click", e => {
      if (!e.target.closest || !e.target.closest(".ust [data-ust-reset]")) return;
      const d = clone(DEF);
      Object.keys(d).forEach(k => { S[k] = d[k]; });
      syncInputs(null);
      renderAll();
    });
    syncInputs(null);
    renderAll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
