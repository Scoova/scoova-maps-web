/**
 * Static map URL helpers and a tiny `fetch()` wrapper.
 *
 * These functions are intentionally standalone — you do NOT need to construct
 * a {@link ScoovaMap} (which pulls in `@scoova/mgl`) to build a static-map
 * URL or a tile/style URL. Drop these into image tags, OG share renderers,
 * email templates, PDF receipts, server-side rendering, etc.
 *
 * All requests go through the Scoova API gateway (api-key gated, metered,
 * rate-limited) — never the raw tile host directly. An earlier version of
 * this file pointed style URLs at a raw `tiles.scoo-va.info` subdomain,
 * which an internal security audit already flagged as unauthenticated —
 * publishing that pattern in a public SDK would have taught every
 * integrator to bypass the api-key system entirely. Fixed to match the
 * one real, confirmed-working path (same one every other Scoova client
 * uses):
 *
 *   static map  -> https://api.scoo-va.info/api/v1/staticmap/{style}/static/{center}/{w}x{h}.png?…
 *   style URL   -> https://api.scoo-va.info/api/v1/tiles/styles/{style}/style.json?…
 *
 * Locale: NOT a `?locale=` query param on the style URL — the gateway
 * serves per-language label variants as separate named styles
 * (`scoova-gmaps-ar`, `scoova-gmaps-fr`, …), so localizing means
 * requesting a different style name, not a different query string. Only
 * `scoova-gmaps` and `scoova-gmaps-dark` have language variants;
 * `scoova-satellite` has no text labels, so it's passed through
 * unchanged regardless of locale. The static-map endpoint is separate
 * and does take `?locale=` for label rendering inside the raster image
 * (there's no "different style name" concept for a flattened PNG).
 */
import type { LngLat } from './style.js';

export const DEFAULT_API_BASE = 'https://api.scoo-va.info/api/v1';
/** Style names whose label layers have real per-language variants server-side. */
const LOCALIZED_STYLES = ['scoova-gmaps', 'scoova-gmaps-dark'];

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
  /** Style name, e.g. `scoova-gmaps`, `scoova-gmaps-dark`, `scoova-satellite`. */
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
  /** Override the API base, e.g. for a self-hosted gateway. */
  apiBase?: string;
  /**
   * Site language (`en`, `ar`, `fr`, …) to localise place labels. For
   * `scoova-gmaps` / `scoova-gmaps-dark` this selects a real per-language
   * style variant server-side (`{style}-{lang}`) — it is not a query
   * param, because the label text itself lives in a different style
   * document per language, not a runtime-swappable field. Styles without
   * language variants (`scoova-satellite`) ignore this.
   */
  lang?: string;
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
 * Scoova-compatible style URL — drop straight into
 * `new maplibregl.Map({ style: styleUrl('scoova-gmaps', { apiKey }) })`.
 *
 * Real, built-in style names: `scoova-gmaps`, `scoova-gmaps-dark`,
 * `scoova-satellite`. Any other string is passed through unchanged (a
 * self-hosted or custom style name), so this stays forward-compatible
 * with new styles added server-side without an SDK release.
 */
export function styleUrl(styleName: string, opts: StyleUrlOptions): string {
  const base = (opts.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, '');
  const resolvedName = opts.lang && LOCALIZED_STYLES.includes(styleName)
    ? `${styleName}-${opts.lang}`
    : styleName;
  const params = new URLSearchParams();
  params.set('api_key', opts.apiKey);
  return `${base}/tiles/styles/${encodeURIComponent(resolvedName)}/style.json?${params.toString()}`;
}
