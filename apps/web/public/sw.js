// Minimal service worker required for PWA install prompt.
// Does not cache anything — just passes requests through to the network.
self.addEventListener("fetch", () => {});
