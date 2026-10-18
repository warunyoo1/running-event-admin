# Evidence (iteration 2)
- npm run typecheck (tsc --noEmit): pass, no output.
- API_PROXY_TARGET=http://localhost:4010 npm run build: pass (Next 16.4.1, 11 static pages).
- pickCoverImage/groupImagesByKind throwaway check: cover wins lowest sortOrder; poster when no cover; first by sortOrder otherwise; empty/undefined -> undefined; input not mutated; groups in fixed kind order, sorted, empty omitted. All asserts passed.
- Events list endpoint returned images[] with previewUrl for E1-E4.
- 28-dashboard-compact-cover.png: dashboard "?????????????" with EventCover compact: red cover (Night Run), green gallery (Sunset Run), artwork fallback (Khao Yai); all 58x83, no count badge by design.
