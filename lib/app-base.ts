// Public schedule lives at / on Netlify and under /hapoel-schedule/ on GitHub Pages.
// The service worker must be registered inside that path so its scope covers the site.

export const GITHUB_PAGES_ORIGIN = "https://gamechangersbgu-eng.github.io";
export const NETLIFY_APP_ORIGIN = "https://voluble-basbousa-0196c2.netlify.app";

export function appBasePathFrom(pathname: string, configured = ""): string {
  const fromEnv = configured.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (pathname === "/hapoel-schedule" || pathname.startsWith("/hapoel-schedule/")) return "/hapoel-schedule";
  return "";
}

export function serviceWorkerScript(pathname: string, configured = ""): string {
  return `${appBasePathFrom(pathname, configured)}/sw.js`;
}

/** Public file, under the GitHub Pages folder when the site is built with one. */
export function publicAsset(path: string, configured = process.env.NEXT_PUBLIC_BASE_PATH ?? ""): string {
  const base = configured.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Path opened when a push is tapped. Absolute URLs are rejected by the API. */
export function schedulePathFor(basePath: string): string {
  return basePath ? `${basePath}/` : "/";
}

/**
 * Where the browser posts a subscription.
 * Pages cannot host the API, so those requests go to the Netlify app.
 * The Netlify site itself uses a same-origin relative URL.
 */
export function resolvePushApiOrigin(pageOrigin: string, configured = ""): string {
  const api = configured.replace(/\/$/, "");
  if (api) return pageOrigin && pageOrigin !== api ? api : "";
  if (pageOrigin === GITHUB_PAGES_ORIGIN) return NETLIFY_APP_ORIGIN;
  return "";
}

export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1);
}

export function isStandaloneDisplay(matchesStandalone: boolean, navigatorStandalone: boolean): boolean {
  return matchesStandalone || navigatorStandalone;
}

/** iOS delivers web push only from a Home Screen app. Show the hint once per session. */
export function shouldShowIosPushHint(input: {
  hasAlerts: boolean;
  ios: boolean;
  standalone: boolean;
  alreadyShown: boolean;
}): boolean {
  return input.hasAlerts && input.ios && !input.standalone && !input.alreadyShown;
}
