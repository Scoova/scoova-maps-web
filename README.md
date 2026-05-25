# @scoova/maps

Scoova map SDK for the web. Two things in one package:

1. A thin wrapper around **MapLibre GL JS** (`ScoovaMap`) with Scoova
   tile/style URLs baked in, plus `addRoute()` / `addMarker()` helpers for the
   two things every Scoova app does.
2. **Standalone static-map and style URL builders** (`staticMapUrl`,
   `staticMap`, `styleUrl`) that don't require constructing a `ScoovaMap` —
   drop them into `<img>` tags, OG share images, email templates, PDF
   receipts, or server-side renders.

## Install

```sh
npm install @scoova/maps maplibre-gl
```

`maplibre-gl` is only needed if you use the live `ScoovaMap` wrapper. The
static-map / style URL helpers are pure functions with no peer deps.

## Interactive map

```ts
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ScoovaMap } from '@scoova/maps';

const map = new ScoovaMap({
  container: 'map',
  MapLibre: maplibregl,
  // Defaults: center Cairo, zoom 12, Scoova default style.
  locale: 'fr',  // optional — localises place labels via ?locale=fr
});

map.addRoute({ coords: [[31.24, 30.04], [31.25, 30.05], [31.26, 30.06]] });
map.addMarker({ position: { lat: 30.04, lon: 31.24 } });
map.flyTo({ lat: 30.06, lon: 31.25 }, 14);
```

## Static map URL (no MapLibre needed)

```ts
import { staticMapUrl } from '@scoova/maps';

const url = staticMapUrl({
  apiKey: 'sk_live_…',
  style: 'scoova-light',
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

## Style URL (live MapLibre map without `ScoovaMap`)

```ts
import maplibregl from 'maplibre-gl';
import { styleUrl } from '@scoova/maps';

new maplibregl.Map({
  container: 'map',
  style: styleUrl('scoova-dark', { apiKey: 'sk_live_…', locale: 'es' }),
});
```

## API

### Live map
- `new ScoovaMap({ container, MapLibre, center?, zoom?, style?, locale? })`
- `addRoute({ coords, color?, casingColor?, alternate? })`
- `removeRoute(id?)`
- `addMarker({ position, color?, radius? })`
- `removeMarker(id?)`
- `flyTo(point, zoom?)`
- `fitBounds(points, padding?)`

### Static + style helpers
- `staticMapUrl({ style, width, height, center?, zoom?, markers?, paths?, padding?, apiKey, apiBase?, locale? }): string`
- `staticMap(opts): Promise<Blob>` — same options + fetch
- `styleUrl(styleName, { apiKey, tilesBase?, locale? }): string`

### Constants & pure helpers
- `DEFAULTS` — `styleUrl`, `tilesUrl`, `defaultCenter`, brand colors
- `DEFAULT_API_BASE`, `DEFAULT_TILES_BASE`
- `buildInlineStyle(opts)`, `routeLayerSpec(opts)`, `markerSourceSpec(opts)`

## Tests

```
npm test
```
