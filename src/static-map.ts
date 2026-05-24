/**
 * Static map URL helpers and a tiny `fetch()` wrapper.
 *
 * These functions are intentionally standalone — you do NOT need to construct
 * a {@link ScoovaMap} (which pulls in `maplibre-gl`) to build a static-map URL
 * or a tile/style URL. Drop these into image tags, OG share renderers, email
 * templates, PDF receipts, server-side rendering, etc.
 *
 * All requests go to the Scoova API gateway:
 *
 *   static map  -> https://api.scoo-va.info/api/v1/staticmap/{style}/static/{center}/{w}x{h}.png?…
 *   style URL   -> https://tiles.scoo-va.info/styles/{style}/style.json?…
 *
 * Locale: the gateway honours `?locale=` and `Accept-Language`. Since
 * `<img src=…>` has no header surface, we always tack the locale onto the
 * query string when provided.
 */
import type { LngLat } from './style.js';

export const DEFAULT_API_BASE = 'https://api.scoo-va.info/api/v1';
export const DEFAULT_TILES_BASE = 'https://tiles.scoo-va.info';

export interface StaticMapMarker {
  lat: number;
  lon: number;
  /** Hex (`#FF6A00`) or named color (`red`). */
  color?: string;
  /** Built-in icon name, e.g. `pin`, `flag`. */
  icon?: string;
}

export interface StaticMapPath {
  coordinates: LngLat[];
  /** Stroke color, hex or named. */
  stroke?: string;
  /** Line width in pixels. */
  width?: number;
}

export interface StaticMapOptions {
  /** Style name, e.g. `scoova-light`, `scoova-dark`, `scoova-satellite`. */
  style: string;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Image center. Omit (and zoom) to auto-fit markers/paths. */
  center?: LngLat;
  /** Zoom level. Required when `center` is set; ignored otherwise. */
  zoom?: number;
  /** Padding in pixels when auto-fitting markers/paths. */
  padding?: number;
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  /** API key — appended as `?api_key=…` (works for `<img src=…>`). */
  apiKey: string;
  /** Override the API base, e.g. for a self-hosted gateway. */
  apiBase?: string;
  /** BCP-47 locale (`en`, `fr`, `ar-EG`, …). Forwarded to the gateway. */
  locale?: string;
}

export interface StyleUrlOptions {
  /** API key — required by the gateway. */
  apiKey: string;
  /** Override the tiles base, default `https://tiles.scoo-va.info`. */
  tilesBase?: string;
  /** Optional BCP-47 locale to localise place labels. */
  locale?: string;
}

/** Build a static-map URL ready to drop into `<img src=…>`. Pure function — no network. */
export function staticMapUrl(opts: StaticMapOptions): string {
  const base = (opts.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (opts.padding != null) params.set('padding', String(opts.padding));
  for (const m of opts.markers ?? []) {
    const parts: string[] = [];
    if (m.color) parts.push(`color:${m.color.replace('#', '%23')}`);
    if (m.icon) parts.push(`icon:${encodeURIComponent(m.icon)}`);
    parts.push(`${m.lat},${m.lon}`);
    params.append('marker', parts.join('|'));
  }
  for (const p of opts.paths ?? []) {
    if (p.coordinates.length < 2) continue;
    const parts: string[] = [];
    if (p.stroke) parts.push(`stroke:${p.stroke.replace('#', '%23')}`);
    if (p.width != null) parts.push(`width:${p.width}`);
    for (const c of p.coordinates) parts.push(`${c.lat},${c.lon}`);
    params.append('path', parts.join('|'));
  }
  if (opts.locale) params.set('locale', opts.locale);
  params.set('api_key', opts.apiKey);

  const sizeSeg = `${opts.width}x${opts.height}`;
  const centerSeg = opts.center && opts.zoom != null
    ? `${opts.center.lon},${opts.center.lat},${opts.zoom}`
    : 'auto';
  return `${base}/staticmap/${encodeURIComponent(opts.style)}/static/${centerSeg}/${sizeSeg}.png?${params.toString()}`;
}

/** Fetch a static map and return it as a {@link Blob}. Throws on non-2xx. */
export async function staticMap(opts: StaticMapOptions): Promise<Blob> {
  const url = staticMapUrl(opts);
  const headers: Record<string, string> = {};
  if (opts.locale) headers['Accept-Language'] = opts.locale;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`staticMap: ${res.status} ${res.statusText}`);
  }
  return await res.blob();
}

/**
 * MapLibre-compatible style URL — drop straight into
 * `new maplibregl.Map({ style: styleUrl('scoova-light', { apiKey }) })`.
 */
export function styleUrl(styleName: string, opts: StyleUrlOptions): string {
  const base = (opts.tilesBase ?? DEFAULT_TILES_BASE).replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('api_key', opts.apiKey);
  if (opts.locale) params.set('locale', opts.locale);
  return `${base}/styles/${encodeURIComponent(styleName)}/style.json?${params.toString()}`;
}
