# Anomaly detection v0.1

## Status, purpose and scope

This is a deferred, rule-based design specification, not implemented behavior or
an addition to the MVP. [PLAN.md](../PLAN.md) remains authoritative for roadmap
and scope. [PRODUCT.md](../PRODUCT.md) defines the interpretation of vegetation
signals; [ARCHITECTURE.md](../ARCHITECTURE.md) defines execution and persistence.

The design identifies contiguous regions that are both lower in NDVI than the
current Field's spatial baseline and lower than a preceding usable observation.
These are possible vegetation changes worth inspecting, not diagnoses. NDVI
processing is useful independently of anomaly eligibility.

The baseline-selection, masking, grid and component policies below are an
initial implementation proposal. The numeric settings are **proposed, tunable
engineering defaults**, not validated agronomic thresholds. Adopt or revise
these policies and values against representative fixtures before implementing
this version. Store every effective value with the
analysis; parameter changes create a new analysis identity.

## Inputs and provenance

A request supplies:

- Field ID and immutable validated Polygon snapshot/hash in a declared CRS.
- Current Sentinel-2 Level-2A source collection/item identity, acquisition
  timestamp, B4/B04 (red), B8/B08 (broad NIR) and SCL asset references, nodata and
  reflectance conversion metadata. B8A is not a substitute for B8.
- Candidate prior observations for the same Field geometry, with their acquisition
  times, quality outcomes, processing versions and asset references.
- Explicit algorithm/contract version and complete effective parameters, including
  grid definition, masking policy, coverage rules and baseline policy.

Use the acquisition timestamp for ordering, not discovery or processing time.
Record source identities, including multiple granules if a future input adapter
supports a mosaic. v0.1 assumes a single source observation supplies the Field;
partial tile coverage is evaluated as missing coverage. Mosaicking is not implied.

B4 and B8 have native 10 m resolution; SCL has 20 m resolution. Convert source
values to comparable surface reflectance using the asset's declared scale/offset
or product metadata. Do not assume dividing all digital numbers by 10,000 is
always sufficient, and do not apply offsets twice to already normalized assets.
See the official [Level-2A product description](https://sentiwiki.copernicus.eu/web/s2-products)
for resolutions and reflectance conversion.

## Grid, clipping and masking

Use a fixed Field analysis grid in a suitable local metric CRS, normally its UTM
zone, at 10 m resolution. Record CRS, affine transform, extent and pixel size.
The same geometry/version must yield the same grid for both dates. Unsupported
extent, invalid geometry or lack of a suitable projection is an explicit input
error; do not silently compute area in degrees.

Rasterize the Field using pixel-center inclusion. Clip rasters to its extent and
exclude pixels outside that mask. A Field containing no analysis pixel centers is
ineligible at this resolution. Use nearest-neighbor resampling for categorical
SCL and source validity masks. For reflectance reprojection, use a declared
nodata-aware method (initial default: bilinear); never interpolate masked samples
into valid data. Resampling SCL to 10 m does not add native classification detail.

The initial conservative SCL policy retains classes 4 and 5, allowing both
vegetated and bare-soil pixels. Mask every other class:

| SCL | Treatment |
| --- | --- |
| 0: no data; 1: saturated/defective | Exclude. |
| 2: dark/topographic shadow; 3: cloud shadow | Exclude. |
| 4: vegetation; 5: not vegetated | Retain if spectral data are valid. |
| 6: water; 7: unclassified | Exclude under this agricultural analysis policy. |
| 8: medium cloud; 9: high cloud; 10: cirrus | Exclude. |
| 11: snow/ice | Exclude. |

Class names and codes follow the official
[Sentinel-2 Level-2A documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html).
Keeping only 4/5 is a product analysis choice, not a claim that all other classes
are intrinsically unusable for every remote-sensing application. Do not retain
only vegetation pixels: doing so could erase the change being investigated.
Cloud-edge dilation is disabled initially; any later dilation must be a versioned
parameter with coverage effects tested.

A valid pixel is inside the Field mask, has an allowed SCL class, finite/non-nodata
B4 and B8 reflectance, a usable NDVI denominator, and a finite NDVI in [-1, 1].
Out-of-range NDVI is excluded and counted, not silently clamped. Missing SCL or a
required band prevents analysis; do not substitute an all-clear mask.

## NDVI and usable observation

For each valid pixel `p`:

```text
NDVI(p) = (B8(p) - B4(p)) / (B8(p) + B4(p))
```

Exclude pixels where `abs(B8 + B4) <= denominator_epsilon`. The default epsilon
is `1e-6` in normalized reflectance units. Missing/masked values remain nodata;
zero is a legitimate numeric NDVI, not a missing-data sentinel.

Let `F` be the set of Field pixel centers on the fixed grid, and `V_t` the valid
pixels for acquisition `t`:

```text
valid_coverage(t) = count(V_t) / count(F)
```

An observation is usable for this analysis if `count(F) > 0`, inputs are valid,
and coverage meets `min_valid_coverage`. This is Field-level coverage, not the
source item's scene-wide cloud percentage. Record both if available, but do not
use the scene-wide percentage as a substitute for clipping and masking.

NDVI summaries use only valid pixels: count, mean, median, minimum, maximum,
valid coverage and exclusion counts by reason. Reject insufficient coverage with
an explicit quality reason. Whether diagnostic NDVI is retained for rejected
observations must be visible; it is not an eligible monitoring result.

## Spatial and temporal baselines

**Spatial baseline:** `S_t = median(NDVI_t over V_t)`. This compares pixels against
other usable parts of the same Field on the current date. It is not an expected
value for the crop. Persist its value and sample count.

**Temporal baseline:** select the most recent strictly earlier usable observation
of the same Field geometry, no more than `max_baseline_age_days` before `t`.
Use compatible NDVI/grid/masking versions; reprocess incompatible inputs or mark
comparison unavailable. Resolve equal timestamps deterministically by source ID;
same-time products do not count as historical observations. Pin the selected
baseline's analysis ID and acquisition time before execution so retries are stable.

This v0.1 baseline is a single prior date, not a seasonal climatology, multi-date
median, trend model or machine-learning prediction. It keeps the initial rule
explainable; it may be sensitive to noise and farming operations.

Let the prior baseline date be `b`, and `O = V_t intersect V_b`. Require
`count(O) / count(F) >= min_comparison_coverage`. Coverage is measured against the
whole Field, not only against current valid pixels. Evaluate temporal differences
only on `O`; no imputation, zero filling, interpolation across time, or use of
future observations is allowed. Record comparison coverage and age independently
of current valid coverage.

The first usable observation produces NDVI and its spatial summary, but its
anomaly comparison is unavailable (`no_temporal_baseline`). The same applies when
history is too old or incompatible. If both dates are usable but common coverage
is insufficient, report `insufficient_comparison_coverage`. Neither case means
zero detected anomalies.

## Initial parameter set

| Parameter | Proposed default | Meaning |
| --- | --- | --- |
| Analysis pixel size | 10 m | Common metric grid for NDVI and components. |
| Allowed SCL classes | {4, 5} | Conservative agricultural validity mask. |
| `denominator_epsilon` | 0.000001 | Guard in normalized reflectance units. |
| `min_valid_coverage` | 0.70 | Minimum valid fraction of Field pixels per observation. |
| `max_baseline_age_days` | 30 | Maximum preceding-observation age in elapsed days. |
| `min_comparison_coverage` | 0.70 | Minimum common valid fraction of Field pixels. |
| `spatial_drop` | 0.15 | Minimum NDVI deficit relative to current Field median. |
| `temporal_drop` | 0.15 | Minimum NDVI decrease from the preceding date. |
| Component connectivity | 8 neighbors | Diagonal candidate pixels connect. |
| `min_zone_area_m2` | 500 | Minimum retained component area after Field clipping. |

NDVI differences are absolute index units, not percentages. Coverage values must
be in (0, 1]; age, area and epsilon must be positive; drop thresholds must be
positive and within the index's possible difference range. Validate parameters
before scheduling. Boundary behavior uses inclusive thresholds as specified below.

## Anomaly mask, components and vectorization

For every pixel in the common valid set:

```text
spatial_deficit(p) = S_t - NDVI_t(p)
temporal_decrease(p) = NDVI_b(p) - NDVI_t(p)
candidate(p) = spatial_deficit(p) >= spatial_drop
               AND temporal_decrease(p) >= temporal_drop
```

Here `spatial_drop` and `temporal_drop` are the configured thresholds.
Both conditions must hold; spatially low pixels alone are not v0.1 anomalies.
Set eligible non-candidates to 0 and candidates to 1. Pixels outside `O` remain
nodata, including valid current pixels without valid history.

Label the binary candidate mask using 8-neighbor connected components. Missing
pixels cannot form bridges. Do not smooth, fill holes, or dilate the mask in
v0.1. Polygonize each component's pixel footprints, preserve holes, and intersect
with the exact Field Polygon in the metric CRS. Compute area after clipping and
retain components with `area_m2 >= min_zone_area_m2`. A nominal five-pixel group
at 10 m may fall below 500 m² after boundary clipping; pixel count alone is not
the acceptance rule.

A component may vectorize into a MultiPolygon because of diagonal connectivity
or clipping. This output representation is permitted even though saved **Field**
inputs support only a single Polygon. Repair only representational topology
issues without silently changing the candidate region; fail clearly if a valid
output cannot be produced. Serialize display GeoJSON in WGS84, retaining metric
area and source-grid provenance. Avoid simplification in this version. Use
stable component ordering/IDs for reproducible results.

## Outputs and outcome semantics

Publish the following for an eligible analysis:

- Current masked NDVI raster and summary, with acquisition date and valid coverage.
- Anomaly candidate raster with explicit nodata, common coverage, and mask rules.
- Retained zones as vector features with stable IDs, metric area, valid candidate
  pixel count, current/baseline NDVI summaries and descriptive deficits/drops.
- Candidate component count, retained zone count, retained area and evaluated
  coverage. Candidate pixels removed by the area filter remain identifiable in
  the candidate raster; vector zones represent the retained result.
- Field geometry hash, current and baseline source/analysis IDs and dates, grid,
  effective parameters, algorithm version, processing time and asset references.

Derived rasters should use COG with explicit nodata, CRS and transform. Persist
metadata and vectors/references under the architecture's publication and ownership
rules. The analysis contract must distinguish these outcomes:

| Outcome | Meaning |
| --- | --- |
| Eligible, zones found | Both comparisons ran and retained regions met all rules. |
| Eligible, zero zones | Both comparisons ran; no region survived all rules. |
| Anomaly unavailable | Usable NDVI exists but baseline or common coverage is insufficient. |
| Observation rejected | Current imagery fails the observation eligibility rules. |
| Technical failure | Input retrieval, processing or output publication could not complete. |

Do not serialize unavailable/rejected/failed outcomes as an empty successful
FeatureCollection. Use explicit eligibility/reason fields; omit unavailable
numeric results or represent them as null rather than zero. A missing asset due
to a retrieval error is a technical failure; known absent required source data is
an eligibility reason. Keep these distinguishable for recovery and display.

## Edge cases and interpretation

- Small or narrow Fields and partial tile coverage may provide too little usable
  evidence at this resolution. Report coverage/resolution limits explicitly.
- Clouds, shadows, haze, imperfect SCL, mixed boundary pixels and misregistration
  can create apparent change. Masking reduces these effects but does not prove
  that retained pixels are uncontaminated.
- Harvest, tillage, senescence, crop rotation, irrigation patterns and seasonal
  growth can change NDVI. A previous date may belong to a different growth stage;
  v0.1 has no crop-calendar correction or causal inference.
- Uniform Field-wide decline can meet the temporal rule while failing the spatial
  rule. This detector will miss it by design; Field summaries and descriptive
  date comparison remain useful. Do not label zero zones as no vegetation change.
- A persistently low region may fail the temporal rule. A poor historical baseline
  can hide a later change or produce false positives. Surface the baseline date.
- SCL water exclusion can omit flooded areas; no water/flood diagnosis is supported.
- No common pixels, all-masked data, invalid denominators, duplicate source dates,
  missing required bands and incompatible grids require explicit deterministic
  handling. Do not repair these by inventing evidence.

User-facing language should say, for example, “Possible vegetation change worth
inspecting,” “No zones met the configured rules in the evaluated area,” or
“Comparison unavailable: insufficient usable history.” Avoid “diseased area,”
“healthy Field,” treatment advice, or a confidence percentage unsupported by a
validated statistical model. Do not assign agronomic severity from raw thresholds.

## Acceptance criteria before implementation is considered complete

Use small synthetic fixtures with known expected values plus representative
source observations. Verification must cover:

1. B4=0.2 and B8=0.6 produce NDVI=0.5; zero/near-zero denominators, source nodata,
   non-finite and out-of-range values remain excluded. Scale/offset fixtures
   distinguish raw digital numbers from already normalized reflectance.
2. Every SCL class follows the stated policy, including retention of bare soil.
   SCL reprojection creates no fractional classes; invalid samples do not leak
   into reflectance interpolation. Outside-Field pixels never enter summaries.
3. A 70/100 valid-pixel observation meets the default coverage boundary; 69/100
   is rejected. Scene cloud percentage cannot override the Field result.
4. First observation, absent/too-old/incompatible history and insufficient common
   coverage yield the appropriate unavailable reason, while eligible NDVI remains
   available. A future or same-time observation is never selected as baseline.
5. The latest eligible preceding date is selected deterministically and retained
   on retry. Exactly 30 elapsed days qualifies; an older baseline does not.
6. With `S_t=0.60`, baseline pixel NDVI=0.65 and current=0.40, both deficits meet
   defaults and the pixel is a candidate. Fixtures meeting only one condition
   are not candidates. Equality at each threshold qualifies.
7. Exactly 70/100 common pixels meet comparison coverage; 69/100 do not. Pixels
   valid on only one date remain nodata in the anomaly mask.
8. Diagonal candidates connect, separated groups do not, and masked gaps do not
   bridge components. A 500 m² clipped component is retained; a smaller one is
   discarded. Boundary clipping, holes and valid multipart outputs are tested.
9. Eligible zero-zone output is distinct from unavailable/rejected/failed output.
   Uniform decline demonstrates the documented spatial-rule limitation.
10. Vector regions stay inside the Field, report area in m², and align with the
    source grid after GeoJSON conversion. Rasters retain nodata and provenance;
    date, summary, overlay and baseline IDs agree.
11. Identical versioned inputs yield equivalent masks, summaries and stable zones.
    Changed parameters/baselines create a distinct identity; retries cannot expose
    partial artifacts or duplicate published results.
12. Display and access checks enforce ownership and the stated false-positive
    language. These checks validate implementation of the rule, not agronomic
    accuracy; threshold validation against real Field examples remains necessary.
