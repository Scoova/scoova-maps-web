# @scoova/maps

Scoova map SDK for the web. Two things in one package:

1. A thin wrapper around [`@scoova/mgl`](https://www.npmjs.com/package/@scoova/mgl)
   (`ScoovaMap`) with Scoova tile/style URLs baked in, plus `addRoute()` /
   `addMarker()` helpers for the two things every Scoova app does.
2. **Standalone static-map and style URL builders** (`staticMapUrl`,
   `staticMap`, `styleUrl`) that don't require constructing a `ScoovaMap` —
   drop them into `<img>` tags, OG share images, email templates, PDF
   receipts, or server-side renders.

## Install

```sh
npm install @scoova/maps @scoova/mgl
```

`@scoova/mgl` (Scoova's own build of MapLibre GL JS) is only needed if you
use the live `ScoovaMap` wrapper. The static-map / style URL helpers are
pure functions with no peer deps.

All gateway requests (style URLs, static maps) go through the real,
api-key-gated Scoova API gateway — never a raw, unauthenticated tile
subdomain.

## Interactive map

```ts
import maplibregl from '@scoova/mgl';
import '@scoova/mgl/dist/scoova-mgl.css';
import { ScoovaMap } from '@scoova/maps';

const map = new ScoovaMap({
  container: 'map',
  renderer: maplibregl,
  apiKey: 'sk_live_…',
  // Defaults: center Cairo, zoom 12, style 'scoova-gmaps'.
  lang: 'fr',  // optional — requests the real scoova-gmaps-fr style variant
});

map.addRoute({ coords: [[31.24, 30.04], [31.25, 30.05], [31.26, 30.06]] });
map.addMarker({ position: { lat: 30.04, lon: 31.24 } });
map.flyTo({ lat: 30.06, lon: 31.25 }, 14);
```

## Static map URL (no renderer needed)

```ts
import { staticMapUrl } from '@scoova/maps';

const url = staticMapUrl({
  apiKey: 'sk_live_…',
  style: 'scoova-gmaps',
  width: 600,
  height: 400,
  center: { lat: 30.0444, lon: 31.2357 },
  zoom: 13,
  markers: [
    { lat: 30.0444, lon: 31.2357, color: '#FF6A00' },
  ],
  paths: [
    { coordinates: [
        { lat: 30.04, lon: 31.24 },
        { lat: 30.05, lon: 31.25 },
        { lat: 30.06, lon: 31.26 },
      ], stroke: '#0EA5E9', width: 4 },
  ],
  locale: 'fr',
});

// <img src={url} width="600" height="400" />
```

Note: the static-map endpoint renders a flattened PNG, so it takes a real
`?locale=` query param for label text — there's no "per-language style
name" concept for a raster image. The live-map `styleUrl`/`ScoovaMap`
`lang` option below works differently (see next section).

## Style URL (live map without `ScoovaMap`)

```ts
import maplibregl from '@scoova/mgl';
import { styleUrl } from '@scoova/maps';

new maplibregl.Map({
  container: 'map',
  // 'scoova-gmaps' / 'scoova-gmaps-dark' have real per-language style
  // variants server-side — `lang` picks one by requesting a different
  // style *name* (scoova-gmaps-es), not a query param. 'scoova-satellite'
  // has no text labels, so `lang` is a no-op for it.
  style: styleUrl('scoova-gmaps-dark', { apiKey: 'sk_live_…', lang: 'es' }),
});
```

## API

### Live map
- `new ScoovaMap({ container, renderer, apiKey?, center?, zoom?, style?, lang? })`
  - `renderer` — the map renderer module, e.g. `import maplibregl from '@scoova/mgl'`.
  - `apiKey` — required unless `style` is `'inline'` or a full URL you built yourself.
  - `style` — a real style name (`'scoova-gmaps'`, `'scoova-gmaps-dark'`, `'scoova-satellite'`), `'default'` (alias for `'scoova-gmaps'`), `'inline'`, a full style URL, or a raw style object.
  - `MapLibre` / `locale` — deprecated aliases for `renderer` / `lang`, still supported.
- `addRoute({ coords, color?, casingColor?, alternate? })`
- `removeRoute(id?)`
- `addMarker({ position, color?, radius? })`
- `removeMarker(id?)`
- `flyTo(point, zoom?)`
- `fitBounds(points, padding?)`

### Static + style helpers
- `staticMapUrl({ style, width, height, center?, zoom?, markers?, paths?, padding?, apiKey, apiBase?, locale? }): string`
- `staticMap(opts): Promise<Blob>` — same options + fetch
- `styleUrl(styleName, { apiKey, apiBase?, lang? }): string`

### Constants & pure helpers
- `DEFAULTS` — `defaultStyle` (`'scoova-gmaps'`), `tilesUrl`, `defaultCenter`, brand colors
- `DEFAULT_API_BASE`
- `buildInlineStyle(opts)`, `routeLayerSpec(opts)`, `markerSourceSpec(opts)`

## Tests

```
npm test
```
