/**
 * Scoova map defaults — keep all five SDKs (web, RN, Flutter, iOS, Android)
 * pointing at the same endpoints.
 */
export const DEFAULTS = {
  /** Real, built-in style name resolved via the api-key-gated gateway —
   * see styleUrl() in static-map.ts. Not a fixed URL: 'default' used to
   * point at a single hardcoded, unauthenticated tiles.scoo-va.info URL
   * that didn't match how the gateway actually serves styles. */
  defaultStyle: 'scoova-gmaps',
  tilesUrl: 'https://tiles.scoo-va.info/v1/{z}/{x}/{y}.mvt',
  pmtilesUrl: 'pmtiles://https://tiles.scoo-va.info/world.pmtiles',
  attribution: '© Scoova · OpenStreetMap contributors',
  /** Cairo, Egypt — Scoova's launch city. */
  defaultCenter: { lat: 30.0444, lon: 31.2357 },
  defaultZoom: 12,
  minZoom: 0,
  maxZoom: 22,
  /** Scoova brand colors used in built-in route + marker styles. */
  colors: {
    routePrimary: '#0EA5E9',
    routeCasing: '#0369A1',
    routeAlternate: '#94A3B8',
    routeProgress: '#10B981',
    markerFill: '#0EA5E9',
    markerStroke: '#FFFFFF',
  },
} as const;

export type ScoovaColors = typeof DEFAULTS.colors;
