(() => {
  const el = document.getElementById("instrumentation-loader");
  if (!el) return;
  const raw = el.getAttribute("data-urls") || "";
  if (!raw) return;
  const urls = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const url of urls) {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    document.head.appendChild(s);
  }
})();
