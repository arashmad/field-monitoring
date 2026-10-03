# Product definition

## Status and document ownership

[PLAN.md](PLAN.md) is the source of truth for MVP scope, architecture direction,
and the milestone roadmap. This document explains the product's purpose and
interpretation rules; it does not add milestones or implementation commitments.
See [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries and the
[anomaly v0.1 specification](specs/anomaly-detection-v0.1.md) for a deferred,
rule-based analysis design. Anomaly detection is not an MVP commitment.

The repository currently provides the application and PostgreSQL/PostGIS
foundations. The workflows below describe intended behavior, not shipped features.

## Persona and core problem

The primary user is a grower managing agricultural Fields within their own Farms.
They know the Field boundaries and crop context and need to decide where closer
inspection is worthwhile. The initial model is one authenticated owner, without
organizations, shared ownership, or role hierarchies.

Satellite images alone make it difficult to compare the same Field over time:
boundaries, acquisition dates, cloud contamination, and missing coverage must be
interpreted together. A change in a vegetation signal is useful evidence for
inspection, but it does not identify a cause or establish crop health.

## Product promise

Help growers inspect dated vegetation signals within saved Field boundaries,
compare usable observations, and understand the quality and provenance of each
result. Make unavailable evidence visible rather than converting it into a
reassuring number. The product supports inspection decisions; it does not diagnose
disease, estimate yield, or prescribe treatment.

## MVP workflow

1. Sign in to a protected application.
2. Create or select an owned Farm.
3. Draw and save one Polygon as a Field, with its name and crop type. Derive area
   from its boundary; reopen the saved geometry and metadata.
4. Discover Sentinel-2 observations intersecting the Field, identified by their
   acquisition dates and quality/availability information.
5. Process usable observations outside interactive requests into masked NDVI
   rasters and Field summaries.
6. Inspect observation history, a dated NDVI time series, and selected map
   overlays. Compare usable dates descriptively when comparison is available.
7. Respond to explicit empty, unavailable, rejected, and failed states rather
   than assuming every discovered observation can produce a result.

This is a product workflow, not a second delivery schedule. The M1 slice and
subsequent delivery order remain in PLAN.md.

## Scope boundaries

The MVP includes owner-scoped Farm management, Polygon Field creation and
inspection, Sentinel-2 discovery, quality-aware NDVI processing, persistent
results, history, map overlays, and descriptive change comparison as defined in
PLAN.md. Crop type is context, not a crop-specific calibration model.

The MVP excludes organizations, shared ownership, role hierarchies, Farm deletion,
Field geometry editing, MultiPolygon support, GeoJSON import, user raster uploads,
changing acquisition dates, result downloads, agronomic prescriptions, and
advanced anomaly detection. The anomaly v0.1 document preserves a future design;
its existence does not move that feature into the MVP.

UAV imagery, weather and soil integration, machine learning, and AI-generated
advice are deferred. They introduce additional data contracts or validation needs
before the basic satellite workflow has demonstrated value. They are candidates
for later evaluation, not implied extensions of the current promise.

## Terminology

| Term | Meaning |
| --- | --- |
| Farm | An owner-scoped container for Fields; not a shared organization. |
| Field | A saved agricultural Polygon and its metadata. |
| Satellite observation | A dated source acquisition intersecting a Field; discovery does not imply usability. |
| Observation analysis | A versioned processing result for a Field geometry and source observation. |
| NDVI | A dimensionless red/NIR vegetation index, not a crop-health score. |
| Vegetation signal | A measured spectral pattern that requires crop and seasonal context. |
| Descriptive change | A comparison between usable observations, without an inferred agronomic cause. |
| Anomaly / inspection zone | A region meeting explicit comparison rules; a possible change worth inspecting, not a diagnosis. |
| Rejected | Processing completed its quality checks but could not produce an eligible result. |
| Failed | A technical error prevented processing from completing. |
| No detected zones | Eligible analysis found no zones meeting its rules; not proof of healthy crops. |

## Product invariants

- Server-side ownership checks apply to every Farm, Field, observation result,
  and asset access. Client-side filtering alone is insufficient.
- A displayed date is the source acquisition date, distinct from processing time.
- Selected date, Field boundary, overlay, summary, and quality indicators refer to
  the same analysis. Historical results retain their geometry provenance.
- Cloud-masked, missing, or ineligible pixels are unknown; they are never silently
  assigned zero NDVI or represented as healthy vegetation.
- Field-level statistics disclose valid coverage. No-data and insufficient
  comparison evidence remain distinct from an eligible zero-zone result.
- NDVI values and inspection zones do not establish disease, stress cause, yield,
  or treatment needs. Text must describe the observation and its limitations.
- Anomaly thresholds are engineering parameters requiring validation, not
  agronomic truths or confidence probabilities.
- Users can distinguish queued/running work, quality rejection, and technical
  failure, with a useful reason and recovery action where applicable.
