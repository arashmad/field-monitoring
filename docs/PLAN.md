# Field Monitoring (Project Plan)

## Product Goal

Help a grower manage agricultural Fields and inspect changes in vegetation over
time using Sentinel-2 observations. Connect each observation to a saved Field
boundary, acquisition date, and data-quality information so users can distinguish
possible crop changes from cloud cover or unavailable data.

This document describes the intended product, not features already implemented.
The repository currently contains the Next.js application foundation and baseline
tests. M1 is defined by [issues #1–#7](https://github.com/arashmad/field-monitoring/issues?q=is%3Aissue+M1).
M2–M10 below are a proposed sequence to refine before each milestone starts.

## MVP Scope

- Sign in and sign out of a protected application.
- Create, list, view, and update Farms owned by the current user.
- Draw a single Polygon on a MapLibre map to create a Field in a Farm.
- Store Field name, crop type, boundary, and area derived from that boundary.
- Reopen a Field and inspect its polygon and metadata on a fitted map.
- Discover Sentinel-2 observations for a Field and show acquisition dates and
  quality/availability information.
- Process usable observations into field-level NDVI summaries and raster assets.
- Inspect observation history, an NDVI time series, and dated map overlays.
- Provide clear loading, empty, validation, processing-failure, and not-found states.

Every Farm and Field operation is scoped to the authenticated owner on the server.
The first deliverable is the M1 vertical slice: sign in, create a Farm, draw and
save a Field, then reopen its geometry and metadata. Satellite monitoring follows
that slice; it is not part of issue #1 or the rest of M1.

Outside the MVP: organizations, shared ownership, role hierarchies, Farm deletion,
Field geometry editing, MultiPolygon support, GeoJSON import, user raster uploads,
replacing acquisition dates, result downloads, automated agronomic prescriptions,
and advanced anomaly detection. Ideas in [issue #9](https://github.com/arashmad/field-monitoring/issues/9)
remain candidates rather than commitments.

## Architecture Boundaries

### Next.js application

The existing `app/` directory owns routes and presentation. Server-side feature
operations will own authentication checks, input validation, and orchestration.
Presentation components must not query the database directly or bypass ownership
checks. Keep feature and data-access modules close to the application; introduce
additional layers only when an implemented feature needs them.

### Persistence

PostgreSQL with PostGIS will store relational entities and Field geometries.
Drizzle will provide application data access and versioned migrations, as planned
in [issue #2](https://github.com/arashmad/field-monitoring/issues/2).
A Field belongs to one Farm, and access to a Field follows its Farm's owner.
Validate supported Polygon geometry on the server and calculate area using an
appropriate geographic/projected calculation, rather than treating degrees as
square metres. The concrete schema and authentication provider are selected in
their implementation issues; neither is implemented by the foundation milestone.

### Maps and satellite data

MapLibre GL JS will render the base map, draw Field boundaries, and display
processed raster overlays. The server validates submitted geometry before saving
it. Satellite discovery will select dated Sentinel-2 observations intersecting a
Field and retain source identifiers and quality metadata. Cloud-masked or missing
pixels must not be represented as healthy vegetation or silently treated as zero.

### Future Python processing package

Reserve repository-root `processing/` for a future Python package alongside the
current `app/`, `tests/`, and `docs/` directories. Do not scaffold or implement it
in issue #1. The name of this repository does not make processing a UI concern:
Python will own raster reading, clipping, masking, NDVI calculation, and summary
production; Next.js will own user requests and display of stored results.

The future processing boundary will accept a Field geometry, observation/source
identifiers, and processing parameters, then produce raster asset references,
summary values, quality metadata, and a processing version. Define and version
that contract when processing is introduced. Run expensive raster work outside
interactive HTTP requests; select a job execution mechanism only when required.

### Assets and configuration

Keep raster binaries out of relational rows and Git. Store asset references and
processing metadata in PostgreSQL; choose local/S3-compatible object storage when
raster persistence is implemented. [Issue #8](https://github.com/arashmad/field-monitoring/issues/8)
lists options, not a selected provider. Avoid deployment infrastructure, queues,
and speculative services in the foundation milestone.

No environment variables are required for the current app. Add documented,
non-secret placeholders to `.env.example` when database, authentication, or storage
configuration is introduced. Keep actual credentials in ignored environment files.

### Verification

- Jest and React Testing Library: unit/component tests in `tests/unit/`.
- Playwright: local app browser tests in `tests/e2e/`, with the app server started
  automatically and Chromium, Firefox, and WebKit projects.
- ESLint and TypeScript: baseline source and configuration checks.
- Add ownership, validation, persistence, and processing tests with their features.
- Add Python tests with the processing package; do not create an empty package now.

## Milestone Roadmap M1–M10

| Milestone | Deliverable | Completion evidence |
| --- | --- | --- |
| M1 — Application foundation and Field management | Repository foundation (#1), PostgreSQL/PostGIS and Drizzle (#2), authentication (#3), Farm management (#4), Field geometry persistence (#5), map drawing (#6), and Field details (#7). | Baseline checks pass; a user can sign in, create a Farm, draw/save/reopen a Field, see its polygon and metadata, and cannot access another user's data. |
| M2 — Observation discovery | Discover dated Sentinel-2 observations intersecting saved Fields; retain source identifiers and quality metadata. | Representative Fields return ordered observations; no-data and provider-failure states are handled. |
| M3 — Processing boundary | Introduce the Python package and an explicit request/result contract for clipping and masking observations to Field geometry. | A small reference observation produces a valid clipped result; invalid inputs and unusable imagery fail clearly. |
| M4 — NDVI and quality summaries | Calculate masked NDVI and field-level summary statistics with source and processing provenance. | Reference fixtures verify NDVI values, nodata handling, valid-pixel coverage, and summaries. |
| M5 — Persistent results and execution | Persist raster assets and summaries; introduce processing status, repeat-run handling, and execution outside interactive requests. | Results can be reopened; repeat runs avoid ambiguous duplicates; failures are visible and recoverable. |
| M6 — Observation history | Add a Field observation list and NDVI time series with dates and quality indicators. | Users can inspect ordered history and distinguish valid observations from missing or unusable data. |
| M7 — Raster map inspection | Display dated NDVI overlays clipped to the Field boundary, with a legend and observation selection. | The selected date, map overlay, legend, and summary refer to the same stored result. |
| M8 — Change comparison | Compare two usable observations and expose descriptive vegetation changes without presenting them as agronomic diagnoses. | Reference comparisons verify consistent masking and units; insufficient overlap produces a clear state. |
| M9 — Reliability and access review | Harden validation, ownership isolation, failure recovery, and representative end-to-end monitoring flows. | Regression checks cover cross-user access, invalid geometry, provider failures, processing failures, and empty results. |
| M10 — MVP release readiness | Document reproducible setup, operations, backup/recovery needs, and a complete monitoring demonstration; choose minimal deployment infrastructure. | A fresh environment can run the app and processing workflow from the documentation, and the complete MVP flow passes its checks. |

Later milestones depend on the earlier contracts and data model. Adjust their
scope when real observations and user feedback expose constraints; do not build
later infrastructure merely because it appears in this roadmap.
