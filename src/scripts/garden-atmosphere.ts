const CANVAS_SELECTOR = ".garden-canvas";
const GLOW_SELECTOR = ".garden-glow";
const PARALLAX_SELECTOR = "[data-parallax]";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initGardenGlow(canvas: HTMLElement) {
  const glow = canvas.querySelector<HTMLElement>(GLOW_SELECTOR);
  if (!glow || prefersReducedMotion()) {
    canvas.dataset.gardenReady = "true";
    return;
  }

  let frame = 0;
  let targetX = 50;
  let targetY = 40;
  let currentX = 50;
  let currentY = 40;

  const tick = () => {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;
    glow.style.setProperty("--glow-x", `${currentX}%`);
    glow.style.setProperty("--glow-y", `${currentY}%`);
    frame = requestAnimationFrame(tick);
  };

  const onMove = (e: PointerEvent) => {
    targetX = (e.clientX / window.innerWidth) * 100;
    targetY = (e.clientY / window.innerHeight) * 100;
    canvas.dataset.gardenReady = "true";
  };

  canvas.addEventListener("pointermove", onMove, { passive: true });
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    canvas.removeEventListener("pointermove", onMove);
  };
}

function initGardenParallax(canvas: HTMLElement) {
  const nodes = canvas.querySelectorAll<HTMLElement>(PARALLAX_SELECTOR);
  if (nodes.length === 0 || prefersReducedMotion()) return;

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    nodes.forEach(node => {
      const depth = Number(node.dataset.parallax ?? "0.08");
      node.style.transform = `translate3d(0, ${y * depth}px, 0)`;
    });
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  update();

  return () => window.removeEventListener("scroll", onScroll);
}

function initRevealGarden(canvas: HTMLElement) {
  const sections = canvas.querySelectorAll<HTMLElement>(".reveal-garden");
  if (prefersReducedMotion()) {
    sections.forEach(el => el.setAttribute("data-reveal", "visible"));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.setAttribute("data-reveal", "visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
  );

  sections.forEach(el => {
    if (el.getAttribute("data-reveal") !== "visible") {
      el.setAttribute("data-reveal", "pending");
      observer.observe(el);
    }
  });

  return () => observer.disconnect();
}

function init() {
  const canvas = document.querySelector<HTMLElement>(CANVAS_SELECTOR);
  if (!canvas) return;

  const cleanups = [
    initGardenGlow(canvas),
    initGardenParallax(canvas),
    initRevealGarden(canvas),
  ].filter(Boolean) as Array<() => void>;

  return () => cleanups.forEach(fn => fn());
}

init();
document.addEventListener("astro:page-load", init);
