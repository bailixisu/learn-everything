function initRevealSections() {
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const sections = document.querySelectorAll<HTMLElement>(
    ".reveal-section[data-reveal]"
  );

  if (prefersReduced || sections.length === 0) {
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
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  sections.forEach(el => {
    if (el.getAttribute("data-reveal") !== "visible") {
      el.setAttribute("data-reveal", "pending");
      observer.observe(el);
    }
  });
}

initRevealSections();
document.addEventListener("astro:page-load", initRevealSections);
