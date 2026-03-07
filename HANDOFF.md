# Session Handoff — 2026-03-07

## Completed
- Added basic SNA features to dynajs: OutStrength + Closeness centralities, network density, degree distribution, Louvain community detection, Spring + FR force-directed layouts.
- All code in `src/sna/` (3 new files) + modified `src/analysis/centralities.ts`, `src/core/types.ts`, `src/index.ts`.
- 21 new tests in `tests/sna.test.ts`. All 89 tests pass, zero type errors.
- Committed and pushed to main.
- Wrote TNA blog post (`blog-tna.md` in `tmp/`), generated pruned network plot from `group_regulation` dataset.
- Created `/works/tna/` page on mohsaqr.github.io with full TNA overview, four validation layers, software ecosystem, and consolidated resources (30 validated links).
- Added TNA to Works dropdown navigation, linked tna software card to `/works/tna/`.
- Removed blog post version per user request, kept Works page only.

## Current State
- dynajs main branch is clean, all pushed.
- mohsaqr.github.io main branch is clean, all pushed. Site builds successfully.
- `/works/tna/` page is live at saqr.me/works/tna/.
- Blog post was removed; only the Works page remains.

## Key Decisions
- Refactored Dijkstra into shared function used by both Closeness and Betweenness (was duplicated before).
- Closeness uses Wasserman-Faust normalization: `reachable / sumDist`. Unreachable nodes get closeness = 0.
- Louvain uses directed weighted modularity formula with resolution parameter.
- Layout uses deterministic golden-angle spiral initialization (not random).
- TNA page uses styled HTML cards matching the al-folio theme conventions of the blog.

## Open Issues
- None.

## Next Steps
- No immediate follow-ups for dynajs SNA features.
- Consider adding GroupTNA support to SNA functions (community, layout, metrics) if needed.

## Context
- dynajs repo: `/Users/mohammedsaqr/Documents/Github/dynajs/`
- Blog repo: `/Users/mohammedsaqr/Documents/Github/mohsaqr.github.io/`
- tna R package v1.2.1 used for plot generation.
