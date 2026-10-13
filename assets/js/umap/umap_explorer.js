/* Interactive "3-D shape → UMAP" figure (_includes/umap/umap_explorer.html).
 *
 * UMAP is not run in the browser: the umap-examples repo precomputes every (n_neighbors, min_dist) layout of the grid
 * for each shape (scripts/export_umap_explorer.py). The page only looks them up and animates between them.
 * Hovering a point in either view highlights the same point in the other one.
 * Data folder: index.json (grid + shapes), <shape>.json, thumbs/<shape>.png.
 */
(function () {
  "use strict";

  const PLOT_CONFIG = { displayModeBar: false, responsive: true, scrollZoom: false };
  const TRANSPARENT = "rgba(0,0,0,0)";
  const HIDDEN_AXIS = { visible: false, showgrid: false, zeroline: false, showspikes: false };
  const RANGE_2D = [-1.08, 1.08];

  function decode3d(flat) {
    const x = [], y = [], z = [];
    for (let i = 0; i < flat.length; i += 3) {
      x.push(flat[i]);
      y.push(flat[i + 1]);
      z.push(flat[i + 2]);
    }
    return { x, y, z };
  }

  // Layout coordinates are quantized to ints 0..999; map them back to [-1, 1]
  function decode2d(flat) {
    const x = [], y = [];
    for (let i = 0; i < flat.length; i += 2) {
      x.push((flat[i] / 999) * 2 - 1);
      y.push((flat[i + 1] / 999) * 2 - 1);
    }
    return { x, y };
  }

  function init(figure) {
    const base = figure.dataset.src.replace(/\/$/, "");
    const div3d = figure.querySelector(".ux-3d");
    const div2d = figure.querySelector(".ux-2d");
    const shapesBox = figure.querySelector(".ux-shapes");
    const kInput = figure.querySelector(".ux-k");
    const mdInput = figure.querySelector(".ux-md");
    const kOut = figure.querySelector(".ux-k-value");
    const mdOut = figure.querySelector(".ux-md-value");

    const cache = {};
    let index = null;
    let current = null; // { key, data, p3, p2 }: shape data plus decoded 3-D points and current 2-D layout
    let hovered = null; // index of the highlighted point, shown in both views

    const loadShape = (key) =>
      (cache[key] ||= fetch(`${base}/${key}.json`).then((r) => {
        if (!r.ok) throw new Error(`${key}.json: HTTP ${r.status}`);
        return r.json();
      }));

    function layoutKey() {
      return `k${index.ks[kInput.value]}_md${index.min_dists[mdInput.value]}`;
    }

    function updateLabels() {
      kOut.textContent = index.ks[kInput.value];
      mdOut.textContent = index.min_dists[mdInput.value];
    }

    // Highlight of the hovered point: an HTML ring over each plot (.ux-ring), in the point's color with an outline in
    // the text color. Moving a ring needs no Plotly redraw; redrawing the plots on every hovered point made hovering
    // lag (and redrawing the 3-D scene also cancelled drags and reset the view).
    function makeRing(div) {
      const ring = document.createElement("div");
      ring.className = "ux-ring";
      ring.hidden = true;
      return ring;
    }
    const ring2d = makeRing(div2d);
    const ring3d = makeRing(div3d);

    // Show `ring` at pixel position `xy` inside `div` (null hides it); `animated` follows the 450 ms slider animation
    function placeRing(ring, div, xy, animated = false) {
      if (!ring.isConnected) div.appendChild(ring); // re-added if a redraw removed it
      ring.hidden = !xy;
      if (!xy) return;
      ring.classList.toggle("ux-moving", animated);
      ring.style.left = `${xy[0]}px`;
      ring.style.top = `${xy[1]}px`;
      ring.style.background = current.data.colors[hovered];
    }

    function pixel2d(i) {
      const fl = div2d._fullLayout;
      if (!fl?.xaxis) return null;
      return [fl.xaxis._offset + fl.xaxis.l2p(current.p2.x[i]), fl.yaxis._offset + fl.yaxis.l2p(current.p2.y[i])];
    }

    // Project a 3-D point to pixels with the scene's camera, the way Plotly places its own 3-D hover labels
    // (src/plots/gl3d/scene.js and project.js in plotly.js 2.35). This uses Plotly internals: if they are missing,
    // the 3-D ring just stays hidden.
    function pixel3d(i) {
      const scene = div3d._fullLayout?.scene?._scene;
      const cam = scene?.glplot?.cameraParams;
      if (!cam || !scene.dataScale || !scene.container) return null;
      const mul = (m, v) => {
        const out = [0, 0, 0, 0];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c] += m[4 * r + c] * v[r];
        return out;
      };
      const p = current.p3, ds = scene.dataScale;
      const [x, y, , w] = mul(cam.projection, mul(cam.view, mul(cam.model, [p.x[i] * ds[0], p.y[i] * ds[1], p.z[i] * ds[2], 1])));
      const box = scene.container.getBoundingClientRect(), own = div3d.getBoundingClientRect();
      return [
        box.left - own.left - div3d.clientLeft + (0.5 + 0.5 * x / w) * box.width,
        box.top - own.top - div3d.clientTop + (0.5 - 0.5 * y / w) * box.height,
      ];
    }

    function placeRings(animated2d = false) {
      const on = current && hovered !== null;
      placeRing(ring2d, div2d, on && pixel2d(hovered), animated2d);
      placeRing(ring3d, div3d, on && !dragging3d && pixel3d(hovered));
    }

    // Plotly only listens to the mouse on the 3-D canvas, so a drag stopped as soon as the pointer left it (and
    // snapped back to the old view when released outside). Capturing the pointer sends the whole drag to the canvas.
    // The 3-D ring hides while the view rotates and comes back once the camera has settled.
    let dragging3d = false;
    div3d.addEventListener("pointerdown", (e) => {
      dragging3d = true;
      e.target.setPointerCapture?.(e.pointerId);
      ring3d.hidden = true;
    }, true);
    window.addEventListener("pointerup", () => {
      if (!dragging3d) return;
      dragging3d = false;
      requestAnimationFrame(() => placeRings());
    }, true);

    // Plotly finds the 3-D hover in its render loop, so its unhover can arrive after the mouse already hovers a 2-D
    // point; an unhover only clears a highlight that came from the same view.
    let hoverSource = null; // "2d" or "3d"

    function highlight(i, source) {
      if (!current || (i === null && source !== hoverSource) || (i === hovered && source === hoverSource)) return;
      hovered = i;
      hoverSource = i === null ? null : source;
      placeRings();
    }

    // Hovering (or tapping, on touch screens) a point of the main trace highlights it in both views
    function linkHover(div, source) {
      const onPoint = (e) => {
        const pt = e.points.find((q) => q.curveNumber === 0);
        if (pt) highlight(pt.pointNumber, source);
      };
      div.on("plotly_hover", onPoint);
      div.on("plotly_click", onPoint);
      div.on("plotly_unhover", () => highlight(null, source));
      div.on("plotly_afterplot", () => requestAnimationFrame(() => placeRings())); // e.g. after a resize
    }

    function draw3d(key) {
      const p = current.p3;
      Plotly.react(
        div3d,
        [
          {
            type: "scatter3d", mode: "markers", x: p.x, y: p.y, z: p.z, hoverinfo: "none",
            marker: { size: 2, color: current.data.colors, opacity: 0.9 },
          },
        ],
        {
          margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: TRANSPARENT, showlegend: false, hovermode: "closest",
          uirevision: key, // keep the user's rotation until the shape changes
          scene: {
            xaxis: HIDDEN_AXIS, yaxis: HIDDEN_AXIS, zaxis: HIDDEN_AXIS, aspectmode: "data", dragmode: "turntable",
            camera: { eye: { x: 1.3, y: 1.3, z: 0.7 } },
          },
        },
        PLOT_CONFIG,
      );
    }

    function draw2d() {
      const p = current.p2;
      Plotly.react(
        div2d,
        [
          {
            type: "scatter", mode: "markers", x: p.x, y: p.y, hoverinfo: "none",
            marker: { size: 3, color: current.data.colors, opacity: 0.85 },
          },
        ],
        {
          margin: { l: 4, r: 4, t: 4, b: 4 }, paper_bgcolor: TRANSPARENT, plot_bgcolor: TRANSPARENT,
          showlegend: false, dragmode: false, hovermode: "closest",
          xaxis: { ...HIDDEN_AXIS, range: RANGE_2D, fixedrange: true },
          yaxis: { ...HIDDEN_AXIS, range: RANGE_2D, fixedrange: true, scaleanchor: "x" },
        },
        PLOT_CONFIG,
      );
    }

    function animate2d() {
      updateLabels();
      if (!current) return;
      current.p2 = decode2d(current.data.layouts[layoutKey()]);
      Plotly.animate(
        div2d,
        { data: [{ x: current.p2.x, y: current.p2.y }], traces: [0] },
        { transition: { duration: 450, easing: "cubic-in-out" }, frame: { duration: 450, redraw: false }, mode: "immediate" },
      );
      placeRings(true); // the 2-D ring moves with its point (same duration and easing, in CSS)
    }

    async function selectShape(key) {
      for (const b of shapesBox.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.key === key);
      figure.classList.add("ux-loading");
      try {
        const data = await loadShape(key);
        current = { key, data, p3: decode3d(data.points3d), p2: decode2d(data.layouts[layoutKey()]) };
        hovered = null;
        hoverSource = null;
        placeRings();
        draw3d(key);
        draw2d();
      } finally {
        figure.classList.remove("ux-loading");
      }
    }

    fetch(`${base}/index.json`)
      .then((r) => r.json())
      .then((idx) => {
        index = idx;
        kInput.max = index.ks.length - 1;
        mdInput.max = index.min_dists.length - 1;
        kInput.value = Math.max(0, index.ks.indexOf(index.default.k));
        mdInput.value = Math.max(0, index.min_dists.indexOf(index.default.min_dist));
        updateLabels();
        kInput.addEventListener("input", animate2d);
        mdInput.addEventListener("input", animate2d);

        for (const s of index.shapes) {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.key = s.key;
          b.title = s.title;
          b.innerHTML = `<img src="${base}/thumbs/${s.key}.png" alt="" loading="lazy">${s.title}`;
          b.addEventListener("click", () => selectShape(s.key));
          shapesBox.appendChild(b);
        }
        const first = index.shapes.find((s) => s.key === figure.dataset.shape) || index.shapes[0];
        return selectShape(first.key).then(() => {
          linkHover(div3d, "3d");
          linkHover(div2d, "2d");
        });
      })
      .catch((err) => {
        figure.querySelector(".ux-panels").textContent = `Could not load the interactive figure (${err.message}).`;
      });
  }

  // Load data and start WebGL only when the figure gets close to the viewport
  function start() {
    const figures = document.querySelectorAll(".umap-explorer[data-src]");
    if (!("IntersectionObserver" in window)) return figures.forEach(init);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          init(e.target);
        }
      },
      { rootMargin: "400px" },
    );
    figures.forEach((f) => io.observe(f));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
