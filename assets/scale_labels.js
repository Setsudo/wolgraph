// Shrink the wheel's annotation fonts on narrow plots so category labels
// are not clipped at the plot edge. Desktop (>= 600px plot width) is untouched.
(function () {
    var BASE_WIDTH = 600;
    var CATEGORY_SIZE = 17, CATEGORY_MIN = 9;
    var RING_SIZE = 11, RING_MIN = 7;
    var DIGITS = /^\d+$/;

    function findPlot() {
        var host = document.getElementById("wheel-graph");
        return host ? host.querySelector(".js-plotly-plot") : null;
    }

    function rescale(gd) {
        if (!window.Plotly || !gd || !gd.layout || !gd.layout.annotations) {
            return;
        }
        var w = gd._fullLayout && gd._fullLayout.width
            ? gd._fullLayout.width
            : gd.getBoundingClientRect().width;
        if (!w) {
            return;
        }
        var catSize = CATEGORY_SIZE, ringSize = RING_SIZE;
        if (w < BASE_WIDTH) {
            catSize = Math.max(CATEGORY_MIN, Math.round(CATEGORY_SIZE * w / BASE_WIDTH));
            ringSize = Math.max(RING_MIN, Math.round(RING_SIZE * w / BASE_WIDTH));
        }
        var update = {};
        var changed = false;
        gd.layout.annotations.forEach(function (ann, i) {
            var text = String(ann.text == null ? "" : ann.text).trim();
            var target = DIGITS.test(text) ? ringSize : catSize;
            var current = ann.font && ann.font.size;
            if (current !== target) {
                update["annotations[" + i + "].font.size"] = target;
                changed = true;
            }
        });
        if (changed) {
            window.Plotly.relayout(gd, update);
        }
    }

    function attach() {
        var gd = findPlot();
        if (!gd || gd.__wolScaleAttached || typeof gd.on !== "function") {
            return;
        }
        gd.__wolScaleAttached = true;
        gd.on("plotly_afterplot", function () { rescale(gd); });
        rescale(gd);
    }

    function start() {
        attach();
        new MutationObserver(attach).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
