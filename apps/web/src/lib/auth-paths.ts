const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/register/complete",
  "/forgot-password",
  "/reset-password",
]);

const PUBLIC_PATHS = new Set([...PUBLIC_AUTH_PATHS, "/terms", "/privacy"]);

const REDIRECT_BASE_URL = "http://taskneo.local";

export const CURRENT_PATH_HEADER = "x-taskneo-current-path";

export function isPublicAuthPath(pathname: string): boolean {
  return (
    PUBLIC_AUTH_PATHS.has(pathname) ||
    pathname.startsWith("/register/") ||
    pathname.startsWith("/reset-password/")
  );
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || isPublicAuthPath(pathname);
}

export function isSafeInternalPath(value: string | null): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  try {
    const url = new URL(value, REDIRECT_BASE_URL);
    return url.origin === REDIRECT_BASE_URL;
  } catch {
    return false;
  }
}

export function isSafeAuthenticatedRedirectPath(
  value: string | null,
): value is string {
  if (!isSafeInternalPath(value)) {
    return false;
  }

  const url = new URL(value, REDIRECT_BASE_URL);
  return !isPublicAuthPath(url.pathname);
}
