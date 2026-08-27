import { ui, locales } from "./ui";
import type { Locale } from "./ui";

export type { Locale } from "./ui";

export function translate(locale: Locale) {
  const dict = ui[locale];
  return (key: keyof typeof ui.zh, vars?: Record<string, string | number>) => {
    let str = dict[key] as string;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };
}

/** Convert a path to another locale. All locales are prefixed (prefixDefaultLocale). */
export function getPathByLocale(
  pathname: string,
  from: Locale,
  to: Locale
): string {
  const rest = getLocalizedPath(pathname, from);
  return `/${to}${rest}`;
}

/** The path of the modifiable route (without lang prefix), default '' => home. */
export function getLocalizedPath(pathname: string, locale: Locale): string {
  const segments = (pathname.split("/") || []).filter(Boolean);
  const known = new Set(locales.map((l) => l.code));
  if (known.has(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return pathname;
}