# Learnings

### 2026-03-07
- [noUncheckedIndexedAccess]: dynajs has `noUncheckedIndexedAccess: true` in tsconfig. All typed array (Float64Array, Int32Array) indexed access returns `T | undefined`. Must use `!` assertions or explicit checks. Compound assignment (`arr[i] += x`) fails — must write `arr[i] = arr[i]! + x`.
- [betweenness-dijkstra]: Refactored Dijkstra into a shared function returning `{dist, sigma, pred, stack}`. Both Closeness and Betweenness use it. The back-propagation for Betweenness iterates the stack in reverse (not by popping, which consumed the stack).
- [tna-r-plot]: `tna` R package v1.2.1 deprecated `cut` parameter in `plot()`, replaced by `edge_cutoff`. Use `plot(model, edge_cutoff = 0.05)`.
- [tna-reliability]: `reliability()` does split-half validation with 4 metrics: Pearson correlation, mean/median absolute difference, Bray-Curtis dissimilarity. On `group_regulation`, Pearson averages 0.993.
- [jekyll-blog]: mohsaqr.github.io uses al-folio theme. Posts in `_posts/`, pages in `_pages/`, images in `assets/img/`. Works dropdown defined in `_pages/works-dropdown.md`. Software cards in `_pages/software-methods.md`.
