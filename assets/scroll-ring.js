/* 圆环滚动指示器
   ------------------------------------------------------------
   系统滚动条在 base.css 里隐藏了，这里自己画：一条细线 + 一个空心圆环。
   交互跟普通滚动条一致：
     - 按住圆环拖动 → 连续滚动；
     - 在细线上按下 → 圆环跳到该处并接着拖（等同“点哪滚哪”）；
     - 滚轮、键盘、触摸滚动照常用，圆环跟着走。
   三个容器各一份：页面、左栏目录、右栏大纲。
   ------------------------------------------------------------ */

(function () {
  "use strict";

  var RING = 15;                       // 圆环直径（要和 CSS 里一致）
  var DESKTOP = "(min-width: 62rem)";

  function isDesktop() {
    return window.matchMedia(DESKTOP).matches;
  }

  // 元素是否真的显示着（display:none / 收起 / 不在文档里都算“没显示”）
  function visible(el) {
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  }

  function barHeight() {
    var bar = document.querySelector(".bar");
    if (bar) {
      var h = bar.getBoundingClientRect().height;
      if (h > 0) return h;
    }
    var fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return 3.4 * fs;
  }

  function make(scroller) {
    var isWin = scroller === window;

    var bar = document.createElement("div");
    bar.className = "ringbar";

    var line = document.createElement("div");
    line.className = "ringbar-line";

    var ring = document.createElement("div");
    ring.className = "ringbar-ring";

    bar.appendChild(line);
    bar.appendChild(ring);
    document.body.appendChild(bar);

    var dragging = false;
    var grabOffset = 0;       // 按住时指针相对圆环顶端的偏移
    var ratio = 0;
    var maxScroll = 0;
    var travel = 0;

    function read() {
      if (isWin) {
        var bh = barHeight();
        return {
          top: bh + 2,
          height: window.innerHeight - bh - 6,
          scrollTop: window.pageYOffset || document.documentElement.scrollTop,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: window.innerHeight,
          right: 2
        };
      }
      var r = scroller.getBoundingClientRect();
      return {
        top: r.top + 4,
        height: r.height - 8,
        scrollTop: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        right: window.innerWidth - r.right + 1
      };
    }

    function render() {
      if (!isDesktop() || (!isWin && !visible(scroller))) {
        bar.classList.remove("is-on");
        dragging = false;
        return;
      }

      var m = read();
      maxScroll = m.scrollHeight - m.clientHeight;
      travel = m.height - RING;

      if (maxScroll <= 8 || travel < 24) {
        bar.classList.remove("is-on");
        dragging = false;
        return;
      }

      bar.classList.add("is-on");
      bar.style.top = m.top.toFixed(1) + "px";
      bar.style.height = m.height.toFixed(1) + "px";
      bar.style.right = m.right.toFixed(1) + "px";

      if (!dragging) {
        ratio = m.scrollTop / maxScroll;
      }
      ratio = Math.max(0, Math.min(1, ratio));
      ring.style.transform = "translateY(" + (travel * ratio).toFixed(1) + "px)";
    }

    function scrollToRatio(r) {
      var y = Math.max(0, Math.min(1, r)) * maxScroll;
      // 拖动 / 点击时要跟手，不能走 CSS 的平滑滚动
      var root = document.documentElement;
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      if (isWin) {
        window.scrollTo(0, y);
      } else {
        scroller.scrollTop = y;
      }
      root.style.scrollBehavior = prev;
    }

    function setRatioFromPointer(clientY, fromTrack) {
      var boxTop = bar.getBoundingClientRect().top;
      var y = clientY - boxTop;

      if (fromTrack) {
        // 点在线上：圆环中心对准指针
        grabOffset = RING / 2;
        ratio = travel > 0 ? (y - grabOffset) / travel : 0;
      } else {
        ratio = travel > 0 ? (y - grabOffset) / travel : 0;
      }

      ratio = Math.max(0, Math.min(1, ratio));
      ring.style.transform = "translateY(" + (travel * ratio).toFixed(1) + "px)";
      scrollToRatio(ratio);
    }

    bar.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;

      var onRing = ring.contains(e.target);
      var ringTop = bar.getBoundingClientRect().top + travel * ratio;
      grabOffset = onRing ? e.clientY - ringTop : RING / 2;

      dragging = true;
      bar.classList.add("is-drag");
      bar.setPointerCapture(e.pointerId);
      setRatioFromPointer(e.clientY, !onRing);
      e.preventDefault();
    });

    bar.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      setRatioFromPointer(e.clientY, false);
    });

    function stopDrag(e) {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove("is-drag");
      if (e && e.pointerId != null && bar.hasPointerCapture &&
          bar.hasPointerCapture(e.pointerId)) {
        bar.releasePointerCapture(e.pointerId);
      }
      render();
    }

    bar.addEventListener("pointerup", stopDrag);
    bar.addEventListener("pointercancel", stopDrag);

    return { render: render };
  }

  var all = [];

  function renderAll() {
    for (var i = 0; i < all.length; i++) all[i].render();
  }

  function tick() {
    window.requestAnimationFrame(renderAll);
  }

  function init() {
    all.push(make(window));

    var side = document.querySelector(".side");
    var rail = document.querySelector(".rail");
    if (side) all.push(make(side));
    if (rail) all.push(make(rail));

    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);

    [side, rail].forEach(function (el) {
      if (el) el.addEventListener("scroll", tick, { passive: true });
    });

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(tick);
      ro.observe(document.body);
      if (side) ro.observe(side);
      if (rail) ro.observe(rail);
    }

    // 收起 / 展开左右栏时 body 上加类，这里跟着重算圆环位置
    if (window.MutationObserver) {
      var mo = new MutationObserver(tick);
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      if (side) mo.observe(side, { attributes: true, attributeFilter: ["class", "style"] });
      if (rail) mo.observe(rail, { attributes: true, attributeFilter: ["class", "style"] });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(tick);
    }

    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
