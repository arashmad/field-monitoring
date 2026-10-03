# Architecture and processing boundaries

## Status and authority

[PLAN.md](PLAN.md) owns architecture direction, MVP scope, and delivery order.
This document records responsibilities, rationale, and intended contracts without
claiming future components are implemented. [PRODUCT.md](PRODUCT.md) defines
user-facing interpretation; the [anomaly spec](specs/anomaly-detection-v0.1.md)
defines a deferred analysis contract.

The current repository has Next.js/TypeScript, Jest/Playwright foundations,
Docker Compose for PostgreSQL/PostGIS, a server-only pooled Drizzle client,
`POSTGRES_*` configuration, and a committed PostGIS extension migration.
`db/schemas/index.ts` intentionally contains no application tables. Authentication,
Farm/Field schemas, MapLibre integration, `processing/`, raster persistence, and
job execution are future work. [Database documentation](../db/README.md) owns
setup and migration commands. PLAN.md's foundation-era descriptions of absent
database configuration should be read alongside this implemented baseline; the
roadmap is unchanged.

## Component boundaries

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Next.js presentation (`app/`) | Protected screens, Field maps, history, quality and status display | No direct database access from presentation components; no raster computation. |
| TypeScript server operations | Authentication, authorization, validation, discovery orchestration, scheduling, result publication and access | Own product policy and data access; delegate expensive processing. |
| PostgreSQL/PostGIS | Relational entities, ownership links, Field geometry, job state, metadata and derived vector zones | Keep raster binaries outside relational rows. |
| Python (`processing/`, future) | Raster reading, clipping, alignment, SCL masking, NDVI, summaries and versioned analysis | Accept explicit inputs; return machine-readable results and artifacts. No end-user authentication or UI policy. |
| Raster/object storage (future) | Immutable derived raster assets, preferably Cloud Optimized GeoTIFF (COG) | Database stores references and provenance, not binary raster payloads. |
| MapLibre GL JS (future) | Base map, Field drawing, dated raster/vector overlays and legends | Rendering is not authoritative geometry validation or analysis. |

TypeScript owns the product and Python owns numerical raster processing. This
avoids duplicating ownership and business rules in a second web service while
using the Python geospatial ecosystem for processing. Run raster work outside
interactive HTTP requests. A Python package invoked by a worker is sufficient;
a separately deployed Python API is not required for that boundary.

## Persistence and geometry

A Field belongs to one Farm and inherits its owner's access boundary. Validate
supported single Polygon inputs on the server before persistence. Store geometry
with an explicit CRS; interchange GeoJSON uses longitude/latitude in WGS84.
Calculate area with an appropriate geographic or projected method, never by
interpreting degree-based coordinates as square metres. The implementation must
define supported geographic extent and reject unsupported geometries explicitly.

Drizzle and versioned migrations own the application's schema evolution.
PostGIS provides spatial validation, intersection, and geometry storage. Do not
store raw or derived raster arrays in PostGIS for this design. Application tables
and concrete indexes are introduced with their features, not by this document.

## Conceptual data model

The following are conceptual entities, not a prescribed migration or complete
column list:

| Entity | Identity and relationships |
| --- | --- |
| User / auth identity | Authenticated owner; provider and concrete schema selected in the authentication implementation. |
| Farm | Owned by one user. |
| Field | Belongs to one Farm; name, crop type, validated Polygon, derived area. |
| SatelliteObservation | Source collection/item identity, acquisition timestamp, source asset references and quality metadata. Source facts are independent of a processing run. |
| Field–observation association | Records that an observation intersects a Field; does not grant access to another owner's results. |
| ObservationAnalysis | Links Field geometry snapshot/hash and SatelliteObservation to analysis type, processing version, parameters, quality outcome, summaries and asset references. |
| ProcessingJob | Execution request, idempotency key, attempt/lease information, status and error/rejection reason; distinct from the scientific result. |
| AnomalyZone (deferred) | Vector region linked to one analysis, with area and descriptive comparison statistics. |

Separate SatelliteObservation from ObservationAnalysis so source discovery is not
rewritten when masking, algorithms, parameters, or geometry change. NDVI and
anomaly analyses may use different contracts and eligibility rules. A result must
retain its input identities and Field geometry snapshot even though geometry
editing is currently outside scope.

## Processing request and result contract

Version the contract when `processing/` is introduced. A request identifies the
Field and geometry snapshot/CRS, source observation and assets, acquisition time,
analysis type, algorithm version, complete parameters, and permitted output
location. Comparative analysis also pins baseline analysis IDs and dates; it must
not silently select different history during a retry.

A result returns the same identities, processing version and effective parameters,
quality counts/coverage, eligibility and reason codes, summaries, and artifact
references with format, CRS, transform/resolution, nodata semantics and integrity
metadata. Comparative results expose evaluated coverage separately from current
observation coverage. Schema validation and input/result identity checks occur
before publication. Credentials are supplied through runtime configuration, not
embedded in stored contracts or logs.

## Processing lifecycle and job semantics

The intended initial execution model is a database-backed job claimed by a
worker. It is a design target, not an existing queue implementation or a new MVP
milestone; revisit its mechanics when execution is introduced under PLAN.md.

- `queued`: accepted request awaiting execution.
- `running`: atomically claimed by a worker with a bounded lease.
- `succeeded`: required outputs validated and published.
- `rejected`: deterministic quality/input eligibility checks completed, but no
  eligible result exists; retain a structured reason such as insufficient coverage.
- `failed`: processing stopped because of a technical error; retain a safe error
  category and attempt information.

Missing temporal history can yield a successful NDVI analysis and an unavailable
anomaly comparison. Do not classify the entire observation as failed or fabricate
an anomaly result. Rejected analyses may retain quality diagnostics but must not
appear as usable outputs. A successful anomaly analysis with zero zones is a
separate outcome from an unavailable comparison.

Use an idempotency key derived from the authorized Field ID, geometry identity,
observation, analysis type, algorithm version, effective parameters, and pinned
baseline inputs. Enforce uniqueness transactionally within that Field for
equivalent active requests/results. A geometry hash supplements Field identity;
it cannot deduplicate results across distinct Fields or owners. An
explicit version or parameter change creates a distinct analysis; retrying an
unchanged request must not create ambiguous duplicate published results.

Assume at-least-once execution, not exactly-once processing. Claim jobs atomically,
track attempts, renew leases for long work, and recover expired leases. Retry
transient technical failures with bounded attempts and backoff. Quality rejection
is terminal for those inputs; changing inputs or rules requires a new request.
Workers completing after losing a lease cannot overwrite a newer attempt.

Write artifacts to an attempt-specific location, validate them, then publish
references and terminal success in a database transaction guarded by the current
claim. Object storage and PostgreSQL do not share a transaction: readers see only
published, complete outputs, and orphaned temporary assets need cleanup. A crash
between upload and commit must permit retry without exposing partial results.
Detailed locking, lease duration, and retry budgets are implementation decisions.

## Raster storage and serving

Keep original source references and store derived rasters in local or
S3-compatible storage behind an explicit asset abstraction. COG is the intended
persistent raster format because tiled reads and overviews support later map
inspection without loading a full raster. A COG alone is not a MapLibre rendering
integration: choose an authorized tile/rendering path when overlays are built.
No cloud provider, bucket layout, or public URL policy is selected here.

Assets are immutable for a published analysis. Store references, quality and
provenance in PostgreSQL, and provide owner-scoped access or appropriately scoped
signed access. Guessed object keys must not bypass ownership. Keep large binaries
and credentials out of Git.

## System invariants

- All end-user operations and asset reads enforce ownership on the server.
- Workers receive only authorized, validated requests; internal access does not
  remove product authorization requirements.
- Geometry identity, acquisition date, algorithm version, parameters, baseline
  IDs and assets are sufficient to explain a stored result.
- Missing data remains nodata throughout processing, summaries and display.
- Numeric processing uses aligned grids and suitable CRS/area units; presentation
  does not recompute authoritative results.
- A terminal success exposes complete validated artifacts. Retries cannot mutate
  already published analyses or publish stale attempts.
- Quality rejection, absent evidence, provider discovery errors and execution
  failure remain distinguishable.

## Deferred infrastructure

FastAPI, Redis, Celery, microservices, streaming pipelines and dedicated queue
brokers are not current requirements. Database-backed execution avoids an
additional operational dependency before workload evidence requires one. A
Python HTTP API becomes justified only by an actual consumer or deployment need;
a broker becomes justified by measured concurrency, scheduling or reliability
requirements beyond the database worker.

Storage provider and deployment topology remain unselected. UAV, weather, soil,
ML and AI pipelines require separate product validation and contracts. Do not
scaffold them or expand the roadmap merely to accommodate this conceptual model.
