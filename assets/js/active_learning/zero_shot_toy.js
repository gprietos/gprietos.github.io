/* Interactive zero-shot detection toy (_includes/active_learning/zero_shot_toy.html). Builds the widget inside every
   .zst[data-zst="toy"] element from the JSON at data-src (examples/zero_shot_toy_kitti.py writes it; the images are in
   img/ next to it). Each toy has its own state. Styles: assets/css/active_learning/zero_shot_toy.css. */
(function () {
  if (window.__zstToy) return;
  window.__zstToy = true;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const col = c => "var(--zst-" + c.toLowerCase() + ")";
  const chip = c => '<span class="zst-chip"><span class="zst-dot" style="background:' + col(c) + '"></span>' + esc(c.toLowerCase()) + '</span>';

  function boxesSvg(img, S) {
    const W = img.w, Hh = img.h, k = S.k; // k: image pixels per screen pixel (tags keep their screen size)
    let s = "";
    if (S.gt) {
      img.gt.forEach(b => {
        const x = b.x * W, y = b.y * Hh, w = b.w * W, h = b.h * Hh;
        s += '<rect class="zst-gthalo" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>' +
          '<rect class="zst-gtbox" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" style="stroke:' + col(b.c) + '"/>';
      });
    }
    // Lowest scores first, so the surest boxes are drawn on top
    img.pred.slice().reverse().forEach(b => {
      if (b.p < S.t) return;
      const x = b.x * W, y = b.y * Hh, w = b.w * W, h = b.h * Hh, c = col(b.c);
      const label = b.c.toLowerCase() + " " + b.p.toFixed(2).slice(1);
      const th = 14 * k, tw = (label.length * 6.8 + 6) * k; // 14 screen px high
      const ty = y >= th * 1.2 ? y : y + h; // tag above the box, or below it when the box touches the top edge
      s += '<rect class="zst-pred" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" style="stroke:' + c + '"/>' +
        '<rect class="zst-tag" x="' + x + '" y="' + (ty - th) + '" width="' + tw + '" height="' + th + '" style="fill:' + c + '"/>' +
        '<text x="' + (x + 3 * k) + '" y="' + (ty - 3.5 * k) + '">' + esc(label) + '</text>';
    });
    return s;
  }

  function iou(a, b) {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return inter / (a.w * a.h + b.w * b.h - inter);
  }
  // Boxes shown at threshold t matched to the ground truth: same class, IoU >= 0.5, each ground-truth box used once,
  // surest predictions first (the COCO-style rule the loop's evaluation uses). Duplicates and wrong classes are false.
  function evaluate(img, t) {
    const shown = img.pred.filter(b => b.p >= t); // img.pred is sorted by score, highest first
    const taken = new Array(img.gt.length).fill(false);
    let found = 0;
    shown.forEach(p => {
      let best = -1, bestIou = 0.5;
      img.gt.forEach((g, j) => { if (!taken[j] && g.c === p.c) { const o = iou(p, g); if (o >= bestIou) { bestIou = o; best = j; } } });
      if (best >= 0) { taken[best] = true; found++; }
    });
    return {found: found, missed: img.gt.length - found, false_: shown.length - found, shown: shown.length,
      precision: shown.length ? found / shown.length : null, recall: img.gt.length ? found / img.gt.length : null};
  }
  const fx = v => v === null ? "–" : v.toFixed(2);

  function render(root) {
    const S = root.__zst, D = S.data, img = D.images[S.i];
    const stage = root.querySelector("[data-zst-stage]");
    const im = stage.querySelector("img"), svg = stage.querySelector("svg");
    if (im.getAttribute("src") !== S.base + img.file) {
      im.setAttribute("src", S.base + img.file);
      im.setAttribute("alt", "KITTI frame " + img.frame);
      svg.setAttribute("viewBox", "0 0 " + img.w + " " + img.h);
    }
    scale(root);
    svg.innerHTML = boxesSvg(img, S);
    const e = evaluate(img, S.t);
    root.querySelector("[data-zst-count]").innerHTML = 'found <b>' + e.found + '</b> of ' + img.gt.length + ' · missed <b>' + e.missed +
      '</b> · <b>' + e.false_ + '</b> false ' + (e.false_ === 1 ? 'box' : 'boxes');
    root.querySelector("[data-zst-pr]").innerHTML = 'precision <b>' + fx(e.precision) + '</b> · recall <b>' + fx(e.recall) + '</b>';
    root.querySelector("[data-zst-frame]").textContent = img.frame + " · " + img.drive;
    root.querySelector("[data-zst-note]").textContent = img.note || "";
    root.querySelectorAll("[data-zst-thumb]").forEach(b => b.setAttribute("aria-current", +b.getAttribute("data-zst-thumb") === S.i ? "true" : "false"));
  }

  // S.k / --zst-k: image pixels per screen pixel, so strokes (CSS) and tags (script) keep their size whatever the
  // column width. Returns true when it changed (the tags must be redrawn).
  function scale(root) {
    const S = root.__zst, img = S.data.images[S.i], svg = root.querySelector("[data-zst-stage] svg");
    const w = svg.clientWidth || img.w, k = +(img.w / w).toFixed(4);
    if (k === S.k) return false;
    S.k = k;
    svg.style.setProperty("--zst-k", k);
    return true;
  }
  function rescale(root) {
    if (root.__zst && root.__zst.data && scale(root)) root.querySelector("[data-zst-stage] svg").innerHTML = boxesSvg(root.__zst.data.images[root.__zst.i], root.__zst);
  }

  function build(root, data) {
    const S = root.__zst;
    S.data = data;
    const thumbs = data.images.map((img, i) =>
      '<button type="button" class="zst-thumb" data-zst-thumb="' + i + '" aria-label="Show frame ' + esc(img.frame) + '" title="' + esc(img.note || img.frame) + '">' +
      '<img src="' + esc(S.base + img.file) + '" alt="" loading="lazy" width="' + img.w + '" height="' + img.h + '"></button>').join("");
    root.innerHTML = '<div class="zst-panel">' +
      '<div class="zst-ctls">' +
        '<div class="zst-ctl" title="Boxes with a score under the threshold are hidden (scores under ' + data.min_score + ' were not stored). The loop keeps the boxes above it as pre-labels.">' +
          '<label for="zst-t-' + S.n + '"><span>confidence threshold</span><output data-zst-tout></output></label>' +
          '<input type="range" id="zst-t-' + S.n + '" data-zst-t min="' + data.min_score + '" max="0.95" step="0.01"></div>' +
        '<label class="zst-switch"><input type="checkbox" data-zst-gt><span class="zst-gtdot" aria-hidden="true"></span>ground truth</label>' +
        '<div class="zst-legend">' + data.classes.map(chip).join("") + '</div>' +
      '</div>' +
      '<div class="zst-stage" data-zst-stage><img alt=""><svg aria-hidden="true"></svg></div>' +
      '<div class="zst-info" title="A box is right when it has the class of a ground-truth box and overlaps it by IoU ≥ 0.5; each ground-truth box counts once, surest boxes first">' +
        '<span data-zst-count></span><span data-zst-pr></span><span data-zst-frame></span></div>' +
      '<div class="zst-note" data-zst-note></div>' +
      '<div class="zst-thumbs">' + thumbs + '</div>' +
      '</div>';
    const t = root.querySelector("[data-zst-t]");
    t.value = S.t;
    root.querySelector("[data-zst-tout]").textContent = S.t.toFixed(2);
    root.querySelector("[data-zst-gt]").checked = S.gt;
    render(root);
    if (window.ResizeObserver) new ResizeObserver(() => rescale(root)).observe(root.querySelector("[data-zst-stage]"));
  }

  function onInput(e) {
    const i = e.target, root = i.closest && i.closest('.zst[data-zst="toy"]');
    if (!root || !root.__zst || !root.__zst.data) return;
    if (i.hasAttribute("data-zst-t")) { root.__zst.t = +i.value; root.querySelector("[data-zst-tout]").textContent = root.__zst.t.toFixed(2); }
    else if (i.hasAttribute("data-zst-gt")) root.__zst.gt = i.checked;
    else return;
    render(root);
  }

  function onClick(e) {
    const b = e.target.closest && e.target.closest(".zst [data-zst-thumb]");
    if (!b) return;
    const root = b.closest('.zst[data-zst="toy"]');
    root.__zst.i = +b.getAttribute("data-zst-thumb");
    render(root);
  }

  let n = 0;
  function init() {
    document.querySelectorAll('.zst[data-zst="toy"]').forEach(root => {
      if (root.__zst) return;
      const src = root.getAttribute("data-src");
      root.__zst = {n: n++, i: 0, t: 0.3, gt: false, k: 0, base: src.replace(/[^/]*$/, "") + "img/", data: null};
      root.innerHTML = '<div class="zst-panel"><p class="zst-note">Loading the demo…</p></div>';
      fetch(src).then(r => { if (!r.ok) throw new Error(r.status + " " + r.statusText); return r.json(); })
        .then(data => { root.__zst.t = data.default_threshold || 0.3; build(root, data); })
        .catch(err => { root.innerHTML = '<div class="zst-panel"><p class="zst-note">The demo data could not be loaded (' + esc(err.message) + ').</p></div>'; });
    });
    document.addEventListener("input", onInput);
    document.addEventListener("click", onClick);
    window.addEventListener("resize", () => document.querySelectorAll('.zst[data-zst="toy"]').forEach(rescale));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
