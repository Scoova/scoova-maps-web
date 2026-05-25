# @scoova/maps — Cross-platform Parity

Five SDKs, one shape. Each ships:

1. The Scoova **defaults** (style URL, tile URL, default center, brand colors).
2. An **inline style builder** — a v8 MapLibre style spec pointing at our vector tiles.
3. **Feature builders** for routes (`routeFeature`/`routeLayerSpec`) and markers
   (`markerFeature`/`markerSourceSpec`) so apps don't hand-roll layer JSON.
4. **`bboxOf(points)`** — bounds for `fitBounds`.
5. The **rendering wrapper** is platform-native: MapLibre GL JS on the web, the
   @maplibre/maplibre-react-native package on RN, maplibre_gl on Flutter, MapLibre Native
   iOS on Swift, MapLibre Native Android on Kotlin. Each SDK is a thin layer on
   top — apps install the renderer themselves so they keep version control.

| Platform     | Package / Path                                                | Renderer pairing                                | Tests   |
|--------------|---------------------------------------------------------------|-------------------------------------------------|---------|
| Web (TS)     | `@scoova/maps` — `/scoova-maps-web`                           | maplibre-gl (peerDep, 3+)                       | 13 ✅   |
| React Native | `@scoova/maps-react-native` — `/scoova-maps-react-native`     | `@MapLibre/@maplibre/maplibre-react-native` (peerDep)     | 8 ✅    |
| Flutter      | `scoova_maps` — `/scoova_maps_flutter`                        | maplibre_gl (consumer's choice)                 | 9 ✅    |
| iOS Swift    | `ScoovaMapKit` — `/ScoovaMapKit`                              | MapLibre Native iOS (`MLNMapView`)              | 9 ✅    |
| Android JVM  | `info.scoo-va:scoova-maps` — `/scoova-maps-android`           | MapLibre Native Android (`org.MapLibre.android`) | 9 ✅    |

## Common surface

```
ScoovaMapDefaults / DEFAULTS
  styleUrl          → "https://tiles.scoo-va.info/style.json"
  tilesUrl          → "https://tiles.scoo-va.info/v1/{z}/{x}/{y}.mvt"
  defaultCenter     → {lat: 30.0444, lon: 31.2357}    (Cairo)
  defaultZoom       → 12
  colors            → routePrimary / routeCasing / routeAlternate /
                      routeProgress / markerFill / markerStroke

buildInlineStyle(options)            → v8 style spec (JSON)
routeFeature(coords, options)        → { shape, casingPaint, linePaint }
markerFeature(latLng, options)       → { shape, circlePaint }
bboxOf(points)                       → [[minLon, minLat], [maxLon, maxLat]]
```

## Why a thin wrapper instead of a custom renderer

The audited workspace had four partial map renderer attempts (custom WebGL
`scoovamap-sdk`, the 1 GB `scoova-map` MapLibre fork, the empty
`ScoovaMapCompose`, and the `ScoovaMapSDK` MapLibre Native fork). All but
`scoovamap-sdk` were stuck at scaffolding. Rather than try to finish a custom
renderer in a single session, this SDK family **standardizes on MapLibre on
every platform** and concentrates Scoova-specific work in style, route, and
marker helpers — the part apps actually need consistent across platforms.

If/when the custom renderer is ready, the public surface here doesn't change:
swap the underlying renderer for ScoovaGL on web (or the Bazel-built
`ScoovaMapSDK` on mobile) and the same `routeFeature` / `markerFeature` /
`buildInlineStyle` helpers keep working.
