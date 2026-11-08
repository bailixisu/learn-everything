const CANVAS_SELECTOR = ".garden-canvas";
const GLOW_ROOT_SELECTOR = ".garden-glow";
const ORB_SELECTOR = ".garden-glow-orb";
const REVEAL_SELECTOR =
  ".garden-spread.reveal-garden, .garden-chapter.reveal-garden";

const SETTLE_EPS = 0.35;
const SMOOTHING = 0.14;

let teardown: (() => void) | undefined;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasFinePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function shouldRunEffects() {
  return !prefersReducedMotion();
}

function initGardenGlow(canvas: HTMLElement): (() => void) | undefined {
  if (!shouldRunEffects() || !hasFinePointer()) {
    canvas.dataset.glow = "off";
    return;
  }

  const root = canvas.querySelector<HTMLElement>(GLOW_ROOT_SELECTOR);
  const orb = canvas.querySelector<HTMLElement>(ORB_SELECTOR);
  if (!root || !orb) return;

  canvas.dataset.glow = "on";

  let targetX = window.innerWidth * 0.45;
  let targetY = window.innerHeight * 0.32;
  let currentX = targetX;
  let currentY = targetY;
  let rafId = 0;
  let animating = false;
  const paint = () => {
    const dx = targetX - currentX;
    const dy = targetY - currentY;

    if (Math.abs(dx) < SETTLE_EPS && Math.abs(dy) < SETTLE_EPS) {
      currentX = targetX;
      currentY = targetY;
      orb.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      orb.style.willChange = "auto";
      animating = false;
      return;
    }

    currentX += dx * SMOOTHING;
    currentY += dy * SMOOTHING;
    orb.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
    rafId = requestAnimationFrame(paint);
  };

  const kick = () => {
    if (animating) return;
    animating = true;
    orb.style.willChange = "transform";
    rafId = requestAnimationFrame(paint);
  };

  const onPointerMove = (e: PointerEvent) => {
    targetX = e.clientX;
    targetY = e.clientY;
    kick();
  };

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      animating = false;
      orb.style.willChange = "auto";
    }
  };

  paint();
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelAnimationFrame(rafId);
    canvas.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.dataset.glow = "off";
    orb.style.willChange = "auto";
  };
}

function initRevealGarden(canvas: HTMLElement): (() => void) | undefined {
  const sections = canvas.querySelectorAll<HTMLElement>(REVEAL_SELECTOR);

  if (!shouldRunEffects()) {
    sections.forEach(el => el.setAttribute("data-reveal", "visible"));
    return;
  }

  if (sections.length === 0) return;

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-reveal", "visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -5% 0px", threshold: 0.05 }
  );

  sections.forEach(el => {
    if (el.getAttribute("data-reveal") !== "visible") {
      el.setAttribute("data-reveal", "pending");
      observer.observe(el);
    }
  });

  return () => observer.disconnect();
}

function initGardenCanvas() {
  teardown?.();
  teardown = undefined;

  const canvas = document.querySelector<HTMLElement>(CANVAS_SELECTOR);
  if (!canvas) return;

  const cleanups = [initGardenGlow(canvas), initRevealGarden(canvas)].filter(
    Boolean
  ) as Array<() => void>;

  if (cleanups.length === 0) return;

  teardown = () => cleanups.forEach(fn => fn());
}

initGardenCanvas();
document.addEventListener("astro:page-load", initGardenCanvas);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
