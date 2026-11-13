# Workspace Layout (#6365) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the opt-in "Workspace" layout, the 324 non-rejected boards of the design canvas, alongside today's layout ("Classic"), which keeps working unchanged.

**Architecture:** `LayoutGate` in `src/main.tsx` renders either today's `<Routes>` untouched or `WorkspaceApp`, a separate tree with its own routes under the same `BrowserRouter`. Phase 1 re-hosts every existing page inside the Workspace shell through `ShellContext { embedded }`. Phases 2–9 each replace one area with new components under `src/workspace/` built to their boards. Those components reuse today's hooks, contexts, API calls and en.json strings.

**Tech Stack:** React 19 + TypeScript + Vite, react-router-dom, TanStack Query, react-i18next (`public/locales/en.json`), CSS modules with `var(--color-*)` role tokens, Express 5 + Drizzle (SQLite/PostgreSQL/MySQL), Vitest + Testing Library, `@playwright/test` (new).

**Spec:** `docs/superpowers/specs/2026-11-13-workspace-redesign-design.md` (decisions D1–D20). Canvas: https://claude.ai/artifact/P42mrYmhRiCfRoUnTx5G2t, v42, with a local copy in `design-scratch/out3/project/`. Read the section notes in `canvas.json` for every board you build.

## Global Constraints

- Classic changes only in three ways: the `ShellContext` hook, the r3 banner and one user-menu item "Try the Workspace layout" (D18). Banner and menu item are inert until Task 9.3.
- Behaviour-preserving extractions are allowed (Rule X): moving state or handlers out of a Classic component into a shared hook so Workspace can reuse them. They must leave Classic's DOM and behaviour identical and keep Classic's existing tests green with no test edits.
- Server env `WORKSPACE_PREVIEW=true` is the build-time gate (D3). Without it everyone gets Classic. Task 9.3 removes the check.
- Phone layout below 768 px; desktop shell from 768 px; sidebar becomes an overlay drawer at 768–1023 px (D8). Use `useIsPhone()` (Task 1.6), not ad-hoc media queries.
- Workspace CSS: CSS modules only, `var(--color-*)` tokens only (new tokens defined in every theme), Inter via the Task 0.1 font CSS, phone targets ≥44 px, phone rows ≥52 px, desktop buttons 36 px.
- Copy: the board's text, unless an existing en.json string labels the same control; then today's string wins (D9b). New strings go in `public/locales/en.json` under `workspace.*`. No hardcoded emoji or Unicode icons; use `UiIcon` / `BrandIcon`.
- Boards that show several dialogs or menus at once are built one at a time (D9c). Today's behaviour wins over a board unless the board's note explicitly overrides it (D9d). Every deviation gets a `Ruling:` line in the ledger.
- No new mesh traffic, no new limits, no new timers. Every transmitting control shows a `SendsLine`. Every destructive control uses `ConfirmSheet` with today's words (typed word only where today asks for one).
- Per-source scoping and today's permission gates everywhere; `requirePermission` on any new route that takes a `sourceId` uses `sourceIdFrom`.
- Relative imports in server-compiled code end in `.js`; no raw SQL outside `src/db/repositories/` and `src/server/migrations/`; API handlers use `ok()` / `fail()`.
- Nothing is merged, and no branch other than `claude/eager-pascal-svegts` is pushed. Actions is off (D20); `/ci-monitor` is not used.

## Review Focus

1. **Many devices.** An install with 15+ sources, or long device names: the rail scrolls, the switcher sheet scrolls, and the sidebar header truncates with an ellipsis. Nothing overflows sideways. Test in Task 1.6.
2. **Partial permissions.** A user who can read only some sources, or only some channels: the rail shows only readable sources; Activity, Overview, the unified views and search never show a row from an unreadable source or channel. Tests in Tasks 1.6, 2.7, 4.6.
3. **Deep links under `BASE_URL`.** With a basename such as `/meshmonitor`:
   - a Classic user opening a Workspace-only URL lands on its Classic equivalent;
   - a Workspace user opening a Classic `#section` URL lands on the new category;
   - a reload keeps the place.
   Tests in Tasks 1.4, 1.6.
4. **The open device goes away.** The current source is disabled, deleted or disconnects while open: the shell shows the offline state or falls back to Overview, with no blank screen and no crash loop. Test in Task 1.6.
5. **Non-Mocha themes.** With Latte or a custom theme active, every Workspace surface stays legible (no hex literals, no Mocha-only colours). Test in Task 0.1 (lint rule covers CSS modules) and a Latte Playwright screenshot of three boards in Task 9.1.

---

## How every task runs (read once)

A board named in two tasks is built in stages: the frame first, then the content (`a-chat-D-*`, `c-home-e2`), or its cards split (`r4` in 1.8 and 6.4, the discard sheet of `17-02` in 5.3 and 9.1). The later task owns its acceptance.

### Ledger

`docs/superpowers/workspace-ledger.md` is committed in Task 0.2. Every decision taken while building goes in as one line:
`Ruling: <task> <board?> — <decision> — why: … — cost if wrong: …`
A parked item goes in as `BLOCKED: <task> — <reason> — skipped: <tasks>` (D14). The controller writes the ledger lines; implementers report candidate rulings in their task report.

### Board protocol (BP)

A task that names boards runs these steps for each board group, in order. The task lists only what is specific to it.

- [ ] **BP1. Read the board.**
  - Open `design-scratch/png3/<board>.png` and `design-scratch/out3/project/<board>.dc.html`.
  - Read the canvas section notes for the board's section (`canvas.json` → `notes`, keys `s<N>n*`, or the row notes `ds*`, `bs*`, `cs*`) and the board's `inventory/` lines.
  - List in the task report: every control, state and string the board shows, plus what its notes say lives elsewhere.
- [ ] **BP2. Write the failing board test** in `src/workspace/<area>/__tests__/<board>.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { renderWorkspace } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';

it('<board> shows the board', async () => {
  const { container, findByText } = renderWorkspace(<Route>, { route: '<path>', phone: <bool> });
  await findByText('<first must string>');
  expectBoard('<board>', container);
});
```

  Add one behaviour test per interaction the board implies:
  - open sheet → its title is shown;
  - a gated item without permission → disabled, with today's reason;
  - a transmitting control → its `SendsLine` text;
  - a destructive control → `ConfirmSheet` with today's word.
- [ ] **BP3. Run it and see it fail.** `npx vitest run src/workspace/<area>/__tests__/<board>.test.tsx`. Expected: FAIL (component missing or must-string not found).
- [ ] **BP4. Implement** the components named in the task, re-composing the existing parts it lists.
- [ ] **BP5. Run the test until it passes.** Same command. Expected: PASS.
- [ ] **BP6. Add the board to Playwright.** Add an entry to `tests/workspace-e2e/boards.ts`: `{ id: '<board>', size: 'phone'|'desktop', path: '<route>', setup?: async (page) => {…open the sheet/menu…} }`. Run `npm run test:workspace-e2e -- --grep <board>`. Expected: PASS, with a screenshot at `test-results/workspace-boards/<board>.png`. Compare it with png3 and state the result in the task report: same regions, order, controls and states, with fake data allowed to differ.
- [ ] **BP7. Run the task gate (TG), then commit.**

### Task gate (TG)

A task is done only when all of these hold:
1. **Lint.** `npm run lint:ci 2>&1 | grep '^FAIL' | grep -v '.claude/worktrees'` prints nothing.
2. **Full Vitest suite.** `npx vitest run --reporter=json --outputFile=/tmp/vitest.json` reports `numFailedTests: 0` and `success: true`.
   - When the task touches `src/db/` or `src/server/migrations/`, run it with both containers up:

     ```bash
     docker run -d --rm --name mm-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=meshmonitor_test -p 5433:5432 postgres:16
     ```

     ```bash
     docker run -d --rm --name mm-test-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_USER=test -e MYSQL_PASSWORD=test -e MYSQL_DATABASE=meshmonitor_test -p 3307:3306 mysql:8.4
     ```

   - Then confirm `numPendingTests` dropped compared with a no-container run. If an image can't be pulled after 4 tries, park the task (D14).
3. **Build.** `npm run build && npm run check:bundle-size` exits 0.
4. **Playwright**, for tasks with boards: `npm run test:workspace-e2e` passes.
5. **Commit and push.** Commit on `claude/eager-pascal-svegts` with a conventional message ending in the session's attribution lines, then `git push origin claude/eager-pascal-svegts` (retry 4× with backoff).

### Phase gate (PG)

Run at the end of each phase:
1. Every board of the phase is accepted (spec §9).
2. The PR body is updated. It lists the phase's commit range, its boards, the screenshot contact-sheet link and its Rulings, and says "CI has not run on this fork (Actions off)".
3. A contact sheet comes from `node scripts/workspace/contact-sheet.mjs <phase>`. It writes HTML pairing each screenshot with its png3 board into the session scratchpad; publish it as a private artifact and put the link in the PR body.

### Code map (where today's parts live)

| Area | Parts to reuse (paths under `src/`) |
|---|---|
| Routing | `main.tsx` (`SourceApp`, `sharedProviders`, `sourceRouteProviders`, `appBasename` from `./init`); `appTabs.ts` (`preloadAppTab`); `types/ui.ts` `VALID_TABS`; `contexts/UIContext.tsx` (`activeTab` derived from the last path segment, `setActiveTab` navigates `/source/:id/<tab>`). |
| Auth | `contexts/AuthContext.tsx` `useAuth()` → `{authStatus, hasPermission(resource, action, {sourceId?, anySource?}), …}`; server `server/auth/authMiddleware.ts` (`optionalAuth`, `requireAuth`, `requirePermission`, `requireAdmin`); anonymous = `req.user.username === 'anonymous'`. |
| API | `services/api.ts` default `apiService` (`get/post/put/patch/delete`); `server/utils/apiResponse.ts` `ok`/`fail`; route tests use `server/test-helpers/routeTestApp.ts` `createRouteTestApp`. |
| Sources | `hooks/useDashboardData.ts` (`useDashboardSources`, `useSourceStatuses`, `useUnifiedStatus`, `useDashboardSourceData`, `useDashboardUnifiedData`); CRUD calls in `pages/DashboardPage.tsx` (`POST/PUT/DELETE /api/sources`, `/reorder`, `/connect`, `/disconnect`, `/resync`, `/prune-outside-roi`); `hooks/useUnreadBySource.ts`, `hooks/useUnreadCounts.ts`, `components/MeshCore/hooks/useMeshCoreUnread.ts`. |
| Meshtastic data | `hooks/usePoll.ts`, `hooks/useServerData.ts` (`useNodes`, `useChannels`, `useDeviceConfig`, `useTelemetryNodes`), `hooks/useSourceView.ts`, `hooks/useMessagingView.ts`, contexts `Data`, `Messaging`, `UI`, `Map`, `Settings`, `composeDraftStore`. App message handlers: `App.tsx` `handleSendMessage` :2728, `handleSendDirectMessage` :2298, `handleSendTapback` :2391, `handleResendMessage` :2948, `handleDeleteMessage` :2469, `handlePurgeChannelMessages` :2503, node asks :2060–2232, `toggleIgnored` :3121, `toggleHideFromMap` :3213, position override :2700. |
| Chat parts | `components/ChannelsTab.tsx`, `MessagesTab.tsx`, `messages/{ChannelMessageRow,DmMessageRow,messageRowSupport,UnreadDivider}`, `MessageComposeInput.tsx`, `EmojiPickerModal/`, `translation/*`, `diagnostics/MessageDetailsModal.tsx`, `SearchModal/`, `beacons/*`, `notifications/MuteMenu.tsx`, `security/KeyMismatchWarning`, `traceroute/*`, `messagesReadOnlyState.ts`. |
| Map / nodes | `NodesTab.tsx`, `map/BaseMap.tsx`, `map/MapSidebar.tsx`, map layers in `map/layers/*` and NodesTab, `map/popups/{NodeCard,sections}`, `NodePopup/`, `NodeDetailsBlock.tsx`, `TelemetryGraphs.tsx`, `TracerouteHistoryModal`, `PurgeDataModal`, `PositionOverrideModal`, `CopyNodeInfoModal`, `NodeIdentityMergeDialog`, `TelemetryRequestModal`, `WaypointEditorModal`, `map/LocalMarkerEditorModal`, `MeasureDistanceController`, `nodes/ImportContactUrlModal`, `AdvancedNodeFilterPopup/`, `Dashboard/DashboardNeighborPopup`. |
| Overview | `components/Dashboard/{DashboardSidebar,DashboardMap}`; `pages/MapAnalysisPage.tsx` + `components/MapAnalysis/*` (`MapAnalysisProvider`, `useMapAnalysisCtx`, toolbar, canvas, `AnalysisInspectorPanel`, `LinkProfileDrawer`, `SitePlannerPanel`, `GnssDopPanel`, `TimeSliderControl`); `components/Analysis/*` reports; `pages/Unified*`; `MessageExportDialog/`; `PacketMonitorPanel.tsx`; `utils/packetMonitorPopout.ts`; `MQTT/MqttPacketMonitorView`; `UsersTab.tsx`; `AuditLogTab.tsx`; `AdminPasskeysDialog.tsx`. |
| Settings | `ConfigurationTab.tsx` + `configuration/*` sections; `search/configSections.ts`; `utils/configRebootRules.ts` (`rebootExpectation`); `contexts/SaveBarContext.tsx`, `hooks/useSaveBar.ts`, `hooks/useSectionBaseline.ts`, `common/NumberInputScope`; `search/ConfigSearchHost.tsx`; `RebootModal.tsx`; `hooks/usePolicyChangeConfirm.ts`; `AdminCommandsTab.tsx` + `admin-commands/*`; `SettingsTab.tsx` (section ids `settings-*`); `NotificationsTab.tsx`; `nav/sourceNavEntries.ts`. |
| Account | `LoginPage`, `LoginModal`, `UserMenu`, `MFAManagement`, `PasskeyManagement`, `PasswordLoginControl`, `RecoveryCodesDialog`, `ChangePasswordModal`, `APITokenManagement`, `services/passkeyClient.ts`. |
| MeshCore | `pages/MeshCoreSourcePage.tsx`, `MeshCore/MeshCorePage.tsx` (view in local state), `meshCoreViewAccess.ts`, the views listed in spec §6 P7, `CliConsoleBody.tsx`, `hooks/useMeshCore.ts` (`actions`), `MeshCoreIngestSourcePage`. |
| Reticulum | `pages/ReticulumSourcePage.tsx`, `Reticulum/ReticulumPage.tsx` (view in local state), `Reticulum*View`, `hooks/useReticulum.ts`. |
| Dashboard / automations / tools | `Dashboard/Dashboard.tsx` (+ `dataSources.ts`, `useCustomWidgets.ts`, `AddWidgetModal.tsx`), `automations/AutomationsPage.tsx` (`AutomationsList`, `AutomationEditor`, `AutomationBuilder`, `RunLog`, `LiveTracePanel`, `VariablesList`, `TemplateGallery`), `AutomationTab.tsx` + its sections, `ScriptTestModal.tsx`, `InfoTab.tsx`, `SecurityTab.tsx`. |
| Shared | `ToastContainer` (`useToast`), `DeviceNotificationToaster`, `AppBanners`, `RouteLoading`, `common/AppErrorScreen`, `common/ErrorBoundary`, `common/TypedConfirmDialog`, `shared/automation/ConfirmDialog`, `NewsPopup`, `SystemStatusModal`, `TelemetryOutlierDialog`, `MQTT/brokerPresets` + `SavedBrokerPresetDialogs`, `PrivacyDocumentPage`, `EmbedMap.tsx`. |

---

## Phase 0: Setup

### Task 0.1: Test harness, fixtures, Inter

**Files:**
- Modify: `package.json` (devDependency `@playwright/test`, script `test:workspace-e2e`), `package-lock.json`
- Create:
  - `tests/workspace-e2e/playwright.config.ts`, `tests/workspace-e2e/boards.ts`, `tests/workspace-e2e/boards.spec.ts`, `tests/workspace-e2e/fixtureRoutes.ts`
  - `src/workspace/__fixtures__/athens.ts`, `src/workspace/__fixtures__/fixtureApi.ts`
  - `src/workspace/test/renderWorkspace.tsx`, `src/workspace/test/boardChecks.ts`
  - `src/workspace/styles/fonts.css`, `public/fonts/inter/Inter-{400,500,600,700}.woff2` (+ `OFL.txt`)
  - `.github/workflows/workspace-e2e.yml`
- Test: `src/workspace/test/__tests__/harness.test.tsx`

**Interfaces:**
- Produces:
  - `athensFixture`: the cast from spec §10 (Station G2 `meshtastic_tcp`, Heltec MeshCore `meshcore`, Rooftop RAK `meshtastic_tcp`, Reticulum node `reticulum`, Athens MQTT `mqtt_broker`; Athens node names). It covers sources, statuses, nodes, channels, messages, telemetry, settings, `/api/config` (`workspacePreview: true`) and `/api/user/preferences` (`{layout:'workspace'}`). Types match today's API responses.
  - `fixtureApi(overrides?: Partial<Record<string, FixtureHandler>>): (url: string, init?: RequestInit) => Response | undefined`, with `type FixtureHandler = (url: URL, init?: RequestInit) => unknown | Response`. Keys are `'<METHOD> <path-pattern>'` with `:param` segments.
  - `renderWorkspace(ui: ReactElement, opts?: { route?: string; phone?: boolean; permissions?: Partial<SourcedPermissionSet>; isAdmin?: boolean; anonymous?: boolean; fixtures?: Parameters<typeof fixtureApi>[0] }): RenderResult`. It renders with real English strings from `public/locales/en.json`, overriding the global i18n mock for that render, inside `QueryClientProvider`, `MemoryRouter`, auth and source providers. It stubs `global.fetch` with `fixtureApi`. `phone: true` makes `matchMedia('(max-width: 767.98px)')` match.
  - `expectBoard(boardId: string, container: HTMLElement): void` reads `src/workspace/__fixtures__/board-checks/<boardId>.json` (`{ must: string[]; absent: string[] }`) and asserts on `container.textContent` normalized for whitespace.
  - `BOARDS: Array<{ id: string; size: 'phone' | 'desktop'; path: string; setup?: (page: Page) => Promise<void> }>`.
  - npm script `test:workspace-e2e` = `vite build && playwright test -c tests/workspace-e2e/playwright.config.ts --trace off`. The config's webServer runs `vite preview --port 4179`. Viewports: phone 390×844, desktop 1280×800. Chromium uses `executablePath: '/opt/pw-browsers/chromium'` when `@playwright/test`'s own browser is missing.

- [ ] **Step 1: Write the failing harness tests**:
  - `renderWorkspace(<p>{t('common.save')}</p>)` shows the en.json value of `common.save` (pick an existing key);
  - `fixtureApi()('/api/sources')` returns 5 sources;
  - `expectBoard` passes on a container holding a fixture json's must strings and throws when an absent string is present (use a temp fixture `__test__.json`).
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/workspace/test` → FAIL (modules missing).
- [ ] **Step 3: Implement** the harness, fixtures and Playwright config. Add `@playwright/test` pinned to the version of the preinstalled global Playwright (`npx playwright --version`).
  - Inter: download 4 weights from the Inter release (OFL) into `public/fonts/inter/`. `fonts.css` declares `@font-face` with `font-display: swap`.
  - The CI workflow runs `npm ci && npm run test:workspace-e2e` and uploads `test-results/workspace-boards` as an artifact. It is not required (D20).
- [ ] **Step 4: Run them until they pass.** `npx vitest run src/workspace/test` → PASS. Also run `npm run test:workspace-e2e` with an empty `BOARDS`: it must exit 0.
- [ ] **Step 5: TG, then commit** `chore(workspace): test harness, Athens fixtures, Playwright, Inter`.

### Task 0.2: Board checks, missing renders, ledger

**Files:**
- Create: `scripts/workspace/port-board-checks.mjs`, `src/workspace/__fixtures__/board-checks/*.json`, `scripts/workspace/contact-sheet.mjs`, `docs/superpowers/workspace-ledger.md`
- Test: `scripts/workspace/port-board-checks.node-test.mjs`

**Interfaces:**
- Produces:
  - `node scripts/workspace/port-board-checks.mjs [--source design-scratch/checks]` writes one `<board>.json` per board: `{ must, absent, source: 'checks/<file>' | 'written' }`. It reads `checks/s*.json` `boards` maps and `r2.json` `redraw` `file_must`/`file_absent`. It skips `a-chat-A|B|C-*`. It prints the boards with no entry and exits 1 while any board without a json remains.
  - `node scripts/workspace/contact-sheet.mjs <phase>` reads the spec's Appendix A board list for that phase. It writes `<scratchpad>/contact-<phase>.html`, with `test-results/workspace-boards/<id>.png` beside `design-scratch/png3/<id>.png` and `src` paths inlined as data URIs.

- [ ] **Step 1: Write the failing node test.** On a temp dir holding one `checks/s99.json` with two boards, the script writes two jsons with the right must/absent and exits 1 listing a third board from a fake canvas order.
- [ ] **Step 2: Run it and see it fail.** `node --test scripts/workspace/port-board-checks.node-test.mjs` → FAIL.
- [ ] **Step 3: Implement both scripts.** Run the port script. It lists about 70 boards with no checks: the early approved rows `a-chat-D-*`, `b-set-*`, `c-home-*`, `Main`, `f*`, `g*`, `h*`, `i*`, `j*`, `k*`, `m*`, `n*`, `o1`, `o3`, `o4`, `q1`, `q2`, `q4`, `r1`–`r4`, `s2`–`s4`.
- [ ] **Step 4: Write the missing checks with an independent agent.** The controller dispatches a fresh agent, not the phase implementer. It writes `must` (8–25 strings each: headings, control labels, states, Sends lines) and `absent` strings for each listed board from its `.dc.html` text and section notes, with `source: 'written'`. Each one gets a ledger line `Ruling: 0.2 <board> — checks written by the check agent`.
- [ ] **Step 5: Render the 10 boards missing from png3.** `node design-scratch/render.mjs` for `a-chat-D-desktop`, `b-set-p1…p5`, `c-home-e1`, `e3`, `e4`, `e5`. Expected: 10 new PNGs in `design-scratch/png3/`.
- [ ] **Step 6: Run the tests until they pass.** `node --test scripts/workspace/port-board-checks.node-test.mjs` → PASS. `node scripts/workspace/port-board-checks.mjs` → exit 0.
- [ ] **Step 7: Create the ledger.** It holds a header explaining `Ruling:` and `BLOCKED:` lines and links the spec and plan.
- [ ] **Step 8: TG, then commit** `chore(workspace): board checks, contact sheets, ledger`.

---

## Phase 1: Foundation

### Task 1.1: `user_preferences` table and repository

**Files:**
- Create: `src/server/migrations/233_add_user_preferences.ts`, `src/db/repositories/userPreferences.ts`, `src/db/repositories/userPreferences.test.ts`
- Modify:
  - `src/db/schema/misc.ts` (3 tables)
  - `src/db/activeSchema.ts` (key `userPreferences` in the interface and in all three dialect maps)
  - `src/db/migrations.ts` (register 233)
  - `src/db/repositories/index.ts`
  - `src/services/database.ts` (field, getter, instantiation, facade)
  - `src/server/services/systemBackupTables.ts` (`'user_preferences'` after `'users'`)

**Interfaces:**
- Produces:
  - Table `user_preferences`. SQLite columns: `id` integer PK autoincrement, `user_id` integer NOT NULL FK users ON DELETE CASCADE, `key` text NOT NULL, `value` text NOT NULL, `updated_at` integer NOT NULL. PG/MySQL use camelCase (`userId`, `key`, `value`, `updatedAt` BIGINT). Unique `(userId, key)`.
  - `class UserPreferencesRepository extends BaseRepository`:
    - `getAll(userId: number): Promise<Record<string, unknown>>` (values JSON-parsed)
    - `get(userId: number, key: string): Promise<unknown | undefined>`
    - `set(userId: number, key: string, value: unknown): Promise<void>` (JSON.stringify + upsert)
    - `delete(userId: number, key: string): Promise<void>`
    - `countByValue(key: string, userIds: number[]): Promise<Record<string, number>>`
  - `DatabaseService` facade: `getUserPreferencesAsync`, `getUserPreferenceAsync`, `setUserPreferenceAsync`, `deleteUserPreferenceAsync`, `countUserPreferenceValuesAsync`.

- [ ] **Step 1: Write the failing repository tests** on SQLite plus `describe.skipIf(!postgresAvailable)` and `!mysqlAvailable` blocks. The PG and MySQL blocks use `createIsolatedPostgresDatabase('userprefs')` and `createIsolatedMysqlDatabase('userprefs')`.
  - set then get round-trips `{a:[1,'x']}`;
  - set twice keeps one row;
  - getAll only returns that user's rows;
  - deleting the user cascades;
  - `countByValue('layout',[u1,u2,u3])` → `{workspace:2, classic:1}`.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/db/repositories/userPreferences.test.ts` → FAIL.
- [ ] **Step 3: Implement the migration** with the `/migration` skill: idempotent `CREATE TABLE IF NOT EXISTS` on SQLite and PG, `createTableIfMissingMysql` on MySQL, inline unique key, settingsKey `migration_233_add_user_preferences`. Then the schema, repository, facade and backup entry.
- [ ] **Step 4: Run them with containers up until they pass.** Same command → PASS on all three backends. Also run `npx vitest run src/server/services/systemBackupService.tables.test.ts src/db/migrations.test.ts` → PASS.
- [ ] **Step 5: TG (with PG/MySQL), then commit** `feat(db): user_preferences table (#6365)`.

### Task 1.2: Preferences API, install settings, layout usage, preview flag

**Files:**
- Create: `src/server/constants/userPreferenceKeys.ts`, `src/server/routes/userPreferencesRoutes.preferences.test.ts`
- Modify:
  - `src/server/routes/userPreferencesRoutes.ts`
  - `src/server/constants/settings.ts` (add `defaultLayout`, `offerWorkspaceBanner` to `VALID_SETTINGS_KEYS`, `GLOBAL_ONLY_SETTINGS_KEYS`, `ADMIN_ONLY_SETTINGS_KEYS`)
  - `src/server/routes/settingsRoutes.ts` (reject a `defaultLayout` other than `classic`|`workspace` with `fail(res,400,'INVALID_SETTING_VALUE',…)`)
  - `src/server/config/environment.ts` (`workspacePreview: boolean` from `WORKSPACE_PREVIEW === 'true'`)
  - `src/server/routes/configRoutes.ts` (add `workspacePreview` to `GET /api/config` for every caller)
  - `src/server/routes/adminRoutes.ts` (`GET /api/admin/layout-usage`)

**Interfaces:**
- Produces:
  - `isAllowedUserPreferenceKey(key: string): boolean`. Allowed: `layout`, `settings.pins`, and `/^workspace\.[a-z0-9.-]{1,64}$/i`, `/^dashboard\.(overview|[A-Za-z0-9_-]{1,64})$/`.
  - `validateUserPreferenceValue(key: string, value: unknown): string | null` returns an error message or null. `layout` must be `'classic' | 'workspace'`. Every value's JSON is ≤ 65536 bytes.
  - `GET /api/user/preferences` (`optionalAuth`): `ok(res, { preferences })`; anonymous gets `{ preferences: {} }`.
  - `PUT /api/user/preferences/:key` body `{ value }` (`requireAuth`): `ok(res)`. Errors:
    - 403 `ANONYMOUS_USER`
    - 400 `INVALID_PREFERENCE_KEY`
    - 400 `INVALID_PREFERENCE_VALUE`
    - 413 `PREFERENCE_TOO_LARGE`
  - `DELETE /api/user/preferences/:key` (`requireAuth`): `ok(res)`.
  - `GET /api/admin/layout-usage` (`requireAdmin`): `ok(res, { windowDays: 30, classic: number, workspace: number })`. It counts active users with `lastLoginAt` in the last 30 days, resolved with spec §5.1 rules 2–3 (stored `layout`, else `defaultLayout`, else `classic`).
  - `GET /api/config` adds `workspacePreview: boolean`.

- [ ] **Step 1: Write the failing route tests** on `createRouteTestApp({ mount: app => app.use('/api/user', userPreferencesRoutes) })` and the admin router:
  - anonymous GET → `{success:true,data:{preferences:{}}}`;
  - anonymous PUT → 403 `ANONYMOUS_USER`;
  - limited user PUT `layout`=`'workspace'` then GET → `{layout:'workspace'}`;
  - PUT `layout`=`'grid'` → 400 `INVALID_PREFERENCE_VALUE`;
  - PUT `foo` → 400 `INVALID_PREFERENCE_KEY`;
  - a 70 KB value → 413;
  - a user never sees another user's prefs;
  - `/api/admin/layout-usage` as limited → 403, as admin → counts with `defaultLayout` honoured;
  - POST settings `defaultLayout:'grid'` → 400.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/server/routes/userPreferencesRoutes.preferences.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Keep the existing `/map-preferences` handlers unchanged.
- [ ] **Step 4: Run them until they pass.** Same → PASS. Also run `npx vitest run src/server/routes/settingsRoutes.test.ts src/server/routes/configRoutes*.test.ts` → PASS.
- [ ] **Step 5: TG, then commit** `feat(api): user preferences, layout settings, workspace preview flag (#6365)`.

### Task 1.3: Layout resolution and `LayoutGate`

**Files:**
- Create:
  - `src/workspace/layout/resolveLayout.ts`, `src/workspace/layout/classicFallback.ts`
  - `src/workspace/prefs/useUserPreferences.ts`, `src/workspace/layout/useLayout.ts`, `src/workspace/LayoutGate.tsx`
  - `src/workspace/WorkspaceApp.tsx` (stub rendering `RouteLoading` until 1.5)
  - `src/workspace/layout/__tests__/*.test.ts(x)`
- Modify: `src/main.tsx` (wrap the existing `<Routes>…</Routes>` element as `<LayoutGate classic={<Routes>…</Routes>} />`; the Classic `<Routes>` JSX is otherwise byte-identical)

**Interfaces:**
- Produces:
  - `type Layout = 'classic' | 'workspace'`
  - `resolveLayout(i: { preview: boolean; userLayout?: Layout | null; defaultLayout?: Layout | null }): Layout`
  - `classicFallback(pathname: string): string | null`. It returns the Classic path for a Workspace-only path and null otherwise:
    - `/overview` → `/`
    - `/overview/map` → `/`
    - `/overview/analysis` → `/analysis`
    - `/overview/reports(/x)` → `/reports`
    - `/overview/messages|telemetry|packets` → `/unified/<x>`
    - `/overview/automations` → `/automations`
    - `/overview/users` → `/users`
    - `/overview/audit` → `/`
    - `/overview/dashboard` → `/`
    - `/preferences/*`, `/server/*` → `/settings`
    - `/you(/*)` → `/`
    - `/source/:id/settings/<x>` → `/source/:id/settings`
    - `/source/:id/node/:n(/*)`, `/source/:id/dm/:n` → `/source/:id/messages`
    - `/source/:id/channel/:c` → `/source/:id/channels`
    - `/source/:id/dms|activity|room/*` → `/source/:id/`
    - `/automations/:rule(/*)` → `/automations`
  - `useUserPreferences(): { prefs: Record<string, unknown>; isLoading: boolean; setPref(key: string, value: unknown): Promise<void>; deletePref(key: string): Promise<void> }` uses query key `['user','preferences']`, optimistic set and rollback on error.
  - `useUserPreference<T>(key: string, fallback: T): [T, (v: T) => Promise<void>]`.
  - `useLayout(): { layout: Layout; ready: boolean; preview: boolean; setLayout(l: Layout): Promise<void> }`. It reads `/api/config` `workspacePreview`, the `layout` pref, and settings `defaultLayout`. It mirrors the result to localStorage `mm.layout`, wrapped in try/catch, and uses the mirror before the fetches land.
  - `LayoutGate({ classic }: { classic: ReactNode })`:
    - Classic layout: renders `classic`, plus `<Navigate replace>` when `classicFallback(location.pathname)` is non-null.
    - Workspace layout: renders the lazy `WorkspaceApp`.
    - It needs no `AuthProvider`. Its queries work for anonymous users.

- [ ] **Step 1: Write the failing tests:**
  - **`resolveLayout`, table-driven:**
    - preview false → classic regardless of the other inputs;
    - preview true + userLayout workspace → workspace;
    - preview true + no user layout + default workspace → workspace;
    - default null → classic.
  - **`classicFallback`:** a table over every mapping above, plus `/source/abc/channels` → null and `/` → null.
  - **`LayoutGate` (jsdom, fixtures):**
    - `workspacePreview:false` with `layout:'workspace'` renders the classic child;
    - preview true renders WorkspaceApp;
    - a Classic user at `/overview/reports` is navigated to `/reports`;
    - with `MemoryRouter basename="/meshmonitor"`, `/meshmonitor/preferences/appearance` → `/meshmonitor/settings` (Review Focus 3).
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/workspace/layout` → FAIL.
- [ ] **Step 3: Implement**, then change `main.tsx`.
- [ ] **Step 4: Run them until they pass.** Same → PASS. Then run `npx vitest run src/main*.test.* src/pages` → PASS with no test edits.
- [ ] **Step 5: TG, then commit** `feat(workspace): layout resolution and LayoutGate (#6365)`.

### Task 1.4: `ShellContext` embedding (Classic hook)

**Files:**
- Create: `src/contexts/ShellContext.ts`, `src/contexts/__tests__/classicChrome.snapshot.test.tsx`
- Modify, each wrapping only its own chrome in `{!embedded && …}`:
  - `src/App.tsx`: `AppHeader`, `AppBanners` stays, `Sidebar`
  - `src/pages/{MeshCoreSourcePage,MeshCoreIngestSourcePage,ReticulumSourcePage,DashboardPage,MapAnalysisPage,ReportsPage,UnifiedMessagesPage,UnifiedTelemetryPage,UnifiedPacketMonitorPage,GlobalSettingsPage,UsersPage,PacketMonitorPage}.tsx`: topbars and back buttons
  - `src/components/automations/AutomationsPage.tsx`: header
  - `src/components/MeshCore/MeshCorePage.tsx`, `src/components/Reticulum/ReticulumPage.tsx`: `SourceNavLayout` sub-toolbar; add optional props `view?: MeshCoreView` / `onViewChange?` and `view?: ReticulumView` / `onViewChange?` (controlled when given, local state otherwise)

**Interfaces:**
- Produces:
  - `ShellContext = createContext<{ embedded: boolean }>({ embedded: false })`
  - `useShellEmbedded(): boolean`
  - `MeshCorePage` props `view?`, `onViewChange?(v: MeshCoreView)`
  - `ReticulumPage` props `view?`, `onViewChange?(v: ReticulumView)`

- [ ] **Step 1: Write the snapshot tests.** Render each listed page with fixtures and no provider, and snapshot the `header, nav, [class*=topbar], [class*=sidebar]` outerHTML. Write them first and run them on the unmodified tree to record the snapshots. Then add tests that with `<ShellContext.Provider value={{embedded:true}}>` those selectors are absent and the page body still renders. Add a test that `MeshCorePage` with `view="rooms"` renders the rooms view and calls `onViewChange` on toolbar click.
- [ ] **Step 2: Run them.** `npx vitest run src/contexts/__tests__/classicChrome.snapshot.test.tsx`. Expected: snapshots written, embedded tests FAIL.
- [ ] **Step 3: Implement the conditionals and controlled-view props.**
- [ ] **Step 4: Run them until they pass.** Same → PASS with the snapshots unchanged.
- [ ] **Step 5: TG, then commit** `feat(workspace): ShellContext embedding hook for re-hosting (#6365)`.

### Task 1.5: Workspace routes and re-hosting

**Files:**
- Create:
  - `src/workspace/routes.ts`, `src/workspace/routes.test.ts`
  - `src/workspace/WorkspaceApp.tsx` (replace the stub)
  - `src/workspace/source/WorkspaceSource.tsx`, `src/workspace/rehost/*` (one thin wrapper per re-hosted page)
- Modify: `src/main.tsx` (export the existing `SourceAppDispatch` body as `renderSourceApp(source, splat)` from a new `src/sourceDispatch.tsx` that both layouts import; Rule X)

**Interfaces:**
- Produces:
  - `workspaceRedirect(loc: { pathname: string; hash: string; search: string }): string | null`. Cases:
    - `/source/:id/configuration#config-<x>` → `/source/:id/settings/<x>`
    - `/source/:id/settings#settings-<x>` → `/source/:id/settings/<x>`
    - `/settings#settings-<x>` → `/preferences/<x>` for `PREFERENCE_CATEGORIES`, else `/server/<x>`
    - `/source/:id/admin` → `/source/:id/settings?node=`
    - `/source/:id/notifications` → `/source/:id/settings/notifications`
    - `/source/:id/configuration` → `/source/:id/settings`
    - `/settings` → `/server/general` for admins, `/preferences/appearance` for others
    
    Category ids are the `configSections.ts` ids with the `config-` / `settings-` prefix stripped.
  - `PREFERENCE_CATEGORIES = ['language','units','sorting','appearance','link-previews','map','meshcore-messaging']`.
  - `WorkspaceApp`: `CsrfProvider > AuthProvider > WebSocketProvider > SettingsProvider > ToastProvider > WorkspaceShell > <Routes>`. It imports `src/workspace/styles/fonts.css` and sets `font-family: Inter, <today's stack>` on the shell root only, so Inter never loads in Classic (D16). It mounts every route in spec §5.5. Until each area's phase replaces it, a route renders its re-host wrapper: the existing page inside `<ShellContext.Provider value={{embedded:true}}>`.
  - `/source/:id/<tab>` → `WorkspaceSource`, which calls `renderSourceApp` and passes MeshCore/Reticulum `view` from the URL (`/source/:id/<view>` for MeshCore views and Reticulum views).

- [ ] **Step 1: Write the failing tests:**
  - **`workspaceRedirect`:** a table over every case.
  - **`WorkspaceApp` (jsdom):** each spec §5.5 route renders without throwing. Each re-hosted page renders its body without its Classic chrome (assert one known body string per page).
  - **Unknown sources:** `/source/<unknown>/nodes` shows the Overview fallback with a "device not found" state (Review Focus 4).
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/workspace/routes.test.ts src/workspace/__tests__/WorkspaceApp.test.tsx` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them until they pass.** Same → PASS.
- [ ] **Step 5: TG, then commit** `feat(workspace): routes, redirects, re-host every page (#6365)`.

### Task 1.6: Desktop shell: rail and sidebar frame

Boards: `a-chat-D-desktop` (frame: rail and sidebar only), `c-home-e2-switcher` (desktop parts: device order, states).

**Files:**
- Create:
  - `src/workspace/shell/{WorkspaceShell,DeviceRail,DeviceSidebar,SidebarSection,useIsPhone,useWorkspaceSources}.tsx|ts`
  - matching `.module.css`
  - `src/workspace/shell/__tests__/*`
- Modify: `src/workspace/WorkspaceApp.tsx`

**Interfaces:**
- Produces:
  - `useIsPhone(): boolean`: `matchMedia('(max-width: 767.98px)')`, live.
  - `useWorkspaceSources(): { sources: WorkspaceSource[]; isLoading: boolean }`, where `WorkspaceSource = DashboardSource & { status: 'connected'|'connecting'|'offline'|'disabled'; unread: number; abbrev: string; colorToken: string }`. Enabled sources keep API order. Only sources the user can read, by `hasPermission` on any resource for that `sourceId` (Review Focus 2).
  - `WorkspaceShell({ children })`: rail + sidebar + `<main>` on desktop. At 768–1023 px the sidebar becomes an overlay drawer toggled from a header button.
  - `DeviceRail`: Overview square, device squares with unread badge (DMs from `useUnreadBySource` plus channel unread where available), `+` (admins, links to `/server/devices?add=1`), Server gear (admins), You avatar.
  - `DeviceSidebar({ mode })` with `mode: 'device' | 'overview' | 'settings' | 'server' | 'you'`, derived from the route. In device mode it renders the layout-D header (device name, status line), tool rows, and placeholder Channels / Direct messages sections that link to today's tabs (filled in Phase 2).
  - CSS tokens added to every theme: `--color-device-1…--color-device-8` (device square colours).

- [ ] **BP1–BP7** for the frame. Extra tests:
  - 16 fixture sources → the rail has `overflow-y: auto` and no element wider than the viewport (Review Focus 1);
  - a source removed from the fixture while open → the shell navigates to `/overview` with a toast (Review Focus 4);
  - a limited user with read on source A only → no rail square for B (Review Focus 2).
- [ ] **TG, then commit** `feat(workspace): desktop shell, device rail and sidebar frame (#6365)`.

### Task 1.7: Phone shell: tab bar, switcher, You frame

Boards: `a-chat-D-phone` (frame), `c-home-e2-switcher`, `s1-you` (frame).

**Files:**
- Create: `src/workspace/shell/{PhoneShell,TabBar,DeviceSwitcherSheet}.tsx`, `src/workspace/patterns/{Sheet,TwoLineRow}.tsx` + CSS, `src/workspace/you/YouHome.tsx` + CSS, tests

**Interfaces:**
- Produces:
  - `Sheet({ open, onClose, title, side = 'auto', children, footer }: { open: boolean; onClose(): void; title: ReactNode; side?: 'auto' | 'bottom' | 'right'; children: ReactNode; footer?: ReactNode })`. `auto` is bottom on phone and a right-docked side sheet on desktop. Focus trap, Esc closes, `aria-modal`.
  - `TwoLineRow({ leading?, title, subtitle?, trailing?, to?, onClick? })`: min-height 52 px on phone.
  - `TabBar`: Home (`/source/:current/` or `/overview`), DMs (`/source/:id/dms`), Activity (`/source/:id/activity`), You (`/you`). Badges come from unread counts.
  - `DeviceSwitcherSheet`: Overview row first, then devices with state and unread, then Add device (admins).
  - `YouHome`: account head plus the You list rows of s1 (Profile, Sign-in & security, API token, Layout, Language & units, Appearance, Map, Notifications, Help & about, Server (admins), Sign out). Rows link to re-hosted pages until Phase 6.

- [ ] **BP1–BP7.** Extra tests:
  - at 360 px and in landscape 844×390, no horizontal overflow (Playwright);
  - the tab bar is hidden on desktop.
- [ ] **TG, then commit** `feat(workspace): phone shell, tab bar, switcher and You frame (#6365)`.

### Task 1.8: Layout choice, admin default, banner and menu item (inert)

Boards: `r2-you-layout`, `s3-layout`, `r4-server-general` (Layout and Sources cards; the rest of General stays re-hosted until 6.4), `r3-classic-banner`.

**Files:**
- Create:
  - `src/workspace/you/LayoutPage.tsx`, `src/workspace/server/GeneralLayoutCard.tsx`
  - `src/components/WorkspaceBanner/WorkspaceBanner.tsx` + module CSS (Classic)
  - `src/workspace/layout/workspaceEntry.ts`
  - tests
- Modify:
  - `src/App.tsx`: render `<WorkspaceBanner/>` beside `AppBanners`
  - `src/components/UserMenu.tsx`: add the menu item rendered only when `WORKSPACE_ENTRY_ENABLED`
  - `public/locales/en.json`
  - `CLAUDE.md` ("Where things live" row: Workspace → `src/workspace/`, `LayoutGate`, `ShellContext`, ledger path)

**Interfaces:**
- Produces:
  - `WORKSPACE_ENTRY_ENABLED = false` (exported const in `workspaceEntry.ts`; Task 9.3 flips it).
  - `WorkspaceBanner` renders when all of these hold: `WORKSPACE_ENTRY_ENABLED`, signed in, settings `offerWorkspaceBanner` true, no `layout` pref and no `workspace.bannerDismissed`. Try it → `setPref('layout','workspace')` then reload into Workspace. Not now → `setPref('layout','classic')` and `setPref('workspace.bannerDismissed', true)` (D18).
  - `LayoutPage` (r2/s3): the Classic/Workspace radio cards and the "In Workspace" rows. `workspace.messageStyle`: `'rows' | 'bubbles'`, default `'rows'`. `workspace.signalDetail`: `'hover' | 'always'`, default `'hover'`.
  - `GeneralLayoutCard` (r4): `defaultLayout` select, `offerWorkspaceBanner` toggle (autosave with a Saved tick), "Who uses which" from `/api/admin/layout-usage`, "Default device for guests" (today's default-source setting).

- [ ] **BP1–BP7.** Extra tests:
  - with `WORKSPACE_ENTRY_ENABLED=false` the banner and menu item render nothing, and the Classic chrome snapshot from 1.4 is unchanged;
  - with it mocked true, Not now writes both prefs, and Try it writes `layout=workspace`;
  - a non-admin does not see `GeneralLayoutCard`.
- [ ] **TG, then commit** `feat(workspace): layout choice, admin default, inert Classic entry points (#6365)`.
- [ ] **Open the draft PR.** Use the GitHub MCP `create_pull_request` on giannoug/meshmonitor, head `claude/eager-pascal-svegts`, base `main`, draft. Title: `Workspace layout (#6365)`. The body follows the repo PR template headings and holds the phase table, how to try it (`WORKSPACE_PREVIEW=true`, then `/you/layout`), "CI has not run on this fork (Actions off)", the ledger link and the session footer.
- [ ] **PG for Phase 1.**

---

## Phase 2: Chat and Activity

### Task 2.1: Shared patterns for chat and later phases

**Files:**
- Create: `src/workspace/patterns/{ConfirmSheet,SendsLine,DangerZone,StateView,DeviceTag,OneTimeReveal}.tsx` + CSS + tests

**Interfaces:**
- Produces:
  - `ConfirmSheet({ open, title, body, consequences, confirmLabel, cancelLabel, confirmWord, danger, busy, onConfirm, onCancel })`.
    - Types: `consequences?: string[]`, `confirmWord?: string`, `danger?: boolean`, `busy?: boolean`, `onConfirm(): void | Promise<void>`.
    - Rendered through `Sheet side="auto"`, so it is a right-docked sheet beside the dimmed page on desktop and a bottom sheet on phone.
    - The red confirm stays disabled until `confirmWord` is typed (case-sensitive, as `TypedConfirmDialog`).
    - While `busy`, the field and both buttons are disabled and a spinner shows on the action.
  - `SendsLine({ children }: { children: ReactNode })`: one muted line with the `UiIcon` "antenna" icon.
  - `DangerZone({ title?, children })`: the red card that ends a category.
  - `StateView({ kind, title?, detail?, onRetry? })` with `kind: 'loading' | 'empty' | 'error' | 'noPermission' | 'notFound'`. Today's strings: "Loading…", the `AppErrorScreen` copy, the no-permission copy.
  - `DeviceTag({ sourceId })`: abbreviation in the device colour token.
  - `OneTimeReveal({ secrets, mustAck, onDownload, onDone })` with `secrets: string[]`, `mustAck?: boolean`, `onDownload?(): void`, `onDone(): void`. Copy and "Shown once" are always present. Done stays disabled until "I saved these codes" is ticked when `mustAck` is set.

- [ ] **Step 1: Write the failing tests:**
  - **ConfirmSheet:** typed confirm disabled until `PURGE` is typed; `busy` disables all three controls; Esc calls `onCancel`.
  - **OneTimeReveal:** Done disabled until the ack box is ticked.
  - **StateView:** each kind shows today's string.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/workspace/patterns` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them until they pass.** → PASS.
- [ ] **Step 5: TG, then commit** `feat(workspace): confirm sheet, sends line, states, one-time reveal (#6365)`.

### Task 2.2: Extract chat state and handlers from App (Rule X)

**Files:**
- Create: `src/hooks/useMeshtasticMessageActions.ts`, `src/hooks/useMeshtasticNodeActions.ts`, tests
- Modify: `src/App.tsx` (replace the handler bodies with calls into the hooks; the props passed to tabs stay the same values)

**Interfaces:**
- Produces:
  - `useMeshtasticMessageActions(): { sendChannelMessage(channel: number, text: string, replyId?: number): Promise<void>; sendDirectMessage(nodeId: string, text: string, replyId?: number): Promise<void>; sendTapback(target: MeshMessage, emoji: string): Promise<void>; resend(msg: MeshMessage): Promise<void>; deleteMessage(id: string): Promise<void>; purgeChannelMessages(channel: number): Promise<void>; sendBell(target: {channel?: number; nodeId?: string}): Promise<void>; sendPosition(channel: number): Promise<void> }`. These are the bodies of App's `handleSend*`, `handleResendMessage`, `handleDeleteMessage` and `handlePurgeChannelMessages`, moved unchanged.
  - `useMeshtasticNodeActions(): { traceroute(nodeNum: number, channel?: number): Promise<void>; exchangeNodeInfo(nodeNum: number, channel?: number): Promise<void>; exchangePosition(nodeNum: number, channel?: number): Promise<void>; requestTelemetry(nodeNum: number, type: string, channel?: number): Promise<void>; requestNeighborInfo(nodeNum: number): Promise<void>; scanForAdmin(nodeNum: number): Promise<void>; toggleFavorite(node: DeviceInfo): Promise<void>; toggleFavoriteLock(node: DeviceInfo): Promise<void>; toggleIgnored(node: DeviceInfo): Promise<void>; toggleHideFromMap(node: DeviceInfo): Promise<void>; markAircraft(nodeNum: number, mark: 'aircraft'|'not'|'clear', allSources: boolean): Promise<void>; overridePosition(nodeNum: number, pos: PositionOverride | null): Promise<void>; purgeNodeData(nodeNum: number, opts: PurgeOptions): Promise<void> }`. These are App's handlers and `useSourceView`'s, moved unchanged. The endpoints are those listed in the code map.

- [ ] **Step 1: Write the failing hook tests.** Each method calls the same endpoint with the same body as today's handler. Read the current handler to get the expected body.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/hooks/useMeshtastic*Actions.test.ts` → FAIL.
- [ ] **Step 3: Implement the move.** App keeps passing the same prop names. Nothing else in Classic changes.
- [ ] **Step 4: Run them until they pass.** → PASS. Then run `npx vitest run src/App* src/components/ChannelsTab* src/components/MessagesTab* src/components/NodesTab*` → PASS with no test edits.
- [ ] **Step 5: TG, then commit** `refactor: extract Meshtastic message and node actions into hooks (#6365)`.

### Task 2.3: Channel thread in layout D

Boards: `a-chat-D-desktop` (content), `a-chat-D-phone` (content), `10-06-channel-thread`, `10-03-channel-menu`, `10-12-channel-info`, `10-04-beacons`, `10-13-beacons`, `10-05-read-only`, `10-14-read-only`.

**Files:**
- Create: `src/workspace/chat/{ChannelList,ChannelThread,ChannelHeaderMenu,ChannelInfoSheet,MessageRowD,Composer,ReadOnlyNote,BeaconsPage}.tsx` + CSS + tests
- Modify: `src/workspace/shell/DeviceSidebar.tsx` (Channels and Direct messages sections become live)

**Interfaces:**
- Consumes:
  - from 2.1: `ConfirmSheet`, `SendsLine`, `Sheet`;
  - from 2.2: `useMeshtasticMessageActions`;
  - from today's code: `useChannels`, `useMessagingView`, `useMessaging` (selection, unread, `markMessagesAsRead`), `useNotificationMuteSettings`, `MessageComposeInput`, `messageRowSupport`, `UnreadDivider`, `LinkPreview`, `TranslatedMessage`, `BeaconsPanel`/`BeaconJoinDialog`/`useBeaconOffers`, `computeMessagesReadOnlyState`, `useTxStatus`.
- Produces:
  - `MessageRowD({ message, style, onAction })`, with `style` from the `workspace.messageStyle` pref (`'rows'|'bubbles'`). Signal detail (hops, SNR, route) shows on hover or tap, or always, per `workspace.signalDetail`.
  - `Composer({ target, disabledReason?, onSend })`: wraps `MessageComposeInput`, the bell, translate and reply preview; shows `SendsLine` "Sends 1 message" (DM: "…, asks for an ACK").
  - Route `/source/:id/channel/:channel`.

- [ ] **BP1–BP7.** Extra tests:
  - the channel menu holds today's items: channel info (encryption, PSK show, up/downlink, AEAD, location, Purge all), mute options 1 hour / 1 week / Indefinitely, mark all read, Show MQTT messages, Beacons (count);
  - Purge all messages opens a plain `ConfirmSheet`;
  - Join into an occupied slot shows "Replace and join" in red with today's warning;
  - an MQTT mirror shows no composer and today's reason;
  - with TX disabled the controls are visible but disabled, with today's tooltip;
  - a guest sees channels and Sign in.
- [ ] **TG, then commit** `feat(workspace): channel thread in layout D (#6365)`.

### Task 2.4: DM conversation and node menus

Boards: `10-01-dm-conversation`, `10-07-dm-conversation`.

**Files:**
- Create: `src/workspace/chat/{DmConversation,DmHeader,DmBanners,TracerouteStripD}.tsx`, `src/workspace/patterns/NodeActionMenus.tsx` + CSS + tests

**Interfaces:**
- Consumes: from 2.2, `useMeshtasticNodeActions`; from today's code, `KeyMismatchWarning`, `TracerouteStrip` / `TracerouteParticipationPicker` / `TracerouteCopyLinks`, `useNodeTraceroutes`, `useTraceroutePairHistory`, `MuteMenu`, `PurgeDataModal` logic (its options are rendered in `ConfirmSheet`), `TelemetryRequestModal` fields.
- Produces:
  - `NodeActionMenus({ protocol, sourceId, node, variant, onOpenNodePage? })` with `protocol: 'meshtastic' | 'meshcore' | 'reticulum' | 'mqtt'` and `variant: 'menus' | 'tiles' | 'sheet'`.
    - **Ask the node:**
      - Meshtastic: Traceroute, Exchange NodeInfo, Exchange position, Request telemetry, Request neighbour info, Scan for admin. Each has a channel picker where today has one, and a `SendsLine`. Exchange NodeInfo and Exchange position go on the node's channel, never as a PKI DM.
      - MeshCore: Ping, Trace path, Discover path.
      - Reticulum and MQTT mirror: none.
    - **Organise:** Favourite, Favourite lock, Ignore, Hide from map, Aircraft (Mark / Not aircraft / Clear override, Apply to all sources; Meshtastic only).
    - **Data:** Override position, Copy NodeInfo, Merge identity, Purge data.
    - **Gates** (spec s10n0): `traceroute:write` for the asks, `settings:write` for Scan for admin, `nodes:write` for Organise and Override position, `nodes:write` plus `nodes:read` on the source for Copy NodeInfo, admin plus `nodes:write` for Merge identity, `messages:write` for Purge data. A gated item stays listed, disabled, with its reason.

- [ ] **BP1–BP7.** Extra tests:
  - each gate: an item without permission is disabled and shows its reason;
  - Exchange NodeInfo posts to `/api/nodeinfo/request` with the node's channel, not a DM;
  - Purge data offers today's four data types and the two delete choices with the tracked-asset warning, and asks plainly (no typed word);
  - banners: key mismatch, "Not in the device database", and unmessageable with "Message anyway";
  - ack states Pending / Delivered / Confirmed / Failed / Timed out.
- [ ] **TG, then commit** `feat(workspace): DM conversation and node action menus (#6365)`.

### Task 2.5: Message actions, details, translate, emoji

Boards: `10-02-message-details`, `10-08-message-actions`, `10-09-translate`, `10-10-message-details`, `18-05-emoji-picker`, `18-06-emoji-picker`.

**Files:**
- Create: `src/workspace/chat/{MessageHoverBar,MessageActionsSheet,MessageDetailsPanel,TranslateComposerSheet,EmojiPickerSheet}.tsx` + CSS + tests

**Interfaces:**
- Consumes:
  - from today's code: `MessageDetailsModal` internals (`useMessageEvents`, `useMeshtasticHeardBy`), `TranslateModal` / `useMessageTranslation`, `EmojiPickerModal` content (defaults, or the saved custom set replacing them, custom emoji up to 10 characters);
  - from 2.2: `useMeshtasticMessageActions`.
- Produces: `onAction(kind: 'reply'|'react'|'translate'|'resend'|'details'|'copy'|'delete', message)` handled in `ChannelThread` / `DmConversation`.
  - Desktop: a hover bar with ⋯; details as a side panel.
  - Phone: a long-press sheet; details as a sheet.
  - Delete opens a plain `ConfirmSheet` with today's text.

- [ ] **BP1–BP7.** Extra tests:
  - Resend shows "Sends 1 new copy";
  - React shows "Sends 1 tapback";
  - the translate composer shows the LoRa payload warning and "Replace in draft".
- [ ] **TG, then commit** `feat(workspace): message actions, details, translate, emoji (#6365)`.

### Task 2.6: Home, DM inbox, message search

Boards: `c-home-e1-home`, `c-home-e3-dms`, `10-11-dm-inbox`, `10-15-search-messages`, `10-16-search-messages`.

**Files:**
- Create: `src/workspace/chat/{PhoneHome,DmInbox,SearchMessages}.tsx` + CSS + tests
- Modify: `src/workspace/shell/DeviceSidebar.tsx` (Search messages field with the ⌘K hint), `WorkspaceShell` (⌘K / Ctrl+K opens search when `canSearch`, as `App.tsx:3393`)

**Interfaces:**
- Consumes: `SearchModal` internals, with today's filters (text ≥2 characters, Case sensitive, Scope, Channel, Sender, From/To, 25 per page with Load more), `DmFilterSelect` filters, `useUnreadCounts`.
- Produces: routes `/source/:id/dms` and `/source/:id` (phone Home). Desktop search is a dialog over the conversation; phone search is a full-screen page with Back.

- [ ] **BP1–BP7.** Extra tests:
  - ⌘K opens search and ⌘, does not;
  - the "Direct messages only" scope needs `messages:read`;
  - picking a result navigates to its conversation and closes search;
  - the phone page shows no shortcut hint.
- [ ] **TG, then commit** `feat(workspace): home, DM inbox, message search (#6365)`.

### Task 2.7: Activity endpoint

**Files:**
- Create: `src/db/repositories/activity.ts`, `src/server/services/activityService.ts`, `src/server/routes/activityRoutes.ts`, tests (`activity.perSource.test.ts`, `activityRoutes.test.ts`)
- Modify: `src/services/database.ts` (facade `getActivityAsync`), `src/server/server.ts` (mount under `/api/sources`)

**Interfaces:**
- Produces:
  - `GET /api/sources/:id/activity?before=<ms>&limit=<1..100, default 50>` → `ok(res, { items: ActivityItem[]; nextBefore: number | null })`.
    - Access: `optionalAuth()` plus the same read resolution as `GET /api/messages` (`resolveMessageReadAccess`, `resolveReadableMeshtasticChannels`, `resolveReadableMeshcoreScope`).
    - Errors: 404 `SOURCE_NOT_FOUND`; 403 `FORBIDDEN` when nothing is readable.
  - `type ActivityItem = { kind: 'reply' | 'reaction' | 'mention'; id: string; targetMessageId: string | null; conversation: { type: 'channel'; channel: number } | { type: 'dm'; peerId: string }; fromId: string; fromName: string; text: string; reactions?: Array<{ emoji: string; count: number; fromNames: string[] }>; timestamp: number }`.
  - The own node is the source's local node: Meshtastic `localNodeNum` (`isOwnNodeNum`); MeshCore own public key.
    - **reply:** Meshtastic messages whose `replyId` points to a message from the own node and that are not tapbacks. MeshCore has no reply ids, so MeshCore yields no replies.
    - **reaction:** Meshtastic `emoji = 1` rows whose `replyId` targets an own message. MeshCore rows with `reactionEmoji` whose target is an own message. Collapsed per target message.
    - **mention:** `textMentionsNode(text, ownNodeId)` on Meshtastic; `textMentionsMeshCoreName(text, ownName)` on MeshCore.
    - Our own messages are never items.
  - `ActivityRepository.listMeshtastic({ sourceId, ownNodeNum, ownNodeId, scopes, before, limit })` and `ActivityRepository.listMeshcore({ sourceId, ownPublicKey, ownName, scopes, before, limit })`. Both use Drizzle with `withSourceScope`, and both scan at most 2,000 candidate rows per call (`shortcut: bounded scan; index if slow`).

- [ ] **Step 1: Write the failing tests:**
  - **Repository (SQLite + PG + MySQL, isolated databases):** each kind is found; rows from source B never appear for source A; tapbacks to others are excluded; reactions are collapsed.
  - **Route (harness):** a limited user with `channel_0:read` only gets no DM items and no channel-1 items (Review Focus 2); anonymous with no read access → 403; pagination via `nextBefore`.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/db/repositories/activity src/server/routes/activityRoutes.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them with containers up until they pass.** → PASS.
- [ ] **Step 5: TG (PG/MySQL), then commit** `feat(api): per-source Activity feed (#6365)`.

### Task 2.8: Activity UI

Boards: `c-home-e4-activity`, `c-home-e5-activity-empty`, `c-home-e6-desktop-activity`.

**Files:**
- Create: `src/workspace/activity/{ActivityFeed,ActivityPanel,useActivity}.ts(x)` + CSS + tests

**Interfaces:**
- Consumes: Task 2.7's route.
- Produces:
  - `useActivity(sourceId): { items, fetchMore, hasMore, isLoading, unseenCount, markSeen() }`. The last-seen timestamp is in pref `workspace.activity.<sourceId>`. The query refetches on the WebSocket `message:new` event for that source; no new polling interval.
  - Desktop: the bell in the sidebar header opens `ActivityPanel`. Phone: the Activity tab (`/source/:id/activity`). Tapping a row opens the conversation at that message.

- [ ] **BP1–BP7.** Extra tests: an empty feed shows the e5 copy; `markSeen` writes the pref; unseen count badges the tab and the bell.
- [ ] **TG, then commit** `feat(workspace): Activity feed (#6365)`.

### Task 2.9: Replies and Meshtastic mentions push (backend, off by default)

**Files:**
- Create: `src/server/migrations/234_add_notify_on_reply.ts`, `src/server/services/meshtasticActivityNotifier.ts`, tests
- Modify:
  - `src/db/schema/notifications.ts` (`notifyOnReply` boolean default false, in all three dialects)
  - `src/db/migrations.ts`
  - `src/db/repositories/notifications.ts` (read and write the field)
  - `src/server/utils/notificationFiltering.ts` (`NotificationPreferences.notifyOnReply`)
  - `src/server/routes/notificationRoutes.ts` (accept and return `notifyOnReply`)
  - `src/server/services/notificationService.ts` (`broadcastToPreferenceUsers` accepts `'notifyOnReply'`)
  - `src/server/services/messagePushNotifier.ts` (call the notifier after the self-origin guard)

**Interfaces:**
- Produces: `notifyMeshtasticActivity(input: { sourceId: string; message: { id: string; fromNodeNum: number; replyId?: number | null; emoji?: number | null; text: string; channel: number; toNodeNum: number } }): Promise<void>`.
  - When `replyId` targets a message from the own node and it is not a tapback, it sends one push to users with `notifyOnReply` true for that `sourceId`.
  - When `textMentionsNode(text, ownNodeId)` is true, it sends one push to users with `notifyOnMention` true for that `sourceId`.
  - Both respect `shouldFilterNotificationAsync` (readability, mutes). A message that is both a reply and a mention sends one push, the reply. There is no cooldown: at most one push per message (Ruling: D13). Our own messages never trigger it.
  - Classic's NotificationsTab is untouched. The UI toggles come in Task 5.8.

- [ ] **Step 1: Write the failing tests:**
  - a reply to an own message → one `broadcast` call to a user with `notifyOnReply` on, none to a user with it off;
  - a user without read on that channel gets nothing;
  - an own message → none;
  - reply plus mention → exactly one;
  - migration on all three backends defaults the field to false;
  - the `/api/push/preferences` round-trip carries `notifyOnReply`.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/server/services/meshtasticActivityNotifier.test.ts src/server/routes/notificationRoutes*.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them with containers up until they pass.** → PASS.
- [ ] **Step 5: TG (PG/MySQL), then commit** `feat(notifications): replies and Meshtastic mentions push, default off (#6365)`.
- [ ] **PG for Phase 2.**

---

## Phase 3: Map, Nodes, node page

### Task 3.1: Device map and Layers drawer (desktop)

Boards: `Main`, `f2-layers`, `15-09-neighbour-peek`.

**Files:**
- Create: `src/workspace/map/{DeviceMap,LayersDrawer,LayerGroup,NodePeek,NeighbourPeek,MapToolbar}.tsx` + CSS + tests

**Interfaces:**
- Consumes:
  - `BaseMap`; NodesTab's layers (move each `<…Layer>` JSX block NodesTab renders into `src/components/map/DeviceMapLayers.tsx`, a Rule X extraction NodesTab then renders, with props `{ mapState, nodes, … }` taken from the existing JSX);
  - `MapContext` `show*`/`setShow*` (the toggles themselves are unchanged);
  - `NodeCard` sections; `DashboardNeighborPopup` data; `NodeActionMenus`.
- Produces:
  - `LayersDrawer({ groups })`: Base map / Nodes / Links / Overlays, with "N more" for the less-used toggles (ds2). Every toggle that NodesTab's `MapSidebar` has today appears in exactly one group.
  - `NodePeek({ node, sourceId })`: a side panel on desktop and a sheet on phone, with Message, the three menus and Open node page.

- [ ] **BP1–BP7.** Extra test: a table lists every `setShow*` in MapContext and asserts that each one has exactly one control in `LayersDrawer` (no control lost).
- [ ] **TG, then commit** `feat(workspace): device map, layers drawer, peeks (#6365)`.

### Task 3.2: Phone map

Boards: `g1-map`, `g2-layers`, `15-21-neighbour-peek`.

**Files:**
- Create: `src/workspace/map/PhoneMap.tsx` + CSS + tests

**Interfaces:**
- Consumes: 3.1's components.
- Produces: a full-bleed map with a search pill and a Layers sheet. The peek is a bottom sheet; swiping it up goes to the node page.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): phone map (#6365)`.

### Task 3.3: Nodes table and list, filters, add from URL

Boards: `f3-nodes`, `g3-nodes`, `15-10-more-filters`, `15-14-filters`, `15-15-add-from-url`.

**Files:**
- Create: `src/workspace/nodes/{NodesTable,NodesList,ColumnPicker,NodeFiltersSheet}.tsx` + CSS + tests

**Interfaces:**
- Consumes: `useSourceView` (processed nodes, sort, filter), `usePersistedNodeFilters('nodeFilters')`, `AdvancedNodeFilterPopup` fields (all of them), `ExportMenuButton`, `NodeQuickAgeFilter`, `ImportContactUrlModal` (sends nothing, needs `nodes:write`, the new row shows Imported).
- Produces: the desktop table, with columns persisted in pref `workspace.nodes.columns`, and the phone list. The filters are shared with the map through `usePersistedNodeFilters`.

- [ ] **BP1–BP7.** Extra test: every `AdvancedNodeFilterPopup` field appears in `NodeFiltersSheet`, including the 13 device roles.
- [ ] **TG, then commit** `feat(workspace): nodes table, list and filters (#6365)`.

### Task 3.4: Node page

Boards: `f4-node`, `f5-telemetry`, `g4-node`, `g5-links`, `15-02-position`, `15-03-admin`, `15-04-traceroute-history`, `15-12-position`, `15-16-admin`, `15-17-traceroute-history`.

**Files:**
- Create: `src/workspace/node-page/{NodePage,NodeHeader,OverviewTab,TelemetryTab,LinksTab,PositionTab,AdminTab}.tsx` + CSS + tests

**Interfaces:**
- Consumes:
  - `NodeDetailsBlock` parts (notes, asset tracking, `RemoteAdminLink`, `PkiExchangeStatusCard`, `MeshtasticContactShare`, `NodeNameHistory`);
  - `TelemetryGraphs` (chart ⋯: split/merge, Y range, CSV, unstar, Clean outliers…);
  - `TracerouteHistoryModal` content (show failed, forward/return SNR, distance, copy);
  - the position history fetch (`/api/nodes/:id/position-history`), `AssetPlaybackBar`;
  - the neighbour list and its Purge, drawn as today with no new gate (spec non-goal);
  - `NodeActionMenus`.
- Produces:
  - Route `/source/:id/node/:nodeId[/<tab>]` with tabs `overview|telemetry|links|position|admin`. Admin is shown only to viewers allowed today.
  - The phone header collapses to one bar with ⋯ when scrolled.

- [ ] **BP1–BP7.** Extra test: the list row, DM header and message sender all open the node page directly; a map pin opens the peek (ds1).
- [ ] **TG, then commit** `feat(workspace): node page (#6365)`.

### Task 3.5: Node menus on the page, and the node dialogs

Boards: `15-01-node-menus`, `15-05-node-dialogs`, `15-06-identity-merge`, `15-11-node-menus`, `15-18-node-dialogs`, `15-19-identity-merge`, `15-22-data-menu`, `15-25-request-telemetry`.

**Files:**
- Create: `src/workspace/node-page/dialogs/{RequestTelemetrySheet,CopyNodeInfoSheet,OverridePositionSheet,PurgeDataSheet,MergeIdentitySheet}.tsx` + tests

**Interfaces:**
- Consumes: `NodeActionMenus` (2.4), `useMeshtasticNodeActions`, `CopyNodeInfoModal` logic (Push to NodeDB shows "Sends 1 NodeInfo request on the node's channel"), `NodeIdentityMergeDialog` logic (dry-run table, the unverified-pairing warning, today's "I understand this merge is permanent and cannot be reversed." check), `PositionOverrideModal` logic.
- Produces: one sheet per dialog, opened one at a time (D9c).

- [ ] **BP1–BP7.** Extra test: Merge history stays disabled until the check box is ticked; Merge identity is offered only to admins.
- [ ] **TG, then commit** `feat(workspace): node dialogs as sheets (#6365)`.

### Task 3.6: Map editing

Boards: `15-07-waypoint-editor`, `15-08-map-menu`, `15-13-waypoint-editor`, `15-20-long-press-menu`, `15-23-delete-waypoint`, `15-24-geofence`, `15-26-local-marker`.

**Files:**
- Create: `src/workspace/map/{MapContextMenu,WaypointSheet,LocalMarkerSheet,GeofencePage}.tsx` + tests

**Interfaces:**
- Consumes:
  - `useWaypoints(sourceId)` (create, update, delete), `WaypointEditorModal` fields;
  - rebroadcast every N minutes (≥10) with today's Android warning and Sends line;
  - Virtual (sends nothing), the geofence fields, the locked-waypoint message;
  - `LocalMarkerEditorModal` fields ("never sent to the mesh"); `MeasureDistanceController`.
- Produces: `MapContextMenu` (right-click on desktop, long-press on phone) with Add waypoint here, Add local marker here, Measure from here, and a hint chip. Delete waypoint is a plain confirm that says the delete is broadcast and names the sending source, with a Sends line.

- [ ] **BP1–BP7.** Extra test: Save waypoint shows "Sends 1 waypoint on <channel>"; a waypoint locked to another node has Edit and Delete disabled with today's text.
- [ ] **TG, then commit** `feat(workspace): map context menu, waypoints, markers (#6365)`.
- [ ] **PG for Phase 3.**

---

## Phase 4: Overview

### Task 4.1: Overview nav, phone home, all-devices map

Boards: `f6-overview`, `5-07-overview-home`, `5-08-overview-map`.

**Files:**
- Create: `src/workspace/overview/{OverviewSidebar,OverviewHome,OverviewMap}.tsx` + CSS + tests

**Interfaces:**
- Consumes: `DashboardMap` (its props come from `useDashboardSourceData` / `useDashboardUnifiedData`), `useSourceStatuses`, the default-landing-page logic (`utils/defaultLandingPage.ts`).
- Produces:
  - `/` and `/overview/map` render `OverviewMap`.
  - `OverviewSidebar` items: Map, Dashboard, Messages, Telemetry, Packets, Analysis, Reports, Automations, Users (admins), Audit log (`audit:read`), plus the device list "N of M connected".
  - The phone Overview home shows the tiles of s5n0.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): Overview nav, home and map (#6365)`.

### Task 4.2: Analysis on the Overview map (desktop)

Boards: `5-01-overview-analysis`, `5-02-layers-analysis`, `5-03-time-trails`, `5-04-link-profile`, `5-05-site-planner`, `5-06-route-segment`.

**Files:**
- Create: `src/workspace/overview/analysis/{AnalysisLayersGroup,MapToolsMenu,TimeControl,InspectorPanelD}.tsx` + tests
- Modify: `src/workspace/overview/OverviewMap.tsx`

**Interfaces:**
- Consumes: `MapAnalysisProvider` / `useMapAnalysisCtx` (layers, lookbacks, filters, time slider, selection, link profile, site planner, GNSS DOP, measure, pin placement), `MapAnalysisCanvas` layers, `AnalysisInspectorPanel` branches, `LinkProfileDrawer`, `SitePlannerPanel`, `GnssDopPanel`, `TimeSliderControl`, `TracerouteControls`.
- Produces:
  - `OverviewMap` wraps `MapAnalysisProvider`.
  - The Layers drawer gains an Analysis group: Traceroutes and Neighbours move there from Links; Heatmap, Trails and SNR overlay join them, each with a lookback.
  - A Tools menu: Measure, Link profile, Site planner, Add waypoint, Add local marker.
  - A Time control and an Inspector.
  - `/analysis` and `/overview/analysis` open with the Analysis group expanded (s5n1).

- [ ] **BP1–BP7.** Extra test: every `LayerKey` and every MapAnalysis toolbar control is reachable from the drawer or the Tools menu.
- [ ] **TG, then commit** `feat(workspace): analysis merged into the Overview map (#6365)`.

### Task 4.3: Analysis on phone

Boards: `5-09-tools-time`, `5-10-inspector-sheet`, `5-11-link-profile-sheet`, `5-12-layers-sheet`, `5-13-planner-dop-sheet`.

**Files:**
- Create: `src/workspace/overview/analysis/Phone*.tsx` + tests

**Interfaces:**
- Consumes: 4.2.
- Produces: one tool at a time; inspector, link profile and planner as bottom sheets.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): analysis on phone (#6365)`.

### Task 4.4: Reports list, Mesh issues, Coverage

Boards: `6-01-reports-list`, `6-02-mesh-issues`, `6-03-coverage`, `6-08-reports-list`, `6-09-mesh-issues`, `6-10-coverage`, `6-15-mesh-issues-filters`.

**Files:**
- Create: `src/workspace/reports/{ReportsList,ReportFrame,MeshIssuesPage,CoveragePage}.tsx` + CSS + tests

**Interfaces:**
- Consumes:
  - `AnalysisTab` report registry; `MeshIssuesReport` parts (FilterBar, SummaryTiles, ByIssueView/ByNodeView, IssueTable, MuteRuleDialog, BulkActionMenu, `meshIssuesApi`); `CoverageReport` parts;
  - `parseCoverageDeepLink`.
- Produces:
  - `/reports[/<report>]` and `/overview/reports[/<report>]` with report ids `mesh-issues|coverage|traceroute-explorer|solar|mqtt-violations|nodeinfo-enrichment`. `?report=coverage&…` keeps working.
  - `ReportsList` rows show last run and status from data the reports already load: Mesh issues `/status`; the others show "Opens stored data" or their Run state. No new endpoint (Ruling: only Mesh issues has a last-run API today).

- [ ] **BP1–BP7.** Extra test: Mesh issues keeps Run now and "last run … · from storage".
- [ ] **TG, then commit** `feat(workspace): reports list, mesh issues, coverage (#6365)`.

### Task 4.5: Remaining reports

Boards: `6-04-traceroute-explorer`, `6-05-solar`, `6-06-mqtt-violations`, `6-07-nodeinfo-enrichment`, `6-11-traceroute-explorer`, `6-12-solar`, `6-13-mqtt-violations`, `6-14-nodeinfo-enrichment`.

**Files:**
- Create: `src/workspace/reports/{TracerouteExplorerPage,SolarPage,MqttViolationsPage,EnrichmentPage}.tsx` + tests

**Interfaces:**
- Consumes: `TracerouteExplorerReport` parts (ExplorerMap, ExplorerTable, ExplorerDetail, `explorerApi`), `SolarMonitoringReport` + `SolarOverridesPanel`, `MqttViolationsReport`, `NodeInfoEnrichmentReport`.
- Produces: Enrichment's Fix / Fix all with "Also push to device NodeDB" shows "Sends 1 NodeInfo request per row … on that node's channel".

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): traceroute explorer, solar, violations, enrichment (#6365)`.

### Task 4.6: Overview › Messages and export

Boards: `7-01-messages`, `7-02-export-messages`, `7-06-messages`, `7-09-export-messages`.

**Files:**
- Create: `src/workspace/overview/{OverviewMessages,ReceptionsPanel,ExportMessagesPage}.tsx` + tests

**Interfaces:**
- Consumes: `UnifiedMessagesPage` queries (`/api/unified/messages`, `/api/unified/channels`, collisions), `HopBadge`, `MessageExportDialog` fields, `MessageRowD`, `DeviceTag`.
- Produces: `ReceptionsPanel({ message })` with Source, Hops, SNR, RSSI, Heard and signed (desktop side panel, phone sheet). The feed has no composer and read-only reactions.

- [ ] **BP1–BP7.** Extra test: a user without read on source B sees no B rows or tags (Review Focus 2).
- [ ] **TG, then commit** `feat(workspace): Overview messages and export (#6365)`.

### Task 4.7: Overview › Telemetry and Packets, pop-out, MQTT receptions

Boards: `7-03-telemetry-graphs`, `7-04-telemetry-latest`, `7-05-packets`, `7-07-telemetry`, `7-08-packets`, `18-01-packets-popout`, `18-02-packets-popout`, `18-03-mqtt-receptions`, `18-04-mqtt-receptions`.

**Files:**
- Create: `src/workspace/overview/{OverviewTelemetry,OverviewPackets,PacketDetailPanel}.tsx`, `src/workspace/tools/{PacketsPopout,MqttReceptions}.tsx` + tests

**Interfaces:**
- Consumes: `UnifiedTelemetryGraphs` + Latest; `useUnifiedPackets`, filters (`unifiedPacketMonitor.filters`); Capture (`packet_log_enabled`, `settings:write`, "sends nothing on the mesh"); `PacketMonitorPanel standalone`; `openPacketMonitorPopout`; `MqttPacketMonitorView` + `MqttPacketDetailModal` columns (Gateway, Rx time, Hops, SNR, RSSI, Outcome, ok_to_mqtt).
- Produces: `/packet-monitor` in Workspace is the 18-01/18-02 window with Close window (`window.close()`) and no Pop out.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): Overview telemetry, packets, pop-out, MQTT receptions (#6365)`.

### Task 4.8: Users, permissions, audit

Boards: `o4-users`, `q4-permissions`, `13-13-manage-user`, `13-18-users`, `o5-audit`, `16-03-audit-log`, `16-08-audit-entry`.

**Files:**
- Create: `src/workspace/overview/users/{UsersPage,PermissionMatrix,PhonePermissions,ManageUser}.tsx`, `src/workspace/overview/audit/{AuditPage,AuditEntrySheet}.tsx` + tests

**Interfaces:**
- Consumes:
  - `UsersTab` calls: list, create, `/permissions[?sourceId]`, admin toggle, set password, deactivate, permanent delete, channel-database permissions; `AdminPasskeysDialog`;
  - `AuditLogTab` calls: `/api/audit`, `/api/audit/stats/summary`, `/api/users`.
- Produces:
  - `PermissionMatrix`: resources down the side, devices across, None/Read/Write cells, plus the install-wide card. It writes through today's per-source permission endpoint, with the same model (ds13).
  - The phone version is device chips plus segmented rows.
  - Users is admins only. Audit needs `audit:read` and is install-wide, reusing today's endpoint.

- [ ] **BP1–BP7.** Extra test: changing one cell sends exactly today's request for that `(user, source, resource)`.
- [ ] **TG, then commit** `feat(workspace): users, permission matrix, audit log (#6365)`.
- [ ] **PG for Phase 4.**

---

## Phase 5: Device settings frame

### Task 5.1: Extract device-config state and saves (Rule X)

**Files:**
- Create: `src/hooks/deviceConfig/{useDeviceConfigState,useDeviceConfigSaves}.ts`, tests
- Modify: `src/components/ConfigurationTab.tsx` (consume the hooks; same JSX)

**Interfaces:**
- Produces:
  - `useDeviceConfigState(sourceId: string, refreshTrigger: number): DeviceConfigState`: every value/setter pair ConfigurationTab owns today, plus `loading`, `configVersion` and `securityKeys`.
  - `useDeviceConfigSaves(state: DeviceConfigState, opts: { onRebootExpected(e: 'always' | 'possible'): void }): Record<ConfigSaveSection, () => Promise<boolean>>`. These are today's `handleSave*Config` bodies, moved unchanged, plus `reboot()`, `purgeNodeDb()` and `reload(): Promise<ConfigChange[]>`.

- [ ] **Step 1: Write the failing hook tests.** Each save posts today's endpoint and body (read each handler to get them), and returns `true` on 200 and `false` on error.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/hooks/deviceConfig` → FAIL.
- [ ] **Step 3: Implement the move.**
- [ ] **Step 4: Run them until they pass.** → PASS. Then run `npx vitest run src/components/ConfigurationTab* src/components/configuration` → PASS with no test edits.
- [ ] **Step 5: TG, then commit** `refactor: extract device configuration state and saves (#6365)`.

### Task 5.2: Settings frame, row kit, list, routes

Boards: `b-set-p1-list`, `12-06-device-index`, `12-22-device-index` (index pattern), `b-set-d2-modules`, `b-set-p4-modules`, `12-07-modules-index`.

**Files:**
- Create: `src/workspace/settings/{SettingsFrame,SettingsList,CategoryPage,categories}.tsx|ts`, `src/workspace/settings/kit/{SettingGroup,SettingRow,SettingToggle,SettingSelect,SettingNumber,SettingText,AdvancedCard,useFieldRegistry}.tsx|ts` + CSS + tests

**Interfaces:**
- Produces:
  - `type CategoryDef = { id: string; scope: 'radio' | 'meshmonitor'; group?: 'device' | 'modules' | 'maintenance'; labelKey: string; sourceTypes: SourceType[]; gate?: (ctx: GateCtx) => boolean; saveSection?: ConfigSaveSection; component: LazyExoticComponent<ComponentType<CategoryProps>> }`.
  - `CATEGORIES: CategoryDef[]`.
    - Ids come from `configSections.ts`: `identity` (`config-node-identity`), `lora`, `channels`, `security`, `device/<device|position|power|display|network|bluetooth>`, `modules/<module>`, `maintenance/<backup|firmware|danger>`.
    - In MeshMonitor: `node-display`, `telemetry`, `notifications`, `packet-monitor`, `pki-dm`, `reliable-pki`, `data`, `mqtt-bridge`, `coverage-recording`.
  - `type CategoryProps = { sourceId: string; target: { kind: 'local' } | { kind: 'remote'; nodeNum: number }; readOnly: boolean }`.
  - Row kit: `SettingRow({ id, label, help?, children, keywords? })` registers `{ id, label, keywords, categoryId }` with `useFieldRegistry` for ⌘, search. Then `SettingToggle`, `SettingSelect` (a bottom sheet on phone), `SettingNumber` (a stepper on phone; validates through `NumberInputScope`), `SettingText`, and `AdvancedCard` (open state in pref `workspace.settings.advanced.<categoryId>`).
  - The frame: on desktop the sidebar swaps to `SettingsList` with "← <Device>". On phone the list is a page and each category pushes a page.
    - List groups: PINNED, ON THE RADIO (Identity, LoRa, Channels, Security, Device ›, Modules ›, Maintenance ›) and IN MESHMONITOR.
    - Modules › lists only supported modules A–Z with On/Off tags, plus a collapsed "N not on this firmware" row (`ModuleAvailabilityGate`).
    - Read-only viewers see "View only".
    - Switching devices keeps the category if the new device has it, else opens its first category.
  - Routes: `/source/:id/settings[/<category>[/<sub>]]`.

- [ ] **BP1–BP7.** Extra test: every `configurationNavItems` and `settingsNavItems(mode:'source')` id maps to exactly one `CategoryDef`. Nothing is lost.
- [ ] **TG, then commit** `feat(workspace): settings frame, row kit, category routes (#6365)`.

### Task 5.3: Radio save bar, Review, leave guard

Boards: `b-set-d1-lora`, `b-set-d3-review`, `b-set-p2-lora`, `b-set-p3-sheet`, `17-02-confirm-sheets` (the discard part).

**Files:**
- Create: `src/workspace/settings/{RadioSaveBar,ReviewSheet,useRadioSaveQueue,LoraCategory}.tsx|ts` + tests

**Interfaces:**
- Consumes: `useDeviceConfigSaves`, `rebootExpectation(section, firmware)`, `useSectionBaseline`, `RebootModal`.
- Produces:
  - `useRadioSaveQueue(sourceId)`: `{ queue: Array<{ section: ConfigSaveSection; categoryId: string; changes: Array<{ field: string; label: string; from: unknown; to: unknown }> }>; enqueue(entry): void; discard(section?): void; label: 'save' | 'saveMayRestart' | 'saveAndRestart'; saveAll(): Promise<{ ok: ConfigSaveSection[]; failed: ConfigSaveSection[] }> }`.
    - The label is the worst `rebootExpectation` across the queue.
    - `saveAll` writes sequentially through the existing handlers, then shows `RebootModal` once with the strongest expectation.
  - `RadioSaveBar`: "N categories changed · Node restarts" with Review, Discard and the labelled Save. On phone it docks above the tab bar with "Sends nothing on the mesh".
  - Leaving the settings frame, or switching device, with a non-empty queue opens a `ConfirmSheet` with Keep editing / Discard.

- [ ] **BP1–BP7.** Extra tests:
  - LoRa on firmware 2.7.15 → "Save & restart"; Channels → "Save"; Identity → "Save (may restart)";
  - two queued categories → one `RebootModal`;
  - a failed section stays queued and is reported;
  - **mesh checklist 3:** a Workspace save of the auto-announce settings does not change the persisted `lastAnnouncementTime`, and does not re-fire on restart (assert the settings row is unchanged after save).
- [ ] **TG, then commit** `feat(workspace): radio save bar, review, discard guard (#6365)`.

### Task 5.4: Settings search (⌘,) and pins

Boards: `b-set-d4-search`.

**Files:**
- Create: `src/workspace/settings/{SettingsSearch,usePins}.tsx|ts` + tests

**Interfaces:**
- Consumes: `buildConfigSurfaces` (section-level results), `useFieldRegistry` (field-level results), `useUserPreference('settings.pins', [])`.
- Produces:
  - ⌘, / Ctrl+, opens settings search anywhere in Workspace. The list's search field is scoped to the list and offers "Search everywhere".
  - Choosing a field result routes to its category, scrolls to the row and pulses it.
  - The ☆ on a category header pins it. Pins are category ids and follow the user.

- [ ] **BP1–BP7.** Extra test: ⌘K does not open settings search.
- [ ] **TG, then commit** `feat(workspace): settings search and pins (#6365)`.

### Task 5.5: Identity, Channels, Security

Boards: `12-01-channels`, `12-02-channel-edit`, `12-03-share-import`, `12-04-security`, `12-05-identity`, `12-14-channels`, `12-15-channel-edit`, `12-16-share-qr`, `12-17-security`, `12-21-identity`, `12-26-security-strict`, `18-07-security-balanced`, `18-08-security-balanced`.

**Files:**
- Create: `src/workspace/settings/categories/{IdentityCategory,ChannelsCategory,ChannelEditPage,ShareImportPage,SecurityCategory}.tsx` + tests

**Interfaces:**
- Consumes:
  - Channels: `ChannelsConfigSection` logic (`updateChannel`, reorder, export, import, delete, collisions); reorder mode takes the save dock with Cancel / Apply Order, which reboots.
  - Share/import: `ImportConfigModal` / `ExportConfigModal` logic, `QrCodeCanvas`.
  - Security: `SecurityConfigSection` fields and `usePolicyChangeConfirm`. Strict types the short name; Balanced is a plain confirm with today's body.
  - Identity: `NodeIdentitySection` fields.
- Produces: the category components registered in `CATEGORIES`.

- [ ] **BP1–BP7.** Extra test: with all 8 slots used, Add channel is disabled with today's text; AEAD shows only from firmware 2.8.1.
- [ ] **TG, then commit** `feat(workspace): identity, channels, security categories (#6365)`.

### Task 5.6: Device and module categories

Boards: none new (the category pages follow b-set-d1's pattern). Coverage is `12-06` / `12-07` behaviour plus the "Pins in use" card.

**Files:**
- Create: `src/workspace/settings/categories/{DeviceCategory,PositionCategory,PowerCategory,DisplayCategory,NetworkCategory,BluetoothCategory,ModuleCategory}.tsx`, `src/workspace/settings/PinsInUseCard.tsx` + tests

**Interfaces:**
- Consumes: the existing section components' field definitions. Rebuild their fields on the row kit, with the same names, validation and ranges; each section's field list comes from its component file. `GpioPinSummary` feeds the "Pins in use" card. `BrokerPresetSelector` stays in MQTT.
- Produces: one category per Device sub-item and one per module (`modules/<name>`).

- [ ] **Step 1: Write the failing tests.** Table-driven: for each category, every field of its section component renders a row with the same label key, and a change queues the right `ConfigSaveSection`.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/workspace/settings/categories/__tests__/deviceModules.test.tsx` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them until they pass.** → PASS.
- [ ] **Step 5: TG, then commit** `feat(workspace): device and module categories (#6365)`.

### Task 5.7: Maintenance, firmware, danger zone

Boards: `12-08-maintenance`, `12-09-firmware-update`, `12-10-danger-confirm`, `12-18-maintenance`, `12-19-firmware`, `12-27-restore-confirm`, `12-28-purge-confirm`.

**Files:**
- Create: `src/workspace/settings/categories/{MaintenanceIndex,BackupCategory,FirmwareCategory,DangerCategory}.tsx` + tests

**Interfaces:**
- Consumes:
  - Reload from radio (`reload()` → changes table); `BackupManagementSection` logic + `BackupRestoreConfirmDialog` summary.
  - `FirmwareUpdateSection` wizard (admin + OTA only; the unsupported card).
  - Danger: Purge node database (typed `PURGE`), reboot, Reboot into DFU, the resets typed with the short name (local only; disabled on a remote target with today's reason).
- Produces: the categories `maintenance/backup|firmware|danger`.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): maintenance, firmware, danger zone (#6365)`.

### Task 5.8: In MeshMonitor categories and Notifications

Boards: `b-set-d5-notifications`, `s2-notifications`, `12-12-meshmonitor-data`, `12-13-mqtt-bridge`, `12-23-meshmonitor-data`, `12-24-mqtt-bridge`.

**Files:**
- Create: `src/workspace/settings/categories/{NodeDisplayCategory,TelemetryCategory,PacketMonitorCategory,PkiDmCategory,ReliablePkiCategory,DataCategory,MqttBridgeCategory,CoverageRecordingCategory,NotificationsCategory}.tsx`, `src/workspace/settings/useAutosaveSetting.ts` + tests

**Interfaces:**
- Consumes:
  - `SettingsTab` source-mode fields and `POST /api/settings[?sourceId]` split logic;
  - `MqttBridgeConfigurationView` (keeps its own Save; it reconnects the broker);
  - `CoverageMqttRecordingSection` (asks first with the row-count warning);
  - `NotificationsTab` logic: services, Web Push on this browser, Apprise URLs, mutes, `AudioNotificationSettings`, homoglyph; plus the new **Replies** and **Mentions** toggles bound to `notifyOnReply` / `notifyOnMention` (default off).
- Produces: `useAutosaveSetting<T>(key: string, opts: { sourceId?: string; commit: 'change' | 'blur' }): [T, (v: T) => void, { saved: boolean; error?: string }]`. Toggles and selects save on change; text and numbers save on blur or Enter. Connection fields keep an inline Save.

- [ ] **BP1–BP7.** Extra test: Mentions shows for Meshtastic sources (today it is MeshCore only); both new toggles start off.
- [ ] **TG, then commit** `feat(workspace): MeshMonitor categories and notifications (#6365)`.

### Task 5.9: Remote target

Boards: `b-set-d6-remote`, `12-11-remote-node-cli`, `12-20-remote-picker`, `12-25-remote-console`, `12-29-target-actions`.

**Files:**
- Create: `src/workspace/settings/remote/{TargetPicker,useRemoteTarget,RemoteReadBar,NodeManagementCategory,RemoteConsoleCategory}.tsx|ts` + tests

**Interfaces:**
- Consumes: `AdminCommandsTab` logic: `nodeOptionsUtils`, the passkey status poll, `ensureSessionPasskey`, `/api/admin/load-config`, `/load-owner`, `/get-channel`, `applyLoadedConfig`, `sendAdminCommand`, `/api/admin/set-time`, `/api/admin/reboot`; `DeviceActionsSection`; `MeshtasticRemoteCliConsole`; `AutoFavoriteManagementSection`. Read only, with no edits to `AdminCommandsTab` (D15); shared logic is moved to hooks under Rule X where needed.
- Produces:
  - `useRemoteTarget(sourceId)`: `{ target, setTarget(nodeNum | 'local'), passkeyState, readCategory(id): Promise<void>, lastRead: Record<string, number>, sendCategory(id, values): Promise<'acknowledged' | 'noReply'> }`.
  - On a remote target, categories open empty with **Read from node** ("Sends 1 request"; never automatic) and "last read …". Save becomes **Send to node** ("Sends 1 admin packet per changed category"). "In MeshMonitor" is hidden; Node management and the CLI console are added.
  - `/source/:id/admin` redirects here with `?node=` (1.5).

- [ ] **BP1–BP7.** Extra test: opening a remote category sends nothing until Read from node is pressed (mesh checklist 1).
- [ ] **TG, then commit** `feat(workspace): remote target in settings (#6365)`.
- [ ] **PG for Phase 5.**

---

## Phase 6: You, Server, sign-in, devices

### Task 6.1: You › Sign-in & security, API token, one-time reveals

Boards: `r1-you-security`, `s4-security`, `b-set-p5-you`, `11-03-set-up-two-factor`, `11-04-passkey-only`, `11-05-api-token`, `11-06-change-password`, `11-10-set-up-two-factor`, `11-11-passkeys`, `11-12-passkey-only`, `11-13-api-token`.

**Files:**
- Create: `src/workspace/you/{YouSidebar,SecurityPage,TwoFactorSetup,PasskeysPage,PasskeyOnlyFlow,ApiTokenPage,ChangePasswordPage}.tsx` + tests

**Interfaces:**
- Consumes:
  - `MFAManagement` (`/api/mfa/*`), `PasskeyManagement`, `PasswordLoginControl`, `services/passkeyClient.ts`, `RecoveryCodesDialog` content, `ChangePasswordModal` (`forced`), `APITokenManagement` (`/api/token`, `/api/token/generate`);
  - `OneTimeReveal`, `ConfirmSheet`.
- Produces:
  - Routes `/you/security`, `/you/token`, `/you/password`.
  - API token: Revoke, then Generate. There is no Regenerate.
  - Turning on passkey-only follows today's order: explain, step-up, "Type DISABLE" for the only admin, then recovery codes with must-ack.
  - Deleting the last passkey while password sign-in is off shows today's `LAST_PASSKEY` error.
  - OIDC accounts hide Change password, Two-factor and Passkeys.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): You sign-in and security (#6365)`.

### Task 6.2: Sign-in pages

Boards: `11-01-sign-in`, `11-02-two-factor-step`, `11-07-sign-in`, `11-08-two-factor-step`, `11-09-recovery-code`.

**Files:**
- Create: `src/workspace/auth/{SignInPage,SignInCard}.tsx` + CSS + tests
- Modify: `src/workspace/WorkspaceApp.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`login`, `verifyMfa`, `loginWithPasskey`, `recoverWithCode`, `loginWithOIDC`), `PasskeyLoginButton`, `PasskeyRecoveryLink`, `usePasskeyAutofill`, `authStatus.customTitle` / `customLogoUrl`, the version.
- Produces:
  - With `anonymousDisabled`, Workspace renders `SignInPage` outside the shell.
  - Otherwise Sign in (rail avatar, guest tab) opens `SignInCard` in a dialog.
  - Errors as today: invalid credentials, "wait N minutes", session expired → Reload, cookie not set.
  - A recovery-code sign-in lands on the forced change-password page.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): sign-in pages (#6365)`.

### Task 6.3: You › Preferences and Help

Boards: `13-01-appearance`, `13-02-theme-editor`, `13-03-language-units`, `13-04-map-prefs`, `13-14-help-about`, `13-15-appearance`, `13-19-theme-editor`, `13-20-language-units`, `13-21-map-prefs`, `13-29-help-about`.

**Files:**
- Create: `src/workspace/you/preferences/{AppearancePage,ThemeEditorPage,LanguageUnitsPage,MapPrefsPage,HelpAboutPage}.tsx` + tests

**Interfaces:**
- Consumes:
  - `SettingsTab` global-mode fields for language, units, sorting, appearance, link previews, map and MeshCore messaging, saved via `useAutosaveSetting` (5.8);
  - `CustomThemeManagement` / `ThemeEditor` (`/api/themes`, `themes:write`), `TapbackEmojiSettings`, `LanguageSelector`, `TilesetSelector`, `user_map_preferences`;
  - `SystemStatusModal` data, `NewsPopup` (`forceShowAll`), and the docs and Ko-fi links.
- Produces:
  - Routes `/preferences/<category>`, `/you/help`.
  - Pages say "Applies to everyone on this MeshMonitor" where today's setting is install-wide (spec non-goal: per-user display preferences are a follow-up).

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): preferences and help (#6365)`.

### Task 6.4: Server categories, part 1

Boards: `b-set-d7-server`, `r4-server-general` (rest of General), `13-05-map-tiles`, `13-06-embed`, `13-07-backup-maintenance`, `13-08-channel-database`, `13-16-server-list`, `13-17-channel-database`, `13-22-map-tiles`, `13-23-embed`, `13-24-backup-maintenance`, `18-11-notification-services`, `18-12-notification-services`.

**Files:**
- Create: `src/workspace/server/{ServerSidebar,GeneralPage,NotificationServicesPage,MapTilesPage,EmbedPage,BackupMaintenancePage,ChannelDatabasePage}.tsx` + tests

**Interfaces:**
- Consumes:
  - General: `SettingsTab` admin fields (default landing page, MeshCore messaging admin, Reticulum retention, default source).
  - Notification services: Apprise API Server URL with Test Connection, External URL, and the VAPID block from `NotificationsTab`'s admin part.
  - `CustomTilesetManager`, `GeoJsonLayerManager`, `MapStyleManager`, the Carto key, `DefaultMapCenterPicker`, `EmbedSettings`.
  - `SystemBackupSection`, `DatabaseMaintenanceSection`, `SystemRestartSection`. Restart and Shut down are plain `ConfirmSheet`s, admins only.
  - `ChannelDatabaseSection`.
- Produces:
  - `server_sidebar` list: Devices, General, Notification services, Security & privacy, Backup & maintenance, Channel database, Scripts, Map & tiles, Embed, Background jobs, Integrations, Analytics.
  - Gates (s13n2): every settings viewer sees Backup & maintenance; `settings:write` adds Background jobs; everything else is admins only.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): server general, notifications, tiles, embed, backup, channel DB (#6365)`.

### Task 6.5: Server categories, part 2

Boards: `13-09-scripts`, `13-10-background-jobs`, `13-11-integrations`, `13-12-security-privacy`, `13-25-scripts`, `13-26-background-jobs`, `13-27-integrations`, `13-28-security-privacy`.

**Files:**
- Create: `src/workspace/server/{ScriptsPage,BackgroundJobsPage,IntegrationsPage,SecurityPrivacyPage,AnalyticsPage}.tsx` + tests

**Interfaces:**
- Consumes:
  - `ScriptsSection` card states;
  - position estimation, auto-enrichment (push warning: "Sends 1 NodeInfo request … at most 25 per run, 30 s apart"), mesh issues thresholds, coverage retention, solar;
  - translation (+ Test), ADS-B, elevation, MeshWars, ATAK, Virtual Node replay, ducting, MQTT root;
  - Reliable PKI global, remote admin, noindex, `PrivacyDocumentsSection`, analytics providers.
  - Keys keep their own Save and Test.
- Produces: the remaining Server routes.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): server scripts, jobs, integrations, security & privacy (#6365)`.

### Task 6.6: Add device and Server › Devices

Boards: `h1-add-type`, `h2-add-connection`, `h3-add-connect`, `h4-server-devices`, `i1-add-type`, `i2-meshcore`, `i3-failed`, `18-09-add-reticulum`, `18-10-add-reticulum`.

**Files:**
- Create: `src/workspace/devices/{AddDeviceFlow,TypeStep,ConnectionStep,ConnectStep,DevicesPage,useSourceForm}.tsx|ts` + tests
- Modify (Rule X): `src/pages/DashboardPage.tsx` (move the about 60 `formX` states and the submit/build logic into `useSourceForm`; same DOM)

**Interfaces:**
- Produces:
  - `useSourceForm(initial?: DashboardSource): { values, set(field, v), fieldsetsFor(type), validate(): string | null, submit(): Promise<DashboardSource> }`. Same payloads as today, with the masked-field and bbox seed helpers kept.
  - `AddDeviceFlow` has three steps: type, then connection (today's per-type fields, including Reticulum Attach to shared rnsd / TCP peer, Bridge URL and token), then name and connect. Save creates the source and connects. The result shows what was found, or why it failed, with Edit / Try again / Save anyway.
  - `DevicesPage` lists every device, disabled ones too. It uses today's order through `POST /api/sources/reorder` (drag or ↑/↓) and today's enable, edit, resync, prune and remove (plain confirms). Admins only.

- [ ] **BP1–BP7.** Extra test: the `useSourceForm` payload for each of the 6 types equals today's `DashboardPage` payload for the same inputs. Then run `npx vitest run src/pages/DashboardPage*` → PASS with no test edits.
- [ ] **TG, then commit** `feat(workspace): add device flow and server devices (#6365)`.

### Task 6.7: Device states and Connection card

Boards: `h5-offline`, `h6-first-run`, `i4-offline`, `i5-receive-only`, `i6-guest`.

**Files:**
- Create: `src/workspace/devices/{ConnectionCard,OfflineBanner,FirstRun}.tsx` + tests

**Interfaces:**
- Consumes: `useSourceStatuses`, `SystemStatusModal` connection actions, connect/disconnect endpoints.
- Produces:
  - Tapping the status line opens `ConnectionCard`: last error, 24 h up/down, Retry, Edit, Disconnect.
  - Offline keeps history and disables composers.
  - Receive-only swaps the composer for one line.
  - A guest sees what anonymous read allows.
  - First run (admin, no sources) leads to Add device.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): device states and connection card (#6365)`.
- [ ] **PG for Phase 6.**

---

## Phase 7: MeshCore and Reticulum

All MeshCore tasks consume `useMeshCore({ baseUrl, sourceId })` (`status`, `nodes`, `contacts`, `messages`, `actions`) and `useMeshCoreViewAccess()` gates. The MeshCore parts of `NodeActionMenus` are Ping, Trace path and Discover path. Every board note in s8n0–s8n6 applies.

### Task 7.1: MeshCore shell, channels, rooms

Boards: `8-01-heltec-shell`, `8-02-route-details`, `8-03-room-login`, `8-04-room-posts`, `8-16-meshcore-home`, `8-17-room-login`, `8-18-room-posts`, `8-19-channel-thread`, `8-24-route-details`.

**Files:**
- Create: `src/workspace/meshcore/{MeshCoreSidebar,MeshCoreChannelThread,HeardBySheet,RouteDetails,RoomLogin,RoomPosts,AdvertMenu}.tsx` + tests

**Interfaces:**
- Consumes: `MeshCoreChannelsView` / `MeshCoreRoomsView` / `MeshCoreDirectMessagesView` internals, room login progress (`useMeshCoreLoginProgress`), `useMeshCoreUnread`, `useReadStateSync`, `MessageRowD`, `Composer` (byte counter, scope chip).
- Produces:
  - Sidebar: Map, Nodes, Dashboard, Automations, More tools… (Info, Packet monitor), then Channels, Rooms and Direct messages.
  - Advert nearby / Flood advert, each with its Sends line (flood asks first).
  - Room login: attempt N of 3 with countdown; auto-sync with its "1 login per interval" Sends line.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): MeshCore shell, channels and rooms (#6365)`.

### Task 7.2: MeshCore contacts, node page, nodes

Boards: `g6-meshcore`, `8-05-companion-contact`, `8-11-nodes`, `8-20-companion-contact`, `8-28-nodes-discover`.

**Files:**
- Create: `src/workspace/meshcore/{ContactPage,PathEditor,MeshCoreNodesTable,DiscoverMenu}.tsx` + tests

**Interfaces:**
- Consumes: `MeshCoreContactDetailPanel` parts, `actions` (path set/reset, discover, ping, trace, import contact), `MeshCoreNodesView`.
- Produces: the MeshCore node page in `NodePage`'s frame (3.4) with the protocol-specific tabs. The repeater keeps Log in first. The Console tab links to `/source/:id/settings/console?node=<key>`.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): MeshCore contacts and nodes (#6365)`.

### Task 7.3: MeshCore remote targets

Boards: `8-06-repeater-console`, `8-07-repeater-settings`, `8-21-repeater-console`, `8-25-repeater-settings`.

**Files:**
- Create: `src/workspace/meshcore/remote/{MeshCoreTargetPicker,RepeaterConsoleCategory,RepeaterSettingsCategory,AclManager}.tsx` + tests

**Interfaces:**
- Consumes: `CliConsoleBody` (+ `DANGER_COMMAND_PATTERN`), `MeshCoreRemoteConsole` and `MeshCoreCompanionRemoteConsole` logic, `RepeaterSettingsForm`, the admin session login (guest/admin, remember), `TargetPicker` pattern from 5.9.
- Produces:
  - Settings remote target for repeaters and rooms.
  - A destructive console command opens a `ConfirmSheet`.
  - Each console command, Fetch stats and Send to node carries its Sends line.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): MeshCore repeater and room admin (#6365)`.

### Task 7.4: MeshCore settings, channels, maintenance

Boards: `8-08-settings-radio`, `8-09-channels`, `8-10-maintenance`, `8-22-settings-list`, `8-26-channels`, `8-27-maintenance`.

**Files:**
- Create: `src/workspace/meshcore/settings/*Category.tsx` + tests
- Modify: `src/workspace/settings/categories.ts` (register MeshCore categories by `sourceTypes`)

**Interfaces:**
- Consumes:
  - `MeshCoreConfigurationView` sub-sections and their `actions.*` setters;
  - `MeshCoreSettingsView` sections;
  - `MeshCoreChannelsConfigSection`, `BackupManagementSection protocol="meshcore"`, `MeshCoreDeviceManagement`;
  - `meshcoreConfigurationNavItems` gates.
- Produces:
  - MeshCore lists. On the radio: Name, Location, Radio, TX power, Telemetry, Path hash & scope, Sender names, Channels, Contacts, Observer, Console, Maintenance; a local repeater adds Adverts & forwarding, Access and Clock.
  - In MeshMonitor: Connection, Receive-only, Reactions, Required repeaters, Regions, Display, Filters, Notifications.
  - Danger words from s8n2 (device name for Power off, Restore Private Key, Factory Reset).

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): MeshCore settings (#6365)`.

### Task 7.5: MeshCore packets, info, automations, region feed

Boards: `8-12-packet-detail`, `8-13-info`, `8-14-automations`, `8-15-mqtt-region-feed`, `8-23-region-feed`, `8-29-packet-detail`, `8-30-info`, `8-31-automations`.

**Files:**
- Create: `src/workspace/meshcore/{MeshCorePacketsPage,MeshCoreInfoPage,MeshCoreAutomationsPage,RegionFeedPage}.tsx` + tests

**Interfaces:**
- Consumes: `MeshCorePacketMonitorView` (decode, Decrypt with a key from source X, grouped observers), `MeshCoreInfoView` (Sync time), `MeshCoreAutomationsView` (12 built-ins with Sends lines), `MeshCoreIngestView` (receive-only).
- Produces: routes for these views under `/source/:id/<view>`.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): MeshCore packets, info, automations, region feed (#6365)`.

### Task 7.6: Reticulum

Boards: `9-01-reticulum-shell`, `9-02-destinations`, `9-03-interfaces`, `9-04-paths`, `9-05-map-connections`, `9-06-settings-identity`, `9-07-settings-rnode`, `9-08-info`, `9-09-reticulum-home`, `9-10-lxmf-thread`, `9-11-destinations`, `9-12-interfaces-paths`, `9-13-settings-list`, `9-14-map-connections`, `9-15-settings-identity`, `9-16-info`.

**Files:**
- Create: `src/workspace/reticulum/{ReticulumSidebar,LxmfThread,DestinationsPage,InterfacesPage,PathsPage,ReticulumMapPage,IdentityCategory,RNodeCategory,ReticulumInfoPage}.tsx` + tests

**Interfaces:**
- Consumes: `useReticulum` (status polled ~30 s as today, destinations, interfaces, conversations, `sendMessage`, paths, probe, remote status), `ReticulumDestinationDetail`, `ReticulumConnectionsGraph`, `ReticulumMap`, `ReticulumIdentitySection` (Announce now with the server's 60 s cooldown countdown), `ReticulumConfigurationView` radio (own mode only).
- Produces:
  - Sidebar: Map, Destinations, Dashboard, More tools… (Interfaces, Paths, Info), and LXMF MESSAGES.
  - No New conversation button.
  - Info shows "Unknown" for own mode, as today.
  - Status line with mode, counts, the RNode badge and Refresh.

- [ ] **BP1–BP7.** Extra test: Send shows "Sends 1 LXMF message"; Probe shows "Sends 1 probe packet".
- [ ] **TG, then commit** `feat(workspace): Reticulum (#6365)`.
- [ ] **PG for Phase 7.**

---

## Phase 8: Dashboard, Automations, More tools

### Task 8.1: Device dashboard, per-user board

Boards: `j1-dashboard`, `j2-dashboard-edit`, `k1-dashboard`, `k2-dashboard-edit`, `k3-add-widget`.

**Files:**
- Create: `src/workspace/dashboard/{DeviceDashboard,HealthStrip,useUserBoard,EditControls}.tsx|ts` + tests

**Interfaces:**
- Consumes:
  - `Dashboard` parts (`DashboardGrid`, widget renderers, `AddWidgetModal` with `supported`, `dataSources.ts`);
  - `useFavorites` / `telemetryFavorites` (shared, D19);
  - `useUserPreference`.
- Produces:
  - `useUserBoard(sourceId | 'overview'): { widgets: CustomWidget[]; order: string[]; setWidgets(w): Promise<void>; setOrder(o): Promise<void> }`. It is stored in pref `dashboard.<id>` as `{ widgets, order }`. On first read it is seeded from today's per-source `dashboardWidgets` / `telemetryCustomOrder`; it never writes those keys (D12).
  - `HealthStrip` tiles: nodes online, channel util (amber over 25 %), airtime TX, packets/h, low battery, new today. 6 of 9 are shown by default, computed from data the dashboard already loads. Each tile links to its filtered view.
  - Edit mode works on phone with ↑/↓ as well as drag.

- [ ] **BP1–BP7.** Extra test: editing the Workspace board leaves `/api/settings?sourceId` untouched (no `dashboardWidgets` POST), and Classic's board is unchanged.
- [ ] **TG, then commit** `feat(workspace): device dashboard with per-user board (#6365)`.

### Task 8.2: Overview dashboard

Boards: `j3-overview-dashboard`, `16-04-overview-dashboard`.

**Files:**
- Create: `src/workspace/dashboard/OverviewDashboard.tsx` + tests

**Interfaces:**
- Consumes: 8.1, `useDashboardUnifiedData`, `DeviceTag`.
- Produces: one row per device, then the user's Overview board (`dashboard.overview`) mixing widgets from any device, each tagged with its device.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): Overview dashboard (#6365)`.

### Task 8.3: Device automations and built-ins

Boards: `m1-automations`, `m3-builtin`, `n1-automations`, `n4-builtin`, `14-05-builtins-list`, `14-06-auto-responder`, `14-07-geofence-trigger`, `14-08-auto-acknowledge`, `14-12-responder-trigger`, `14-14-builtins-list`, `14-15-geofence-trigger`, `14-16-auto-acknowledge`.

**Files:**
- Create: `src/workspace/automations/{DeviceAutomations,BuiltinPage,builtinSends}.tsx|ts` + tests

**Interfaces:**
- Consumes: `AutomationTab` sections (each built-in renders today's section component inside `BuiltinPage` with its `SaveBarGroup`), `AutomationContext`, `ScriptTestModal`, `GET /api/automations` (rules that include this device).
- Produces:
  - `builtinSends(id: BuiltinId, settings: Record<string, unknown>, t): string`: the Sends line computed from existing settings, worded per s14n1. For example: auto-ack "60 s cooldown per sender · stays quiet once 2 other nodes replied"; auto-responder "cooldown per trigger and node". A built-in that is off says "When on, …".
  - The device door lists its built-ins grouped (Replies, Scheduled sends, Node care, Data) with the "12 more" row, then the rules that include it.

- [ ] **BP1–BP7.** Extra test: a table of `builtinSends` outputs for each built-in with fixture settings, so no invented per-minute cap appears.
- [ ] **TG, then commit** `feat(workspace): device automations and built-ins (#6365)`.

### Task 8.4: Overview automations, rules, variables, templates

Boards: `m2-rule`, `m4-runs`, `n2-rule`, `n3-when`, `14-01-overview-automations`, `14-02-variables`, `14-03-templates-wizard`, `14-04-live-trace`, `14-09-overview-automations`, `14-10-variables`, `14-11-template-wizard`, `14-13-runs-trace`.

**Files:**
- Create: `src/workspace/automations/{RulesList,RulePage,RuleSteps,WhenSheet,RunsTab,TraceTab,VariablesPage,TemplateWizard}.tsx` + tests

**Interfaces:**
- Consumes: `AutomationsPage` parts and calls (`/api/automations` CRUD, enable/disable, export, duplicate, `runAutomationNow`, test, runs, `LiveTracePanel`, variables, `TemplateGallery`), `AutomationBuilder`, `AutomationTester`.
- Produces:
  - Routes `/automations/:ruleId[/runs|/trace]` and `/overview/automations`.
  - Rules with neither a rate limit nor a cooldown show "No limit set".
  - Run now sits in the rule header and opens a `ConfirmSheet` with today's confirm text, listing what it would send per device.
  - Duplicate asks for a name in a sheet; delete is a plain `ConfirmSheet` (they replace the native `prompt` and `confirm`; Ruling D9d: same behaviour, new pattern).

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): rules, runs, trace, variables, templates (#6365)`.

### Task 8.5: More tools: packets, info, security

Boards: `o1-packets`, `o2-info`, `o3-security`, `q1-tools`, `q2-packets`, `q3-packet`, `16-01-info`, `16-02-security`, `16-05-security-digest`, `16-06-quiet-nodes`, `16-07-delete-nodes`.

**Files:**
- Create: `src/workspace/tools/{ToolsPage,DevicePackets,PacketSheet,InfoPage,SecurityPage,QuietNodes}.tsx` + tests

**Interfaces:**
- Consumes:
  - `PacketMonitorPanel` / `usePackets` (with the column picker), `MqttPacketMonitorView`;
  - `InfoTab` data calls;
  - `SecurityTab` calls (issues, dead-nodes, key-mismatches, meshcore findings, scanner, export).
  - "Send a DM to <node>" is one button per node and opens a DM pre-filled with today's notice.
  - Quiet nodes is today's Dead nodes. Delete asks plainly with today's words and needs `security:write` and `nodes:write`.
- Produces: the routes `/source/:id/{packetmonitor,info,security,tools}`.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): device packets, info, security (#6365)`.
- [ ] **PG for Phase 8.**

---

## Phase 9: Shared patterns, odd pages, gate removal

### Task 9.1: Pattern sweep, toasts, states, reboot wait

Boards: `17-01-confirm-patterns`, `17-02-confirm-sheets`, `17-03-toasts-reboot`, `17-04-states`, `17-10-toasts-reboot`, `17-11-states`.

**Files:**
- Create: `src/workspace/patterns/{ToastHost,RebootWait,ConfigBanner}.tsx` + tests
- Modify: every Workspace screen still using a non-`ConfirmSheet` confirm (grep `window.confirm|ConfirmDialog|TypedConfirmDialog` under `src/workspace`)

**Interfaces:**
- Consumes: `DeviceNotificationToaster` (8 s, inside `ToastProvider` and the WebSocket context), `AppBanners` `configIssues` (`/api/auth/check-config-issues`), `RebootModal` polling, `StateView`.
- Produces: one confirm pattern everywhere in Workspace, and the route loading, error and no-permission states.

- [ ] **BP1–BP7.** Extra checks:
  - `grep -rn "window.confirm\|TypedConfirmDialog\|shared/automation/ConfirmDialog" src/workspace` prints nothing;
  - Playwright screenshots of `10-01`, `12-04` and `13-01` with `data-theme="latte"` show legible text, with every Workspace CSS module colour coming from a token (Review Focus 5).
- [ ] **TG, then commit** `feat(workspace): shared confirm, toasts, states, reboot wait (#6365)`.

### Task 9.2: Odd pages

Boards: `17-05-privacy-document`, `17-06-embed-map`, `17-07-outlier-cleanup`, `17-08-broker-presets`, `17-09-news`, `17-12-privacy-document`, `17-13-embed-map`, `17-14-outlier-cleanup`, `17-15-broker-presets`, `17-16-news`.

**Files:**
- Create: `src/workspace/misc/{OutlierCleanupPage,BrokerPresetsSheet,NewsSheet}.tsx` + tests

**Interfaces:**
- Consumes: `TelemetryOutlierDialog` logic (a dry run first, then today's plain confirm); `SavedBrokerPresetDialogs` and `useMqttBrokerPresets` (the inline "Delete this preset?" stays); `NewsPopup` logic (auto-opens once; closing dismisses every item it showed).
- Produces:
  - `/privacy/:slug` and `/embed/:profileId` stay today's public pages, outside both layouts: no change, verified only. Record a Ruling saying they are unchanged and why the board matches.
  - Outlier cleanup is reachable from Settings › Data danger zone and from a telemetry chart's ⋯ menu.

- [ ] **BP1–BP7.**
- [ ] **TG, then commit** `feat(workspace): outlier cleanup, broker presets, news (#6365)`.

### Task 9.3: Remove the preview gate, switch on the Classic entry points (own commit)

**Files:**
- Modify:
  - `src/workspace/layout/resolveLayout.ts` (drop rule 1 and the `preview` input), `useLayout.ts`, `LayoutGate.tsx`
  - `src/server/config/environment.ts` and `configRoutes.ts` (remove `workspacePreview`)
  - `src/workspace/layout/workspaceEntry.ts` (`WORKSPACE_ENTRY_ENABLED = true`)
  - tests
  - `CLAUDE.md` (drop the preview note)

- [ ] **Step 1: Update the tests.**
  - `resolveLayout` without `preview`: a user layout wins, then the default, then classic.
  - The banner shows for a signed-in Classic user with `offerWorkspaceBanner` on and no `layout` pref.
  - The menu item is present.
  - Delete the preview-false tests.
- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/workspace/layout src/components/WorkspaceBanner` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them until they pass.** → PASS. Then run the Classic chrome snapshot → PASS. It is unchanged, because the banner renders only for the conditions above, and the fixture has `offerWorkspaceBanner` off.
- [ ] **Step 5: TG, then commit** `feat(workspace): remove preview gate, enable Classic entry points (#6365)` as its own commit, so the requester can drop it (D4).
- [ ] **PG for Phase 9.**

---

## Final

### Task F.1: Whole-branch review

- [ ] **Step 1: Dispatch the reviewer.** A fresh reviewer on the most capable model reviews `git diff main...claude/eager-pascal-svegts` against the spec, this plan, CLAUDE.md and the Review Focus list. It reports Critical / Important / Minor findings with file:line.
- [ ] **Step 2: Record the findings in the ledger.** Every finding gets a line; Minor findings not fixed are listed as deferred.

### Task F.2: One fix pass

- [ ] **Step 1: Fix the findings.** Fix every Critical and Important finding, and any Minor finding that costs under ~20 lines. Each fix gets a failing test first where it changes behaviour.
- [ ] **Step 2: Run the TG.**
- [ ] **Step 3: Commit** `fix(workspace): whole-branch review fixes (#6365)`.

### Task F.3: Final report

- [ ] **Step 1: Write the report.** Write `docs/superpowers/workspace-final-report.md` with:
  - BLOCKED items first;
  - every `Ruling:` line;
  - deferred minors;
  - a board-by-board coverage table: each of the 324 boards with its phase, test file, Playwright screenshot name and status (accepted / deviation with Ruling / blocked);
  - the verification evidence (Vitest totals including `numPendingTests` with containers up, lint:ci, build, Playwright).
- [ ] **Step 2: Update the PR body** with the summary and a link to the report. Publish the final contact sheet as an artifact.
- [ ] **Step 3: Commit and push.**
