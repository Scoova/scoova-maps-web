/**
 * Style builders — pure data, unit-testable. The runtime `ScoovaMap` wrapper
 * passes these straight into MapLibre.
 */
import { DEFAULTS } from './defaults.js';

export interface LngLat { lon: number; lat: number; }

export interface ScoovaStyleOptions {
  /** Override the canonical style URL — usually you don't need to. */
  styleUrl?: string;
  /** Add an inline raster background source (satellite, terrain, etc.). */
  rasterUrls?: string[];
  /** Show 3D buildings layer (default: true at zoom >= 15). */
  buildings3d?: boolean;
}

/** Minimal MapLibre style spec — used only when the user asks for an inline style. */
export interface MaplibreStyleSpec {
  version: 8;
  name?: string;
  sources: Record<string, unknown>;
  layers: Array<Record<string, unknown>>;
  glyphs?: string;
  sprite?: string;
}

/** Build an inline MapLibre style spec pointing at Scoova's vector tiles. */
export function buildInlineStyle(options: ScoovaStyleOptions = {}): MaplibreStyleSpec {
  const sources: Record<string, unknown> = {
    'scoova-vector': {
      type: 'vector',
      tiles: [DEFAULTS.tilesUrl],
      minzoom: DEFAULTS.minZoom,
      maxzoom: DEFAULTS.maxZoom,
      attribution: DEFAULTS.attribution,
    },
  };

  if (options.rasterUrls?.length) {
    sources['scoova-raster'] = {
      type: 'raster',
      tiles: options.rasterUrls,
      tileSize: 256,
    };
  }

  const layers: Array<Record<string, unknown>> = [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#F8FAFC' },
    },
  ];

  if (options.rasterUrls?.length) {
    layers.push({
      id: 'raster',
      type: 'raster',
      source: 'scoova-raster',
    });
  }

  if (options.buildings3d !== false) {
    layers.push({
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'scoova-vector',
      'source-layer': 'building',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': '#E2E8F0',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    });
  }

  return { version: 8, name: 'Scoova Default', sources, layers };
}

export interface RouteLayerOptions {
  id?: string;
  /** GeoJSON LineString coords, [lon, lat] pairs. */
  coords: Array<[number, number]>;
  color?: string;
  casingColor?: string;
  width?: number;
  /** Treat as alternate (lower opacity, dashed). */
  alternate?: boolean;
}

/** A pair of MapLibre source + casing/line layers for a route polyline. */
export function routeLayerSpec(options: RouteLayerOptions) {
  const id = options.id ?? 'scoova-route';
  const color = options.color ?? (options.alternate ? DEFAULTS.colors.routeAlternate : DEFAULTS.colors.routePrimary);
  const casingColor = options.casingColor ?? DEFAULTS.colors.routeCasing;
  const width = options.width ?? 6;

  return {
    source: {
      id,
      spec: {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: options.coords },
        },
      },
    },
    casing: {
      id: `${id}-casing`,
      type: 'line',
      source: id,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': casingColor,
        'line-width': width + 3,
        'line-opacity': options.alternate ? 0.4 : 0.7,
      },
    },
    line: {
      id,
      type: 'line',
      source: id,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-width': width,
        'line-opacity': options.alternate ? 0.6 : 1.0,
        ...(options.alternate ? { 'line-dasharray': [2, 2] } : {}),
      },
    },
  };
}

export interface MarkerSourceOptions {
  id?: string;
  position: LngLat;
  /** Properties exposed for popup/tooltip rendering. */
  properties?: Record<string, unknown>;
}

export function markerSourceSpec(options: MarkerSourceOptions) {
  const id = options.id ?? 'scoova-marker';
  return {
    id,
    spec: {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: options.properties ?? {},
        geometry: {
          type: 'Point',
          coordinates: [options.position.lon, options.position.lat],
        },
      },
    },
  };
}
