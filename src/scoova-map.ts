/**
 * `ScoovaMap` — thin wrapper around `maplibre-gl`'s `Map` that bakes in Scoova
 * defaults (tile URL, style URL, attribution, brand colors) and ships
 * `addRoute()` / `addMarker()` helpers so apps don't have to hand-roll layer
 * specs.
 *
 * `maplibre-gl` is a peer dependency. The constructor accepts the MapLibre
 * module via DI so callers stay in control of the import path (and so the
 * style/route/marker helpers stay testable without a DOM).
 */
import { DEFAULTS } from './defaults.js';
import { buildInlineStyle, routeLayerSpec, markerSourceSpec, type ScoovaStyleOptions, type RouteLayerOptions, type MarkerSourceOptions, type LngLat } from './style.js';

/** Subset of maplibre-gl that we need — typed structurally to avoid pulling in the dep at compile time. */
export interface MaplibreLike {
  Map: new (opts: unknown) => MaplibreMap;
}

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
  /** Inject the maplibre-gl module — `import maplibregl from 'maplibre-gl'`. */
  MapLibre: MaplibreLike;
  /** Initial center, defaults to Cairo. */
  center?: LngLat;
  /** Initial zoom, defaults to 12. */
  zoom?: number;
  /** Initial bearing in degrees clockwise from north. */
  bearing?: number;
  /** Initial pitch in degrees, 0–60. */
  pitch?: number;
  /** Use the canonical Scoova style URL (default), or an inline style spec. */
  style?: 'default' | 'inline' | string | object;
  inlineStyleOptions?: ScoovaStyleOptions;
  /**
   * BCP-47 locale (`en`, `fr`, `ar-EG`, …) appended to the resolved style URL
   * as `?locale=…`. Only applied when `style` is `undefined`/`'default'` or
   * resolves to a string URL.
   */
  locale?: string;
  /** Forward any other valid maplibre-gl Map options. */
  maplibreOptions?: Record<string, unknown>;
}

export class ScoovaMap {
  readonly map: MaplibreMap;
  private routeIds = new Set<string>();
  private markerIds = new Set<string>();

  constructor(options: ScoovaMapOptions) {
    const center = options.center ?? DEFAULTS.defaultCenter;
    const resolved =
      options.style === 'inline' ? buildInlineStyle(options.inlineStyleOptions) :
      options.style === undefined || options.style === 'default' ? DEFAULTS.styleUrl :
      options.style;
    const style = (typeof resolved === 'string' && options.locale)
      ? appendQuery(resolved, 'locale', options.locale)
      : resolved;

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
    this.map = new options.MapLibre.Map(opts);
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

/** Append/overwrite a single query param on an absolute or relative URL. */
function appendQuery(url: string, key: string, value: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
