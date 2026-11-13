# Workspace layout (#6365): build design

Date: 2026-11-13 · Status: draft for approval · Upstream issue: Yeraze/meshmonitor#6365 · Work repo: giannoug/meshmonitor, branch `claude/eager-pascal-svegts`

Source of truth: the design canvas, https://claude.ai/artifact/P42mrYmhRiCfRoUnTx5G2t (v42, 330 artboards, 137 section notes in `project/canvas.json`). The section notes are part of the spec. Background records (local only, git-excluded, under `design-scratch/`): `2026-11-12-settings-in-chat-shell-design.md`, `2026-11-12-shell-remaining-screens-design.md`, `2026-11-12-full-redesign-design.md`, `2026-11-13-remaining-work-design.md`, `2026-11-12-canvas-coverage-audit.md`, `inventory/`, `checks/*.json`, `png3/`, `build-log/`.

## 1. Intent

MeshMonitor's UI is one source at a time behind a row of tabs, with long console-style settings pages and a phone layout that is the desktop squeezed. The canvas redraws every page, tab, view and significant dialog in one shell called **Workspace**:
- a device rail (Overview square, then one square per device),
- the layout-D sidebar (the device's tools, Channels, Direct messages),
- Overview for everything that spans devices,
- You for per-user things and Server for install-wide admin settings,
- on phones, a Home · DMs · Activity · You tab bar with sheets and push navigation.

The maintainer's worry is that this turns a monitoring app into a chat app. The answer, and the measure of success: every monitoring surface (map, analysis, reports, unified views, packets, telemetry, security, automations) is a first-class place in the shell. A power user finds every control they use today.

Workspace ships **alongside** today's layout (Classic). Users opt in. Classic keeps working unchanged.

## 2. Goals, non-goals, anti-goals

**Goals**
- Build every board on the canvas except the rejected chat options A, B and C (`a-chat-A-*`, `a-chat-B-*`, `a-chat-C-*`): 324 boards, phone (390×844) and desktop (1280×800).
- Every page's layout, placement, menus, sheets, copy and states match its board (decision D5).
- Workspace is usable end to end from phase 1. Pages not yet rebuilt are re-hosted inside the shell.
- Opt-in exactly as r2/r3/r4/s3 describe once finished. During the build, Workspace is reachable only when the server runs with `WORKSPACE_PREVIEW=true` (D3).

**Non-goals**
- No new product features, and no change to what a feature does, its storage, permissions or protocol behaviour, unless a board's note requires it. §7 lists every backend change the boards require.
- Classic is not redesigned. Its pages, components and look stay as they are.
- No new mesh traffic and no new limits (§8).
- Today's gaps the canvas records as "not fixed" stay unfixed: Reticulum new-conversation UI, Reticulum Info "Unknown" mode, the ungated neighbour Purge, NodeFilterPopup dead code.

**Anti-goals (failure even if it works)**
- A power user cannot find a control they use today.
- Classic changes look or behaviour. Exceptions, and only these: the `ShellContext` hook (§5.4), the r3 banner, and one user-menu item "Try the Workspace layout" (D18).
- Something that transmits or destroys data has no Sends line or no confirm where its board has one.
- MeshCore or Reticulum reads as "Meshtastic with fields hidden".
- A save resets a safety timer, or a new notification path spams users.
- The build runs on silently while the local gate (§9) or the PG/MySQL suites are skipped or red.

## 3. Decisions (made with the requester, 2026-11-13)

| # | Topic | Decision |
|---|---|---|
| D1 | Delivery | **Re-host first.** Phase 1 is the shell, opt-in, routes and every existing page re-hosted unchanged in `<main>`. Later phases rebuild one area each to its boards. |
| D2 | Phase order | 0 setup → 1 foundation → 2 chat + Activity → 3 Map/Nodes/node page → 4 Overview → 5 device settings frame → 6 You/Server/sign-in/devices → 7 MeshCore + Reticulum → 8 Dashboard/Automations/More tools → 9 shared patterns, odd pages, gate removal. |
| D3 | Opt-in during the build | **Env-var preview, any user.** With the server env `WORKSPACE_PREVIEW=true`, any signed-in user who opens `/you/layout` can pick Workspace; the default stays Classic, and admins can change it in Server › General (r4). Without the env var, everyone gets Classic and the Workspace-only routes redirect to their Classic equivalents. No Classic UI change, and no gate setting is stored. |
| D4 | End state of the gate | **Removed last.** Phase 9 removes the env check and turns on the r3 banner and the D18 menu item, in their own commit so it can be dropped before merging. Until then the banner and menu item are built but render nothing. |
| D5 | Depth per page | **Re-compose to the board.** Layout, placement, menus, sheets, copy and states match the board. Existing inner parts (charts, tables, map layers, form fields, hooks, API calls, validation) are reused and re-arranged; they are split or restyled only where the board differs. |
| D6 | Per-user storage | **New `user_preferences` table** `(userId, key, value)` on SQLite/PG/MySQL. It holds Layout, Workspace display preferences, settings pins and the per-user dashboard. |
| D7 | URLs | **Shared URLs plus new paths.** Both layouts read the same URLs. Workspace adds new paths (§5.5). Old `#section` links redirect in Workspace only. |
| D8 | Breakpoints | Phone layout below **768 px**. Desktop shell from 768 px; between 768 and 1023 px the sidebar becomes an overlay drawer. Verified at 390×844 and 1280×800, with a smoke check at 820×1180. |
| D9 | Deviations allowed without asking | (a) role tokens, not hex; every theme works. (b) Today's en.json copy wins over a board's wording for the same control; new strings go in en.json. (c) Boards that show several dialogs or menus open "to fit the canvas" are built one at a time. (d) Today's behaviour wins where a board contradicts it and its note doesn't explicitly override it. Each one taken is logged as a `Ruling:`. |
| D10 | Tests | Vitest/RTL per component, with each board's `checks/*.json` must/absent strings ported to assertions. Plus a **committed Playwright suite** (new devDependency, and a CI job that runs wherever Actions is on) running on API fixtures of the canvas cast. It screenshots each board's screen at its size for side-by-side review with png3. **No pixel-diff gate.** |
| D11 | Branch and PR | **One branch, one PR**: `claude/eager-pascal-svegts`, one draft PR on giannoug/meshmonitor. Each phase is a commit range; the PR body is updated as each phase lands. The requester merges; I never merge. |
| D12 | Dashboard | **Per-user in Workspace, seeded.** Workspace reads and writes the board in `user_preferences`. On first open it is seeded from today's install-wide `dashboardWidgets`. Classic keeps the install-wide board. |
| D13 | New push toggles | Replies and Meshtastic Mentions (cs2) are **off by default** for everyone. |
| D14 | Blockers | **Park and continue.** Log it as `BLOCKED` in the ledger, skip the task and its dependents, continue with independent work, and list the open items at the top of the final report and the PR body. |
| D15 | Shared code with Classic | **Workspace-only row kit.** New settings categories reuse today's hooks, handlers and validation. Classic's section components and `AdminCommandsTab` / `admin-commands/*` are untouched; their duplication is retired only after Classic goes. |
| D16 | Font | **Bundle Inter** (self-hosted woff2) for Workspace only. Classic keeps the system font stack. |
| D17 | Architecture | Workspace is its own tree at the route level (§5). |
| D18 | Classic → Workspace | Classic gets the r3 banner and **one permanent user-menu item, "Try the Workspace layout"**. **"Not now" saves `layout=classic`**, so a later admin default of Workspace doesn't move that user (r4: "People who already picked one keep their choice"). |
| D19 | Starred charts | **Shared, as today.** Only the board (which widgets, their order and size) is per user. Stars stay today's install-wide `telemetryFavorites` per source, so retention is unchanged, and starring or unstarring changes it for everyone, as in Classic today. |
| D20 | CI | **Local verification only.** Actions is off on giannoug/meshmonitor and stays off. The phase gate is local (§9). The PR body says plainly that CI has not run. `/ci-monitor` is not used while Actions is off. |

## 4. Approaches considered (shell architecture)

| Approach | Trade-off | |
|---|---|---|
| **Own tree at the route level** | The shell sits above the source, so the rail, Overview and switcher survive device switches. Classic is touched only through `ShellContext`. | **Chosen** |
| Layout switch inside `App.tsx` | `App` is per-source and remounts on every switch, so the rail and Overview can't live there. It also means editing a 4.1k-line Classic file in every phase. | Rejected |
| Layout route shared by both layouts | Puts Classic's pages under a new parent, risking Classic regressions for no gain. | Rejected |
| Iframe re-host | Breaks auth/CSRF context, deep links and the phone layout. | Rejected |

## 5. Architecture

### 5.1 Layout resolution

`resolveLayout(user, settings)` returns `'classic' | 'workspace'`:
1. During the build, server env `WORKSPACE_PREVIEW` not `true` → `classic` for everyone. The server exposes the flag through the existing public config endpoint. Phase 9 deletes this rule.
2. Signed-in user with a `layout` preference → that value.
3. Signed-in user without one → the install default `defaultLayout` (`classic` unless an admin changes it in Server › General, r4). r4's "People who already picked one keep their choice" is rule 2.
4. Anonymous viewer → the install default.

The preference is server-side, so it "takes effect straight away on this and your other browsers" (s3). The other browsers pick it up on their next load or auth refresh, not live. A localStorage mirror avoids a flash of the wrong layout on load; the server value wins once fetched.

### 5.2 Entry points between layouts

- **Workspace → Classic:** You › Layout (r2 desktop, s3 phone).
- **Classic → Workspace:** (a) the r3 banner ("Try the Workspace layout", Try it / Not now). It shows once per signed-in user while Server › General's "Offer Workspace to Classic users" (r4) is on. Try it saves `layout=workspace`; Not now saves `layout=classic` and `workspace.bannerDismissed`. (b) The Classic user-menu item "Try the Workspace layout" (D18), always there for signed-in users; it saves `layout=workspace`. Both are inert until phase 9.
- **During the build:** `/you/layout` with `WORKSPACE_PREVIEW=true` (D3).

### 5.3 Tree

`main.tsx` gains `LayoutGate` inside `AuthProvider`. It renders today's `<Routes>` unchanged for Classic, or `<WorkspaceApp/>`. `WorkspaceApp` renders `WorkspaceShell`:
- **Desktop (≥768):** rail (`DeviceRail`: Overview square, device squares with unread badges in Server › Devices order, `+`, Server gear for admins, You avatar), sidebar (`DeviceSidebar` layout D; it swaps to the Settings list, Server list, You list or Overview nav by route), `<main>` outlet.
- **Phone (<768):** stacked screens with a header and the `TabBar` (Home · DMs · Activity · You). The device name opens `DeviceSwitcherSheet` (c-home-e2, Overview row on top).

Per-source content inside `<main>` keeps today's `SourceProvider` + `WebSocketProvider` wrapping and the source-type dispatch of `SourceAppDispatch`. That dispatch moves into a shared helper both layouts call, so its behaviour is unchanged. Rail data comes from the existing `useDashboardSources()` and unread hooks.

New code lives under `src/workspace/`: `shell/`, `chat/`, `map/`, `nodes/`, `node-page/`, `overview/`, `reports/`, `settings/` (frame, row kit, categories), `you/`, `server/`, `meshcore/`, `reticulum/`, `dashboard/`, `automations/`, `tools/`, `patterns/` (sheets, confirms, one-time reveal, Sends line, danger zone, toasts, states). Each component has a CSS module that uses role tokens.

### 5.4 Re-hosting (phase 1)

`ShellContext { embedded: boolean }`. When `embedded` is true, these hide only their own chrome (app header, top tab bar, page headers that duplicate the shell): `App`, `MeshCoreSourcePage`, `MeshCoreIngestSourcePage`, `ReticulumSourcePage`, `DashboardPage`, `MapAnalysisPage`, `ReportsPage`, `AutomationsPage`, the `Unified*` pages, `GlobalSettingsPage`, `UsersPage` and `PacketMonitorPage`. With no provider, `embedded` is false and Classic renders byte-for-byte as today; a Vitest snapshot of Classic chrome guards this. The sidebar's links drive today's `activeTab` through the same URL that today's tab clicks set. Every later phase replaces a re-hosted area with its `src/workspace/` components and deletes its `embedded` branch once nothing re-hosts that page.

### 5.5 Routes (Workspace)

Shared with Classic, same meaning:
- `/` — Overview › Map (today's landing, f6). Today's admin "Default landing page" setting is honoured.
- `/source/:id/<tab>` — that device's view.
- `/unified/messages|telemetry|packets` — Overview › Messages / Telemetry / Packets.
- `/analysis` — Overview › Map with the Analysis group open (s5n1).
- `/reports` — Overview › Reports list. `/automations`, `/users`, `/packet-monitor`, `/privacy/:slug`, `/embed/:profileId` keep their pages.

New, Workspace only (Classic redirects these to their Classic equivalents):
- `/overview` and `/overview/<tool>`: `map`, `dashboard`, `messages`, `telemetry`, `packets`, `analysis`, `reports[/<report>]`, `automations`, `users`, `audit`.
- `/source/:id/settings[/<category>[/<sub>]][?node=!id]`
- `/source/:id/node/:nodeId[/<tab>]`
- `/source/:id/dms`, `/source/:id/activity`
- `/source/:id/channel/:channel`, `/source/:id/dm/:nodeId`, `/source/:id/room/:roomId`
- `/preferences/<category>`, `/server/<category>`, `/you[/<category>]`
- `/automations/<ruleId>[/runs|/trace]`

Redirects in Workspace:
- `/source/:id/configuration#config-x` → `/settings/<x>`
- `/source/:id/settings#settings-x` → `/settings/<x>`
- `/settings#settings-x` → `/preferences/<x>` or `/server/<x>`
- `/source/:id/admin` → `/settings?node=` (remote target)
- `/source/:id/notifications` → `/settings/notifications`

The category ids come from `configSections.ts`. A table-driven test covers every redirect.

### 5.6 Theming and type

Workspace components use only `var(--color-*)` role tokens; the boards' hex palette maps to Mocha. If a role the boards need has no token (for example "device strip colour"), it is added as a token defined in every theme, never as a literal. Inter is self-hosted as woff2 (400/500/600/700), loaded only inside `WorkspaceApp`, with `font-display: swap`. It must fit the bundle-size budget script and the PWA precache cap. Targets are at least 44 px on phone and rows at least 52 px on phone; desktop buttons are 36 px (canvas convention, ledger ruling).

### 5.7 Shared Workspace patterns, built once and reused

- `Sheet` (phone bottom sheet / desktop docked side sheet)
- `ConfirmSheet` (plain, typed-word, discard, busy: 17-01/17-02)
- `DangerZone`
- `SendsLine`
- `OneTimeReveal` (call 9)
- `NodeActionMenus` (call 5: Ask the node / Organise / Data, protocol-aware, gate-aware with reasons)
- `DeviceTag`, `ReceptionsPanel`
- `SettingsFrame` + row kit (`SettingGroup`, `SettingRow`, `SettingToggle`, `SettingSelect`, `SettingNumber`, `SettingText`, plus the existing `PasswordField`)
- `RadioSaveBar` (queue, label from `configRebootRules.ts`, Review diff, Keep editing / Discard)
- `SettingsSearch` (⌘, field index from row-kit registrations plus `configSections.ts`)
- `LayersDrawer`, `MapTools`, `Inspector`
- `TwoLineRow`, `DetailSheet`, `EmptyState`/`ErrorState`/`NoPermission`

Each is built in the first phase that needs it (ledger rule from the canvas round).

## 6. Phases and board coverage

Every board belongs to exactly one phase. A board is done when its acceptance (§9) passes. The appendix lists all 324 by phase.

| Phase | Area | Boards |
|---|---|---|
| 0 | Setup: deps, Inter, Playwright harness + Athens-cast fixtures, board-check porting tool, ledger, CI job | none (infrastructure) |
| 1 | Foundation: `user_preferences`, gate, Layout + admin default, shell (rail, sidebar frame, tab bar, switcher), routes and redirects, re-host everything | a-chat-D-desktop (frame), a-chat-D-phone (frame), c-home-e2-switcher, r2-you-layout, s3-layout, r4-server-general, r3-classic-banner (built, inactive), s1-you (frame) |
| 2 | Chat + Activity: layout-D threads, DMs inbox, message actions/details/translate/emoji/search, beacons, read-only states, Activity feed + endpoint, push toggles (backend) | a-chat-D-* (content), c-home-e1, e3, e4, e5, e6, all of §10 (16), 18-05, 18-06 |
| 3 | Map, Nodes, node page, map editing | Main, f2, f3, f4, f5, g1, g2, g3, g4, g5, all of §15 (26) |
| 4 | Overview: Home, Map + Analysis, Reports, unified views, Users, Audit, packet pop-out, MQTT receptions | f6, all of §5 (13), §6 (15), §7 (9), o4, o5, q4, 13-13, 13-18, 16-03, 16-08, 18-01…18-04 |
| 5 | Device settings frame (Meshtastic + MQTT/bridge): row kit, save bar, Review, ⌘, search, pins, remote target, Notifications (+ Replies/Mentions toggles UI) | b-set-d1…d6, b-set-p1…p4, s2, all of §12 (29), 18-07, 18-08 |
| 6 | You, Server, sign-in, add device, devices and states | b-set-d7, b-set-p5, r1, s4, all of §11 (13), §13 except 13-13/13-18 (27), 18-09…18-12, h1…h6, i1…i6 |
| 7 | MeshCore + Reticulum | g6, all of §8 (31), §9 (16) |
| 8 | Dashboard, Automations, More tools | j1…j3, k1…k3, 16-04, m1…m4, n1…n4, all of §14 (16), o1, o2, o3, q1, q2, q3, 16-01, 16-02, 16-05, 16-06, 16-07 |
| 9 | Shared patterns and odd pages; gate removal; r3 on | all of §17 (16); r3 behaviour on |
| F | Whole-branch review (most capable model), one fix pass, final report | — |

Where a later phase owns a pattern an earlier board shows (for example the confirm sheet on 10-01), the earlier phase builds it to that board and the later phase's board reuses it.

## 7. Backend changes (the complete list)

Each change is required by a board or decision. Anything outside this list needs a `Ruling:` that names the board note requiring it. Read-only endpoints for data a board needs that no API exposes are allowed under that rule; write-path behaviour changes are not.

1. **`user_preferences` table** (D6). Columns: `userId` FK → users (cascade delete), `key` (text, ≤64), `value` (JSON text), `updatedAt`; unique `(userId, key)`. Migration on all three backends via the migration skill and helpers, idempotent. Added to `BACKUP_TABLES` after `users`. Repository `UserPreferencesRepository` (get/getAll/set/delete, scoped to a userId). Routes `GET/PUT/DELETE /api/user/preferences[/:key]`: self only, `requireAuth`, key allowlist (`layout`, `workspace.*`, `settings.pins`, `dashboard.<sourceId|overview>`), value size cap 64 KB, `ok()`/`fail()` envelope, route tests on `createRouteTestApp()`.
2. **Install settings** in `VALID_SETTINGS_KEYS`:
   - `defaultLayout` (`classic`|`workspace`)
   - `offerWorkspaceBanner` (r4 toggle)
   
   Per-user banner dismissal is stored as `user_preferences` key `workspace.bannerDismissed`. The build-time gate is the env var `WORKSPACE_PREVIEW` (D3), read at startup and exposed read-only to the client; it is not a setting and is removed in phase 9.
3. **"Who uses which" (r4):** read-only, admin-only count of users who signed in during the last 30 days (`lastLoginAt`), by resolved layout.
4. **Activity (cs1/cs2):** `GET /api/sources/:id/activity?before=&limit=` returns, for the selected device's own node only:
   - replies to messages it sent (`replyId`),
   - emoji reactions to them, collapsed per message,
   - mentions of it (`@!<id>` per `utils/mentions.ts` on Meshtastic, `@[Name]` on MeshCore).
   
   Read straight from `messages`/`meshcore_messages`, scoped by `sourceId`, `messages:read` on that source with `sourceIdFrom`, with the same channel/DM visibility filtering as today's message lists.
5. **Push toggles (cs2, D13):** `notifyOnReply` (new column) and Meshtastic coverage for the existing `notifyOnMention` (today MeshCore only), both default **off**. The push fires once per qualifying incoming message through the existing push/Apprise pipeline and mutes, never for our own sends (self-origin guard). Migration on three backends. UI lands in phase 5 (Settings › Notifications, s2/b-set-d5).
6. **Per-user dashboard (ds9, D12):** stored as `user_preferences` `dashboard.<sourceId>` and `dashboard.overview`, seeded on first read from `dashboardWidgets`. No server change beyond (1).
7. **Settings pins:** `user_preferences` `settings.pins` (category ids, any scope). No server change beyond (1).

No other schema, protocol or write-path change. Each schema item runs the full suite with the PG and MySQL containers up (§10).

## 8. Mesh impact (CLAUDE.md checklist)

1. **Airtime.** Workspace adds no transmission. Every control that sends already exists; its Sends line is computed from existing settings. Remote "Read from node" is per category and only on press (it never auto-reads on open), so it is no worse than today's Admin tab. Activity, the health strip, Reports and unified views read the database only.
2. **Spam.** The one new notification path is (7.5). Off by default; at most one push per incoming message that replies to or mentions the user's own node; never for our own messages; existing mutes and channels apply. Activity itself is a read-only view and fires nothing. No new automation triggers or `dataEventEmitter` events.
3. **Timers.** Workspace adds no scheduler. Settings saves in Workspace call today's handlers, so existing persisted timers (`lastAnnouncementTime` etc.) behave as today. Phase 5 adds a test that a Workspace save of auto-announce and of an automation does not reset the persisted last-fire time.

No new limits are proposed. If implementation finds a board that would add traffic, the task is parked (D14) and the numbers go to the requester.

## 9. Acceptance per board

A board is done when all of these hold:
1. **Strings:** every `must` string of its `checks/*.json` entry renders and no `absent` string does, in a Vitest/RTL test on fixture data (D9b may swap a board string for today's en.json string; the swap is logged as a Ruling and the check edited to match).
2. **Screen:** the Playwright suite renders the board's screen at its size (390×844 or 1280×800) on fixtures. The screenshot is attached to the phase's review and compared side by side with `png3/<board>.png` by the task reviewer: same regions, same order, same controls, same states. Fake data may differ.
3. **Fit:** no horizontal page overflow; phone targets ≥44 px; no text clipped sideways (the canvas's CLIP rule).
4. **Notes:** every behaviour in the board's section notes that applies to it is implemented, or recorded as a D9 deviation Ruling.
5. **Gates and Sends:** permissions match today's (tested with the route harness where a route changes, RTL with a permission fixture otherwise). Every transmitting control shows its Sends line. Every destructive control uses `ConfirmSheet` with today's words.

Phase done:
- every board in the phase accepted;
- `npm run lint:ci` clean (in-repo FAILs only);
- the full Vitest suite green (with PG/MySQL up when the phase touches schema);
- `npm run build` + `check:bundle-size` green;
- Playwright suite green;
- the PR body updated, saying CI has not run (D20).

## 10. Test and verification setup

- **Vitest/RTL** next to components. Board-check assertions come from a tool, `scripts/workspace/port-board-checks.mjs`, that copies the needed `checks/*.json` entries into `src/workspace/__fixtures__/board-checks/` (committed, so tests don't depend on the git-excluded scratch folder).
- **Fixtures:** one Athens-cast dataset (Station G2, Heltec MeshCore, Rooftop RAK, Reticulum node, Athens MQTT; Athens node names) under `src/workspace/__fixtures__/`. Vitest uses it through mocked `ApiService`; Playwright uses it through `page.route()` interception, so no backend runs.
- **Playwright:** `@playwright/test` as a devDependency, pinned to the preinstalled browser's version, or launched with `executablePath: /opt/pw-browsers/chromium` if the pin differs. Specs live in `tests/workspace-e2e/`, run with `--trace off`, and `npm run test:workspace-e2e` builds and serves with `vite preview`. A CI job for it is committed (screenshots uploaded as an artifact) so it runs wherever Actions is on, but it is not part of the gate (D20). Screenshots are not committed.
- **Board review sheets:** per phase, a contact sheet pairs each screenshot with its png3 board. It is published as a private artifact and linked from the PR body.
- **PG/MySQL:** the containers from CLAUDE.md, on the dockerd started in this session. If an image can't be pulled after retries, the schema task is parked (D14): with Actions off (D20) there is no other authority.
- **Missing checks and renders:** 41 non-rejected boards have no `checks/*.json` entry. Before a phase's implementation starts, a separate agent writes their must/absent strings from the board HTML and its section notes, so the grader is not the builder; each is logged as a Ruling. The 16 boards missing from `png3/` are rendered with `design-scratch/render.mjs`.
- **Classic guard:** a Vitest snapshot of Classic's chrome with no `ShellContext`, plus the existing Classic suites unchanged.

## 11. Process

- Execution: superpowers:subagent-driven-development, per the plan from superpowers:writing-plans.
- Ledger: committed at `docs/superpowers/workspace-ledger.md`, because the container is ephemeral. Every decision taken during the build is a `Ruling:` line with why and cost if wrong. `BLOCKED:` lines for D14.
- Commits on `claude/eager-pascal-svegts`, pushed after each task. One draft PR opened after phase 1, body updated per phase. No `/ci-monitor` while Actions is off (D20); if Actions is ever turned on, `/ci-monitor` runs after each push.
- The run stops only for destructive or irreversible actions, security-sensitive changes, or a plan defect with no sensible path; each of those is parked per D14. The auth-touching items here (preferences routes, Activity endpoint permission checks) are covered by the plan's security review step, not stopped on.
- Finish: whole-branch review on the most capable model, one fix pass, final report (Rulings, deferred minors, board-by-board coverage).

## 12. Open questions for the requester

The builder check raised four questions; all were answered on 2026-11-13 and are now D3, D18, D19 and D20. None remain open.

Calls I made from the builder check (check these):
- Add device builds on today's create, status and delete source APIs; no new endpoint.
- Activity read state (what is "new" in the feed) is per user, in `user_preferences` under `workspace.activity.<sourceId>`.
- "Workspace display preferences" means r2's In Workspace rows (Messages as Rows / Bubbles; Hops, SNR and route On hover or tap), stored under `workspace.*`.
- The missing checks and renders are handled as §10 describes.

## 13. Left to the builder

- Component APIs, file splits, and which existing components are wrapped versus composed.
- Fixture contents beyond the cast.
- The exact field-index format for ⌘, search.
- The order of tasks inside a phase.
- How each board's screen is reached in Playwright.

## Appendix A. Boards by phase (324)

- **P1 (8):** a-chat-D-desktop, a-chat-D-phone (frames), c-home-e2-switcher, r2-you-layout, r3-classic-banner, r4-server-general, s1-you, s3-layout
- **P2 (23):** a-chat-D-desktop, a-chat-D-phone (content; counted in P1), c-home-e1-home, c-home-e3-dms, c-home-e4-activity, c-home-e5-activity-empty, c-home-e6-desktop-activity, 10-01…10-16, 18-05, 18-06
- **P3 (36):** Main, f2-layers, f3-nodes, f4-node, f5-telemetry, g1-map, g2-layers, g3-nodes, g4-node, g5-links, 15-01…15-26
- **P4 (49):** f6-overview, 5-01…5-13, 6-01…6-15, 7-01…7-09, o4-users, o5-audit, q4-permissions, 13-13, 13-18, 16-03, 16-08, 18-01…18-04
- **P5 (42):** b-set-d1…d6, b-set-p1…p4, s2-notifications, 12-01…12-29, 18-07, 18-08
- **P6 (60):** b-set-d7, b-set-p5, r1, s4, 11-01…11-13, 13-01…13-29 except 13-13 and 13-18, 18-09…18-12, h1…h6, i1…i6
- **P7 (48):** g6-meshcore, 8-01…8-31, 9-01…9-16
- **P8 (42):** j1…j3, k1…k3, 16-04, m1…m4, n1…n4, 14-01…14-16, o1, o2, o3, q1, q2, q3, 16-01, 16-02, 16-05, 16-06, 16-07
- **P9 (16):** 17-01…17-16
- **Excluded (6):** a-chat-A-*, a-chat-B-*, a-chat-C-* (rejected options)
