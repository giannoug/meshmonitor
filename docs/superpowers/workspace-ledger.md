# Workspace layout ledger

Decisions taken and items parked while building the opt-in Workspace layout. The controller appends one line per decision; implementers report candidates in their task reports.

- Spec: [2026-11-13-workspace-redesign-design.md](specs/2026-11-13-workspace-redesign-design.md)
- Plan: [2026-11-13-workspace-redesign.md](plans/2026-11-13-workspace-redesign.md)

Line formats:

- `Ruling: <task> <board?> — <decision> — why: … — cost if wrong: …`
- `BLOCKED: <task> — <reason> — skipped: <tasks>`

## Rulings

Ruling: controller A — preflight rulings live here until Task 0.2 creates docs/superpowers/workspace-ledger.md; the controller copies them in at Task 0.2 completion — why: ledger file is a 0.2 deliverable — cost if wrong: none.
Ruling: controller B — 5.9 may edit AdminCommandsTab only to consume logic extracted into hooks (Rule X); "untouched" in D15 means look and behaviour, not bytes — why: spec Global Constraint permits behaviour-preserving extraction; otherwise 5.9 would duplicate ~1k lines — cost if wrong: a Classic file diff the requester may question; Classic tests guard behaviour.
Ruling: controller C — todos are tracked per phase; per-task state lives in this ledger — why: 52 tasks; ledger is the recovery map — cost: none.
Ruling: controller D — models — implementers: sonnet for mechanical/backend tasks, opus for shell/settings-frame/integration tasks; task reviewers: sonnet (opus for 1.3–1.5, 2.2, 5.1–5.3, 5.9, 6.6 Rule X/routing tasks); final review: opus — why: cost vs risk — cost if wrong: extra fix rounds.
Ruling: controller E — TG runs with NODE_OPTIONS=--max-old-space-size=8192 (tsc/eslint OOM at default heap on clean HEAD in this container) — why: environment limit, not code — cost: none.
Ruling: controller F — lint:ci in-repo filter also drops design-scratch/ (git-excluded, like .claude/worktrees): `npm run lint:ci 2>&1 | grep '^FAIL' | grep -v -e '.claude/worktrees' -e 'design-scratch/'` — why: CI never sees it — cost: none.
Ruling: controller G — implementer rulings from 0.1 report lines 71-79 adopted, except line 76 (superseded by 3af973e: fonts bundled as Vite assets + renderBuiltUrl css relative) — cost: none.
Ruling: controller H — Task 0.2 step 4 (write missing checks) is split out to an independent check-writer agent after the implementer; implementer's port script exits 1 until then — why: implementers cannot dispatch agents and the plan wants grader ≠ builder — cost: one extra commit.
Ruling: controller I — board-check matching stays case-sensitive exact substring; en.json spelling/case differences (Favourites/Favorites etc., in written AND ported checks) are swapped per board at build time under D9b with a Ruling and a check edit (spec §9.1) — why: spec already prescribes it; case-insensitive matching would loosen absent checks — cost: per-board check edits during build.
Ruling: controller J — fixture cast names (Station G2, Rooftop RAK, Heltec MeshCore, Athens MQTT, Reticulum node) are legitimate must strings — why: spec §10 fixes the cast — cost: none.
Ruling: 0.1 — renderWorkspace overrides i18n by making the global react-i18next mock delegate to the real hook and Trans inside a real I18nextProvider (`withRealProvider` in src/test/mockI18n.ts), rather than a per-file `vi.unmock` — why: the BP2 board-test template imports only renderWorkspace, and `vi.unmock` order-depends on import order — cost if wrong: the global setup changes back to the plain mock, and each Workspace test file adds `vi.unmock('react-i18next')`.
Ruling: 0.1 — renderWorkspace defaults to a signed-in admin; passing `permissions` makes the user a non-admin unless `isAdmin` is given; `anonymous` gives `authenticated:false` with the given (default empty) permissions — why: board tests mostly show the full UI, and partial-permission tests pass grants — cost if wrong: flip the default in `authStatusFor`.
Ruling: 0.1 — phone matchMedia evaluates min-width and max-width queries at a 390 px width (1280 px otherwise), not only the exact `(max-width: 767.98px)` string — why: the 768–1023 overlay-drawer queries must answer consistently — cost if wrong: none for useIsPhone, which uses the exact query.
Ruling: 0.1 — `/api/user/preferences` is served in the ok() envelope `{success:true, data:{layout:'workspace'}}`, per spec §7 (routes use ok()/fail()) — why: the route does not exist yet, and the envelope is what it will return — cost if wrong: change one fixture handler when the route lands.
Ruling: 0.1 — Inter comes from the @fontsource/inter 5.3.0 latin woff2 files (Inter 4.x, OFL), not the rsms release zip — why: about 24 KB per weight versus about 110 KB for full glyph sets — cost if wrong: swap in the full files from the release.
Ruling: 0.1 — Fixture source ids are readable (`src-g2`, `src-heltec`, `src-rak`, `src-rns`, `src-mqtt`), not UUIDs — why: readable test routes — cost if wrong: none (ids are opaque strings everywhere).
Ruling: 0.1 — The CI workflow installs the Playwright browser (`npx playwright install --with-deps chromium`) — why: a fresh runner has none; the no-install rule applies to this session's container only — cost if wrong: drop the step.
Ruling: 0.1 — The eslint `tests/**` no-project block now includes `.ts`, and vitest excludes `tests/workspace-e2e/**` — why: these files are outside tsconfig and are Playwright specs, not Vitest suites — cost if wrong: none.
Ruling: 0.2 — 70 boards' checks written by an independent check agent (source "written"); list in .superpowers ledger — why: plan Step 4 — cost if wrong: per-board check edits.
Ruling: controller K — preferences PUT/DELETE use optionalAuth + in-handler anonymous check (403 ANONYMOUS_USER) instead of requireAuth — why: brief's requireAuth makes its own 403 unreachable; reviewer confirmed self-only, CSRF covered, deactivated sessions cleared — cost: API tokens cannot write preferences (acceptable for a UI store).
Ruling: controller L — stored layout values other than classic|workspace are treated as unset in layout-usage — why: PUT rejects them; only hand-edited rows — cost: none.
Ruling: controller — USER INSTRUCTION 2026-11-13: no PR is created automatically; plan steps that open or update a PR are skipped; phase summaries live in this ledger and the final report — why: requester's explicit instruction — cost: none.
Ruling: controller M — LayoutGate in Classic mode renders only <Navigate> for Workspace-only paths (not classic+Navigate) — why: avoids mounting a Classic page for an URL it can't serve; reviewer accepted — cost: none.
Ruling: controller N — WorkspaceApp has no app-level WebSocketProvider above /source/:id/* (only non-source routes get one), deviating from the plan's provider order — why: outer socket joins all sources and prefix-invalidates the open source's poll on every mesh-wide event; Classic does the same split — cost: 1.6 rail must use unread hooks/polling for live data.
Ruling: controller O — accepted 1.5 deviations — renderSourceApp takes page components as first arg (eager-CSS plugin roots); workspaceRedirect takes {isAdmin}; per-source redirects only for Meshtastic sources (configuration/settings/notifications are MeshCore views) — cost: none.
