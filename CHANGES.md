# Changes

### 2026-03-07 — Add basic SNA features
- src/core/types.ts: Extended `CentralityMeasure` with `OutStrength | Closeness`. Added `CommunityResult`, `LayoutResult`, `LayoutAlgorithm`, `DegreeDistribution` types.
- src/analysis/centralities.ts: Added OutStrength (rowSums) and Closeness (Wasserman-Faust normalization). Refactored Dijkstra into shared function used by both Closeness and Betweenness.
- src/sna/metrics.ts: New file. `networkDensity()` (directed/undirected, with/without loops) and `degreeDistribution()` (in/out/total degree counts).
- src/sna/community.ts: New file. Louvain community detection for directed weighted networks with resolution parameter.
- src/sna/layout.ts: New file. Spring and Fruchterman-Reingold force-directed layouts with [0,1] normalization.
- src/index.ts: Added SNA exports (4 functions + 4 types).
- tests/sna.test.ts: 21 new tests covering all SNA features. All 89 tests pass.
