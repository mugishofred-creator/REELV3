/**
 * Files in /public are not prefixed with the deployment's base path, and an
 * unoptimized <Image> passes its src through untouched — so on a subpath host
 * (GitHub Pages) every asset URL has to carry the prefix itself.
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${base}${path}`;
}
