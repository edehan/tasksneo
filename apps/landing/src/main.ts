import "./style.css";

const loginUrl = import.meta.env.VITE_APP_LOGIN_URL || "/login";
const registerUrl = import.meta.env.VITE_APP_REGISTER_URL || "/register";

const loginLinks = document.querySelectorAll<HTMLAnchorElement>(
  'a[data-target="login"]',
);
const registerLinks = document.querySelectorAll<HTMLAnchorElement>(
  'a[data-target="register"]',
);

for (const link of loginLinks) {
  link.href = loginUrl;
}

for (const link of registerLinks) {
  link.href = registerUrl;
}

if (!import.meta.env.VITE_APP_LOGIN_URL || !import.meta.env.VITE_APP_REGISTER_URL) {
  console.info(
    "[landing] VITE_APP_LOGIN_URL / VITE_APP_REGISTER_URL not set, using /login and /register fallback.",
  );
}

const year = document.querySelector<HTMLElement>("#year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!reduceMotion.matches) {
  window.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    root.style.setProperty("--pointer-x", x.toFixed(4));
    root.style.setProperty("--pointer-y", y.toFixed(4));
  });
}

const panels = document.querySelectorAll<HTMLElement>("[data-parallax]");
for (const panel of panels) {
  const depth = panel.dataset.depth || "0.4";
  panel.style.setProperty("--depth", depth);
}

const revealNodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
if (reduceMotion.matches) {
  for (const node of revealNodes) {
    node.classList.add("is-visible");
  }
} else {
  const observer = new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          self.unobserve(entry.target);
        }
      }
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.18,
    },
  );

  for (const node of revealNodes) {
    observer.observe(node);
  }
}
