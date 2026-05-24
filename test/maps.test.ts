import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULTS,
  buildInlineStyle,
  routeLayerSpec,
  markerSourceSpec,
  ScoovaMap,
  staticMapUrl,
  staticMap,
  styleUrl,
  DEFAULT_API_BASE,
  DEFAULT_TILES_BASE,
  type MaplibreLike,
  type MaplibreMap,
} from '../src/index.js';

describe('DEFAULTS', () => {
  it('points at scoo-va.info', () => {
    expect(DEFAULTS.styleUrl).toBe('https://tiles.scoo-va.info/style.json');
    expect(DEFAULTS.tilesUrl).toBe('https://tiles.scoo-va.info/v1/{z}/{x}/{y}.mvt');
    expect(DEFAULTS.defaultCenter.lat).toBeCloseTo(30.0444);
    expect(DEFAULTS.defaultCenter.lon).toBeCloseTo(31.2357);
  });
});

describe('buildInlineStyle', () => {
  it('produces a valid v8 style with the Scoova vector source', () => {
    const style = buildInlineStyle();
    expect(style.version).toBe(8);
    const src = style.sources['scoova-vector'] as Record<string, unknown>;
    expect(src.type).toBe('vector');
    expect(src.tiles).toEqual([DEFAULTS.tilesUrl]);
    expect(style.layers.find((l) => l.id === 'background')).toBeDefined();
    expect(style.layers.find((l) => l.id === 'buildings-3d')).toBeDefined();
  });

  it('omits buildings-3d when disabled', () => {
    const style = buildInlineStyle({ buildings3d: false });
    expect(style.layers.find((l) => l.id === 'buildings-3d')).toBeUndefined();
  });

  it('adds a raster layer when raster URLs are supplied', () => {
    const style = buildInlineStyle({ rasterUrls: ['https://example.test/{z}/{x}/{y}.png'] });
    expect(style.sources['scoova-raster']).toBeDefined();
    expect(style.layers.find((l) => l.id === 'raster')).toBeDefined();
  });
});

describe('routeLayerSpec', () => {
  it('builds source + casing + line layers with brand colors', () => {
    const spec = routeLayerSpec({ coords: [[31.24, 30.04], [31.25, 30.05]] });
    expect(spec.source.id).toBe('scoova-route');
    const data = (spec.source.spec as { data: { geometry: { coordinates: unknown } } }).data;
    expect(data.geometry.coordinates).toEqual([[31.24, 30.04], [31.25, 30.05]]);
    expect((spec.line.paint as Record<string, unknown>)['line-color']).toBe(DEFAULTS.colors.routePrimary);
    expect((spec.casing.paint as Record<string, unknown>)['line-color']).toBe(DEFAULTS.colors.routeCasing);
  });

  it('uses alternate styling when alternate=true', () => {
    const spec = routeLayerSpec({ coords: [[0, 0], [1, 1]], alternate: true });
    expect((spec.line.paint as Record<string, unknown>)['line-color']).toBe(DEFAULTS.colors.routeAlternate);
    expect((spec.line.paint as Record<string, unknown>)['line-dasharray']).toEqual([2, 2]);
  });
});

describe('markerSourceSpec', () => {
  it('produces a Point geojson source', () => {
    const spec = markerSourceSpec({ position: { lon: 31.24, lat: 30.04 }, properties: { name: 'X' } });
    expect(spec.id).toBe('scoova-marker');
    const data = (spec.spec as { data: { geometry: { type: string; coordinates: number[] }; properties: Record<string, unknown> } }).data;
    expect(data.geometry.type).toBe('Point');
    expect(data.geometry.coordinates).toEqual([31.24, 30.04]);
    expect(data.properties.name).toBe('X');
  });
});

// ─── ScoovaMap with a fake maplibre ─────────────────────────────────────────

function fakeMaplibre(): { lib: MaplibreLike; instances: FakeMap[]; lastOpts: () => unknown } {
  const instances: FakeMap[] = [];
  let lastOpts: unknown = null;
  const lib: MaplibreLike = {
    Map: class {
      constructor(opts: unknown) {
        lastOpts = opts;
        const m = new FakeMap();
        instances.push(m);
        return m as unknown as MaplibreMap;
      }
    } as unknown as MaplibreLike['Map'],
  };
  return { lib, instances, lastOpts: () => lastOpts };
}

class FakeMap implements MaplibreMap {
  sources = new Map<string, unknown>();
  layers = new Map<string, unknown>();
  flyToCalls: unknown[] = [];
  fitBoundsCalls: unknown[] = [];
  removed = false;

  on(): MaplibreMap { return this; }
  addSource(id: string, source: unknown) { this.sources.set(id, source); return this; }
  removeSource(id: string) { this.sources.delete(id); return this; }
  getSource(id: string) { return this.sources.get(id); }
  addLayer(layer: unknown) {
    const l = layer as { id: string };
    this.layers.set(l.id, layer);
    return this;
  }
  removeLayer(id: string) { this.layers.delete(id); return this; }
  getLayer(id: string) { return this.layers.get(id); }
  flyTo(opts: unknown) { this.flyToCalls.push(opts); return this; }
  fitBounds(bounds: unknown, opts?: unknown) { this.fitBoundsCalls.push({ bounds, opts }); return this; }
  remove() { this.removed = true; }
  isStyleLoaded() { return true; }
}

describe('ScoovaMap', () => {
  it('passes Cairo + zoom 12 + Scoova style URL by default', () => {
    const fake = fakeMaplibre();
    new ScoovaMap({ container: 'map', maplibre: fake.lib });
    const opts = fake.lastOpts() as { center: [number, number]; zoom: number; style: string };
    expect(opts.center).toEqual([DEFAULTS.defaultCenter.lon, DEFAULTS.defaultCenter.lat]);
    expect(opts.zoom).toBe(12);
    expect(opts.style).toBe(DEFAULTS.styleUrl);
  });

  it('passes the inline style spec when style="inline"', () => {
    const fake = fakeMaplibre();
    new ScoovaMap({ container: 'map', maplibre: fake.lib, style: 'inline' });
    const opts = fake.lastOpts() as { style: { version: number } };
    expect(opts.style.version).toBe(8);
  });

  it('addRoute adds a source + casing + line layer', () => {
    const fake = fakeMaplibre();
    const sm = new ScoovaMap({ container: 'map', maplibre: fake.lib });
    sm.addRoute({ coords: [[31.24, 30.04], [31.25, 30.05]] });
    const m = fake.instances[0];
    expect(m.sources.has('scoova-route')).toBe(true);
    expect(m.layers.has('scoova-route')).toBe(true);
    expect(m.layers.has('scoova-route-casing')).toBe(true);
  });

  it('removeRoute clears source + both layers', () => {
    const fake = fakeMaplibre();
    const sm = new ScoovaMap({ container: 'map', maplibre: fake.lib });
    sm.addRoute({ coords: [[31.24, 30.04], [31.25, 30.05]] });
    sm.removeRoute();
    const m = fake.instances[0];
    expect(m.sources.has('scoova-route')).toBe(false);
    expect(m.layers.has('scoova-route')).toBe(false);
    expect(m.layers.has('scoova-route-casing')).toBe(false);
  });

  it('addMarker adds a circle layer at the right coords', () => {
    const fake = fakeMaplibre();
    const sm = new ScoovaMap({ container: 'map', maplibre: fake.lib });
    sm.addMarker({ position: { lat: 30.04, lon: 31.24 } });
    const m = fake.instances[0];
    expect(m.layers.has('scoova-marker')).toBe(true);
    const layer = m.layers.get('scoova-marker') as { type: string };
    expect(layer.type).toBe('circle');
  });

  it('flyTo + fitBounds proxy through to maplibre', () => {
    const fake = fakeMaplibre();
    const sm = new ScoovaMap({ container: 'map', maplibre: fake.lib });
    sm.flyTo({ lat: 30.04, lon: 31.24 }, 14);
    sm.fitBounds([{ lat: 30, lon: 31 }, { lat: 31, lon: 32 }]);
    const m = fake.instances[0];
    expect(m.flyToCalls).toHaveLength(1);
    expect((m.flyToCalls[0] as { center: [number, number] }).center).toEqual([31.24, 30.04]);
    expect(m.fitBoundsCalls).toHaveLength(1);
    expect((m.fitBoundsCalls[0] as { bounds: [number[], number[]] }).bounds)
      .toEqual([[31, 30], [32, 31]]);
  });

  it('appends ?locale=… to the style URL when locale is passed', () => {
    const fake = fakeMaplibre();
    new ScoovaMap({ container: 'map', maplibre: fake.lib, locale: 'fr' });
    const opts = fake.lastOpts() as { style: string };
    expect(typeof opts.style).toBe('string');
    expect(opts.style).toContain('locale=fr');
  });
});

// ─── Static map URL builder ─────────────────────────────────────────────────

describe('staticMapUrl', () => {
  it('builds an explicit-center URL pointing at the API gateway', () => {
    const url = staticMapUrl({
      apiKey: 'k123',
      style: 'scoova-light',
      width: 600,
      height: 400,
      center: { lat: 30.0444, lon: 31.2357 },
      zoom: 13,
    });
    expect(url.startsWith(`${DEFAULT_API_BASE}/staticmap/scoova-light/static/`)).toBe(true);
    expect(url).toContain('/static/31.2357,30.0444,13/');
    expect(url).toContain('600x400.png');
    expect(url).toContain('api_key=k123');
  });

  it('uses /auto/ when no center is supplied', () => {
    const url = staticMapUrl({
      apiKey: 'k', style: 'scoova-dark', width: 100, height: 100,
      markers: [{ lat: 30, lon: 31 }],
    });
    expect(url).toContain('/static/auto/');
  });

  it('serialises markers with color + icon', () => {
    const url = staticMapUrl({
      apiKey: 'k', style: 's', width: 1, height: 1,
      markers: [{ lat: 30, lon: 31, color: '#FF6A00', icon: 'pin' }],
    });
    // Hex `#` is encoded as %23 by our builder
    expect(url).toContain('marker=color%3A%2523FF6A00%7Cicon%3Apin%7C30%2C31');
  });

  it('serialises paths and skips ones with < 2 coords', () => {
    const url = staticMapUrl({
      apiKey: 'k', style: 's', width: 1, height: 1,
      paths: [
        { coordinates: [{ lat: 30, lon: 31 }, { lat: 31, lon: 32 }], stroke: '#0EA5E9', width: 4 },
        { coordinates: [{ lat: 0, lon: 0 }] }, // skipped
      ],
    });
    expect(url).toContain('path=stroke%3A%25230EA5E9%7Cwidth%3A4%7C30%2C31%7C31%2C32');
    expect((url.match(/path=/g) ?? []).length).toBe(1);
  });

  it('includes locale when supplied', () => {
    const url = staticMapUrl({
      apiKey: 'k', style: 's', width: 1, height: 1, locale: 'ar-EG',
    });
    expect(url).toContain('locale=ar-EG');
  });

  it('respects apiBase override and strips a trailing slash', () => {
    const url = staticMapUrl({
      apiKey: 'k', style: 's', width: 1, height: 1,
      apiBase: 'https://gateway.example.test/api/v1/',
    });
    expect(url.startsWith('https://gateway.example.test/api/v1/staticmap/')).toBe(true);
  });
});

describe('staticMap (fetch wrapper)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    fetchMock.mockReset();
  });

  it('forwards Accept-Language when locale is set and returns a Blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', blob: () => Promise.resolve(blob) });
    const out = await staticMap({
      apiKey: 'k', style: 's', width: 1, height: 1, locale: 'fr',
    });
    expect(out).toBe(blob);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['Accept-Language']).toBe('fr');
  });

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden', blob: () => Promise.resolve(new Blob()) });
    await expect(staticMap({ apiKey: 'k', style: 's', width: 1, height: 1 }))
      .rejects.toThrow(/403 Forbidden/);
  });
});

describe('styleUrl', () => {
  it('points at tiles.scoo-va.info by default', () => {
    const url = styleUrl('scoova-light', { apiKey: 'k' });
    expect(url.startsWith(`${DEFAULT_TILES_BASE}/styles/scoova-light/style.json?`)).toBe(true);
    expect(url).toContain('api_key=k');
  });

  it('includes locale and supports tilesBase override', () => {
    const url = styleUrl('scoova-dark', {
      apiKey: 'k',
      locale: 'pt-BR',
      tilesBase: 'https://my-tiles.example.test/',
    });
    expect(url.startsWith('https://my-tiles.example.test/styles/scoova-dark/style.json?')).toBe(true);
    expect(url).toContain('locale=pt-BR');
  });
});
