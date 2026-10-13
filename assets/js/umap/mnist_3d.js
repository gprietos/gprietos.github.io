/* Interactive 3-D UMAP of MNIST (_includes/umap/mnist_3d.html), after Figure 2 of PAIR's "Understanding UMAP".
 *
 * UMAP is not run in the browser: the umap-examples repo precomputes it (scripts/export_mnist_3d.py). scatter-gl draws
 * every point as its own digit, cut from one sprite sheet and tinted with the class color.
 * Data folder: mnist_3d.json (points, labels), sprites.png (28×28 tiles, 100 per row, in point order).
 */
(function () {
  "use strict";

  // matplotlib's tab10, as in the post's static MNIST figures
  const COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22",
                  "#17becf"];
  const FADED = "rgba(128, 128, 128, 0.12)";

  // scatter-gl paints an opaque background (also used as fog color), so use the page's own: the first ancestor
  // with a non-transparent background
  function pageBackground(el) {
    for (; el; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return "#ffffff";
  }

  function init(figure) {
    const base = figure.dataset.src.replace(/\/$/, "");
    const plot = figure.querySelector(".m3-plot");
    const orbitButton = figure.querySelector(".m3-orbit");
    const resetButton = figure.querySelector(".m3-reset");
    const digitsBox = figure.querySelector(".m3-digits");

    const selected = new Set(); // highlighted digits; empty = all in color
    let labels = null;
    let scatter = null;

    // The sprites' transparent corners still write depth, so a faded digit in front hid the highlighted ones behind
    // it; drawing them without depth writes just blends them (internals, 0.0.13: the material is rebuilt at times)
    function blendSprites() {
      const m = scatter.spritesheetVisualizer?.renderMaterial;
      if (m && m.depthWrite) {
        m.depthWrite = false;
        m.needsUpdate = true;
      }
    }

    function recolor() {
      digitsBox.classList.toggle("m3-some", selected.size > 0);
      for (const b of digitsBox.children) b.setAttribute("aria-pressed", selected.has(+b.dataset.digit));
      scatter.setPointColorer((i) =>
        selected.size === 0 || selected.has(labels[i]) ? COLORS[labels[i]] : FADED);
      blendSprites();
    }

    // Click selects only that digit (or clears it if it was the only one); shift-click adds or removes it
    function toggleDigit(d, additive) {
      if (d === null) selected.clear();
      else if (additive) selected.has(d) ? selected.delete(d) : selected.add(d);
      else if (selected.has(d) && selected.size === 1) selected.clear();
      else {
        selected.clear();
        selected.add(d);
      }
      recolor();
    }

    function setBackground() {
      // scatter-gl has no setter for it: update its styles and the renderer's clear color (internals, 0.0.13)
      const c = pageBackground(figure);
      const sp = scatter.scatterPlot;
      if (!sp?.renderer || !sp.styles) return;
      sp.styles.backgroundColor = c;
      sp.renderer.setClearColor(c, 1);
      sp.render();
    }

    // The camera's field of view is vertical: zoom out in narrow (phone) boxes so the cloud fits sideways
    const startZoom = () => 1.3 * Math.min(1, plot.clientWidth / plot.clientHeight / 1.4);

    // Back to the starting view, rotating. scatter-gl's resetZoom() would drop our zoom, so rebuild the camera with
    // it (internals, 0.0.13)
    function resetView() {
      const sp = scatter.scatterPlot;
      if (sp?.recreateCamera && sp.makeDefaultCameraDef) {
        sp.recreateCamera(sp.makeDefaultCameraDef(3, { zoom: startZoom() }));
        sp.render();
      } else scatter.resetZoom();
      scatter.startOrbitAnimation();
      orbitButton.hidden = resetButton.hidden = true;
    }

    let shift = false;
    window.addEventListener("keydown", (e) => (shift = e.shiftKey), true);
    window.addEventListener("keyup", (e) => (shift = e.shiftKey), true);
    plot.addEventListener("pointerdown", (e) => (shift = e.shiftKey), true);

    fetch(`${base}/mnist_3d.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`mnist_3d.json: HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        labels = data.labels;
        const points = [];
        for (let i = 0; i < data.points.length; i += 3) points.push([data.points[i], data.points[i + 1], data.points[i + 2]]);
        const dataset = new ScatterGL.Dataset(points, labels.map((d) => ({ label: String(d) })));
        dataset.setSpriteMetadata({ spriteImage: `${base}/sprites.png`, singleSpriteSize: [28, 28] });

        scatter = new ScatterGL(plot, {
          renderMode: "SPRITE",
          rotateOnStart: true,
          selectEnabled: false,
          showLabelsOnHover: false,
          camera: { zoom: startZoom() },
          orbitControls: { zoomSpeed: 0.6, autoRotateSpeed: 1.2 }, // scatter-gl default rotation speed: 2
          styles: { backgroundColor: pageBackground(figure), axesVisible: false, sprites: { imageSize: 11 } },
          onClick: (i) => toggleDigit(i === null ? null : labels[i], shift),
          onCameraMove: () => {
            scatter.stopOrbitAnimation();
            orbitButton.hidden = resetButton.hidden = false;
          },
        });
        scatter.render(dataset);

        for (let d = 0; d < 10; d++) {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.digit = d;
          b.textContent = d;
          b.style.background = COLORS[d];
          b.addEventListener("click", (e) => toggleDigit(d, e.shiftKey));
          digitsBox.appendChild(b);
        }
        recolor();

        orbitButton.addEventListener("click", () => {
          orbitButton.hidden = true;
          scatter.startOrbitAnimation();
        });
        resetButton.addEventListener("click", resetView);
        window.addEventListener("resize", () => scatter.resize());
        // Follow the blog's light/dark toggle (Chirpy sets data-mode on <html>) and the system theme
        new MutationObserver(setBackground).observe(document.documentElement, { attributes: true });
        new MutationObserver(setBackground).observe(document.body, { attributes: true });
        matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", setBackground);
      })
      .catch((err) => {
        plot.textContent = `Could not load the interactive figure (${err.message}).`;
      });
  }

  // Load data and start WebGL only when the figure gets close to the viewport
  function start() {
    const figures = document.querySelectorAll(".umap-mnist3d[data-src]");
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
