/**
 * `ScoovaMap` — thin wrapper around `@scoova/mgl`'s `Map` that bakes in
 * Scoova defaults (tile URL, style URL, attribution, brand colors) and
 * ships `addRoute()` / `addMarker()` helpers so apps don't have to
 * hand-roll layer specs.
 *
 * `@scoova/mgl` is a peer dependency. The constructor accepts the renderer
 * module via DI so callers stay in control of the import path (and so the
 * style/route/marker helpers stay testable without a DOM).
 */
import { DEFAULTS } from './defaults.js';
import { buildInlineStyle, routeLayerSpec, markerSourceSpec, type ScoovaStyleOptions, type RouteLayerOptions, type MarkerSourceOptions, type LngLat } from './style.js';
import { styleUrl } from './static-map.js';

/** Subset of the map renderer we need — typed structurally to avoid pulling in the dependency at compile time. */
export interface RendererLike {
  Map: new (opts: unknown) => MaplibreMap;
}
/** @deprecated Renamed to {@link RendererLike}. Same shape, kept as an alias so existing type annotations still compile. */
export type MaplibreLike = RendererLike;

export interface MaplibreMap {
  on(event: string, cb: (...args: unknown[]) => void): MaplibreMap;
  addSource(id: string, source: unknown): MaplibreMap;
  removeSource(id: string): MaplibreMap;
  getSource(id: string): unknown | undefined;
  addLayer(layer: unknown): MaplibreMap;
  removeLayer(id: string): MaplibreMap;
  getLayer(id: string): unknown | undefined;
  flyTo(opts: unknown): MaplibreMap;
  fitBounds(bounds: unknown, opts?: unknown): MaplibreMap;
  remove(): void;
  isStyleLoaded(): boolean;
}

export interface ScoovaMapOptions {
  /** A DOM container element (or its id). */
  container: HTMLElement | string;
  /** Inject the map renderer module — `import maplibregl from '@scoova/mgl'`. */
  renderer: RendererLike;
  /** @deprecated Use `renderer`. Same value, kept so existing callers don't break. */
  MapLibre?: RendererLike;
  /**
   * API key for the tiles gateway. Required unless `style` is `'inline'` or
   * you pass a fully-formed URL/object yourself (in which case you're
   * responsible for auth).
   */
  apiKey?: string;
  /** Initial center, defaults to Cairo. */
  center?: LngLat;
  /** Initial zoom, defaults to 12. */
  zoom?: number;
  /** Initial bearing in degrees clockwise from north. */
  bearing?: number;
  /** Initial pitch in degrees, 0–60. */
  pitch?: number;
  /**
   * A real Scoova style name (`'scoova-gmaps'`, `'scoova-gmaps-dark'`,
   * `'scoova-satellite'`), `'default'` (alias for `'scoova-gmaps'`),
   * `'inline'` (build a style from `inlineStyleOptions`), a full style
   * URL string, or a raw style spec object.
   */
  style?: 'default' | 'inline' | string | object;
  inlineStyleOptions?: ScoovaStyleOptions;
  /**
   * Site language (`en`, `ar`, `fr`, …). For `scoova-gmaps` /
   * `scoova-gmaps-dark` this requests the real per-language style variant
   * server-side — not a query param, since the label text lives in a
   * different style document per language. Only applied when `style`
   * resolves to one of those two style names.
   */
  lang?: string;
  /** @deprecated Renamed to `lang` — same meaning, kept so existing callers don't break. */
  locale?: string;
  /** Forward any other valid renderer Map options. */
  maplibreOptions?: Record<string, unknown>;
}

export class ScoovaMap {
  readonly map: MaplibreMap;
  private routeIds = new Set<string>();
  private markerIds = new Set<string>();

  constructor(options: ScoovaMapOptions) {
    const renderer = options.renderer ?? options.MapLibre;
    if (!renderer) throw new Error('ScoovaMap: pass `renderer` (the map renderer module, e.g. `import maplibregl from \'@scoova/mgl\'`).');
    const lang = options.lang ?? options.locale;
    const center = options.center ?? DEFAULTS.defaultCenter;

    let style: string | object;
    if (options.style === 'inline') {
      style = buildInlineStyle(options.inlineStyleOptions);
    } else if (typeof options.style === 'object') {
      style = options.style; // raw style spec — caller's own responsibility
    } else if (typeof options.style === 'string' && /^https?:\/\//.test(options.style)) {
      style = options.style; // fully-formed URL — caller's own responsibility (including auth)
    } else {
      // undefined, 'default', or a real Scoova style name.
      const styleName = options.style === undefined || options.style === 'default'
        ? DEFAULTS.defaultStyle
        : options.style;
      if (!options.apiKey) {
        throw new Error(`ScoovaMap: 'apiKey' is required to resolve the '${styleName}' style. Pass a full style URL yourself if you're not using the Scoova gateway.`);
      }
      style = styleUrl(styleName, { apiKey: options.apiKey, lang });
    }

    const opts = {
      container: options.container,
      style,
      center: [center.lon, center.lat],
      zoom: options.zoom ?? DEFAULTS.defaultZoom,
      bearing: options.bearing ?? 0,
      pitch: options.pitch ?? 0,
      attributionControl: { customAttribution: DEFAULTS.attribution },
      ...(options.maplibreOptions ?? {}),
    };
    this.map = new renderer.Map(opts);
  }

  /** Draw a route polyline. Idempotent: re-adding with the same id replaces. */
  addRoute(options: RouteLayerOptions): string {
    const spec = routeLayerSpec(options);
    const id = spec.source.id;
    if (this.map.getSource(id)) this.removeRoute(id);
    this.map.addSource(id, spec.source.spec);
    this.map.addLayer(spec.casing);
    this.map.addLayer(spec.line);
    this.routeIds.add(id);
    return id;
  }

  removeRoute(id = 'scoova-route'): void {
    if (this.map.getLayer(id)) this.map.removeLayer(id);
    if (this.map.getLayer(`${id}-casing`)) this.map.removeLayer(`${id}-casing`);
    if (this.map.getSource(id)) this.map.removeSource(id);
    this.routeIds.delete(id);
  }

  /** Drop a marker via a circle layer (no DOM marker — works fine in headless tests). */
  addMarker(options: MarkerSourceOptions & { color?: string; radius?: number }): string {
    const spec = markerSourceSpec(options);
    const id = spec.id;
    if (this.map.getSource(id)) this.removeMarker(id);
    this.map.addSource(id, spec.spec);
    this.map.addLayer({
      id,
      type: 'circle',
      source: id,
      paint: {
        'circle-radius': options.radius ?? 8,
        'circle-color': options.color ?? DEFAULTS.colors.markerFill,
        'circle-stroke-width': 2,
        'circle-stroke-color': DEFAULTS.colors.markerStroke,
      },
    });
    this.markerIds.add(id);
    return id;
  }

  removeMarker(id = 'scoova-marker'): void {
    if (this.map.getLayer(id)) this.map.removeLayer(id);
    if (this.map.getSource(id)) this.map.removeSource(id);
    this.markerIds.delete(id);
  }

  /** Smoothly center the map on a point. */
  flyTo(point: LngLat, zoom?: number): void {
    this.map.flyTo({
      center: [point.lon, point.lat],
      zoom: zoom ?? DEFAULTS.defaultZoom,
      essential: true,
    });
  }

  /** Fit camera to the bounding box of an array of points. */
  fitBounds(points: LngLat[], padding = 60): void {
    if (!points.length) return;
    let minLon = points[0].lon, maxLon = points[0].lon;
    let minLat = points[0].lat, maxLat = points[0].lat;
    for (const p of points) {
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }
    this.map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding });
  }

  destroy(): void {
    this.map.remove();
    this.routeIds.clear();
    this.markerIds.clear();
  }
}
