# One Kompas release, two entry points

Perfact is the canonical frontend and backend. The dashboard fetches its live HTML with no cache, mounts relative assets under /kompas/, and proxies all Kompas dependencies and API calls to the same deployment. The old partial public snapshot no longer takes precedence. Question Bank, feedback, dossier helpers, answer anchors, and the update checker therefore arrive together on both hosts. Flow and MarketFit links are present in the canonical navigation.

Perfact builds stamp index.html and version.json from the commit and produce release.json with asset SHA-256 values. A Perfact release updates both entry points without a second frontend copy operation. Existing open live sessions offer an update rather than reloading while listening.

This unifies releases, not browser-origin storage. Existing perfact.* localStorage and IndexedDB records remain untouched on both origins. They are not authenticated cloud session sync, and this change must never be reported as making old transcripts visible across devices. Account-linked data migration and a complete approved maturity ingestion loop remain separate work.

Verification: isolated shell mounting and fetch routing tests, TypeScript, canonical asset hash comparison after deployment, and browser checks of both entry points. No model requests or private transcript uploads are needed for these release checks.
