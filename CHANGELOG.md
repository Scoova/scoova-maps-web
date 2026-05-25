# Changelog

All notable changes to `@scoova/maps` are documented in this file. This
project follows [Semantic Versioning](https://semver.org/).

## 1.1.0 — 2026-05-25

### Added
- `staticMapUrl(opts)` — pure URL builder for the static-map endpoint, ready
  to drop into an `<img src=…>` tag.
- `staticMap(opts)` — `Promise<Blob>` convenience for fetching the rendered
  PNG (and propagating `Accept-Language`).
- `styleUrl(styleName, { apiKey, locale? })` — Scoova-compatible style URL
  builder. Doesn't require constructing a `ScoovaMap`.
- `locale` option on `ScoovaMap` — appended to the resolved style URL as
  `?locale=…`, matching the gateway's locale resolution.
- `DEFAULT_API_BASE`, `DEFAULT_TILES_BASE` exports for overriding in tests
  or self-hosted gateway deployments.
- LICENSE (Apache-2.0) and CHANGELOG.

### Changed
- License is now Apache-2.0 (was MIT).

## 1.0.0 — 2026-05-05

- Initial release: `ScoovaMap` wrapper around MapLibre GL JS with Scoova
  defaults; `buildInlineStyle`, `routeLayerSpec`, `markerSourceSpec`
  helpers; `addRoute` / `addMarker` / `flyTo` / `fitBounds` convenience
  methods.
