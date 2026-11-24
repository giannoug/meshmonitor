# Workspace own-issues Implementation Plan (#6365)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Workspace-side items still open after the leftovers pass (every b3 item, the pass's deferred minors, and the in-scope b2 items once the requester decides them), with no backend change and no Classic behaviour change.

**Architecture:** Thirteen area tasks (W1–W13), each a set of small, independent fixes inside `src/workspace/` with its own tests and one commit. Seven decision tasks (D1–D7) run only after the requester approves them. Everything that needs a Classic change or a new feature is out of the main plan and is listed under "Questions for the requester".

**Tech Stack:** React 19 + TypeScript, react-router-dom 7 (`BrowserRouter`, no data router), TanStack Query 5, react-i18next (`public/locales/en.json`), CSS modules, Vitest + Testing Library, Playwright (`npm run test:workspace-e2e`).

**Spec:** the triage in `docs/superpowers/workspace-leftovers.md` (buckets b2/b3), the "Deferred minors" and "Leftovers pass → Still open" sections of `docs/superpowers/workspace-final-report.md`, and the design boards (`design-scratch/png3/`, `design-scratch/out3/project/`). Item IDs below (S, C, M, O, R) are from the 2026-11-24 re-verification at e962924. Each row cites the code it was checked against.

## Global Constraints

- The design boards win on layout.
- Rule X: Classic changes only by behaviour-preserving extraction, and Classic tests need no edits. This plan contains **no** Classic edits. A step that turns out to need one stops and reports it.
- No backend change. No new feature.
- No new intervals (`setInterval`, `refetchInterval`, a polling `usePoll`).
- Never add a second polling observer to a query the shell already polls. Read such a query passively (`queryFn: skipToken` or `enabled: false` on the same key, as `src/workspace/shell/shellUnread.ts` does).
- Escape closes only the top layer.
- `submitOnEnter={false}` on any ConfirmSheet that transmits or destroys.
- Tests wait for a button to be enabled before clicking it.
- Guard keyboard sends and destroys against key repeat (`if (e.repeat) return`).
- Locale edits go in `public/locales/en.json`, under `workspace.*` keys only. Reuse an existing key where it labels the same control.
- Any item that grows past about 3× its size estimate, or needs a visual call the board doesn't settle, stops and is reported instead of done.
- Rulings go in `docs/superpowers/workspace-ledger.md`, starting at **JM**. The controller writes them; implementers propose them in their report.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XZBsd77K8LhKbcQtqcxWE6
  ```
- Push only to `claude/eager-pascal-svegts`. No PR.

## Mesh impact checklist (CLAUDE.md)

No task in W1–W13 sends a packet, arms a timer or adds a limit.
1. **Airtime:** none. The only transmitting surfaces touched are keyboard and focus paths on message actions (W3) and the node-page channel menu (W3). Neither adds a send.
2. **Spam:** none new. W3's arrow-key menu skips repeat keydowns on items that send or destroy.
3. **Save resets a timer:** no scheduler is touched.

Server reads change in three places, all downward or equal:
- W8 RelayModal stops mounting a full `/api/poll` observer.
- W11 merges two MeshCore runtimes and two Reticulum runtimes into one each.
- W10 DangerCategory reads the poll cache instead of starting its own 15 s retrying observer.

Two reads are added. W1 adds one unpolled `GET /api/user/map-preferences`, shared with You › Map. W12 refetches automation runs on each open, as Classic does.

D5 (AclManager) touches a transmit path (`setperm` over the mesh). D5's text covers it.

## Review Focus

1. **Keyboard-only user after a menu or panel closes:** focus returns to the control that opened it, never to `<body>`. Tests in W2 (RowMenu), W3 (⋯ menu, details panel).
2. **"Show MQTT" off on a source with MQTT-only unread:** the rail and sidebar badges match the thread (no badge). Test in W4.
3. **A disabled source, or one whose status fails:** it is never the phone Home target. Test in W1.
4. **Phone with a bottom safe-area inset (notch):** portalled search overlays end at the tab bar's top edge and don't cover it. Test in W1.
5. **Request counts:** opening RelayModal, a settings category, the MeshCore console or Reticulum settings adds no polling observer and no duplicate runtime read. Request-count tests in W8, W10, W11.

---

## How every task runs

- Read the cited code first. Line numbers are from e962924 and may move.
- Write the failing tests named in the task. Run them and see them fail, then implement, and run them again until they pass.
- Then run the task's folder: `npx vitest run src/workspace/<area>`. A task that touches a board in `tests/workspace-e2e/` also runs `npm run test:workspace-e2e -- -g <board>`.
- Commit once per task: `fix(workspace): <area> own-issues (#6365)`.
- The full gate runs once, after W13 (see "Final gate").

---

### Task W1: Shell and You

**Size:** ~110 lines · **Risk:** Low–Medium (S3 touches the hash bridge) · **Files:** `shell/WorkspaceShell.tsx`, `shell/WorkspaceShell.module.css`, `shell/useWorkspaceSources.ts`, `shell/DeviceSwitcherSheet.tsx`, `settings/SettingsSearch.module.css`, `chat/SearchMessages.module.css`, `layout/useLayout.ts`, `prefs/useUserPreferences.ts`, `you/LayoutPage.tsx`, `you/YouHome.tsx`, `auth/SignIn.module.css`, `auth/SignInCard.tsx`, `auth/SignInDialog.tsx`, `server/GeneralLayoutCard.tsx`, `chat/ChatProviders.tsx`, tests under `shell/`, `you/`, `auth/`, `server/__tests__/r4-server-general.test.tsx`, `src/components/WorkspaceBanner/__tests__/r3-classic-banner.test.tsx` (Workspace entry point, not Classic).

**Interfaces:**
- Produces: `useWorkspaceSources()` also returns `openId: string | null`. WorkspaceShell uses it instead of recomputing `matchPath`.
- Produces: `prefPath(key: string): string`, exported from `prefs/useUserPreferences.ts` (today's private `path()`).

- [ ] **Step 1: Write failing tests**
  - `shell/__tests__/shellHome.test.tsx` › "Home skips a disabled last-open device": open A, mark A disabled in the sources fixture, go to `/you`, and assert the Home tab's `href` is the Overview path.
  - `shell/__tests__/railUnreadPref.test.tsx` › "unread badges follow unreadIndicatorEnabled": with `GET /api/user/map-preferences` → `{ unreadIndicatorEnabled: false }`, no rail badge is rendered.
  - `shell/__tests__/hashBridge.test.tsx`:
    - "Back fires one hashchange": spy on `window.dispatchEvent`, navigate between two settings hashes, `history.back()`, and expect 0 synthetic events on the POP.
    - "re-clicking the open category fires one hashchange".
  - `you/__tests__/layoutPage.test.tsx` › "a failed preferences load shows an error, not defaults": prefs GET → 500, so `StateView` error text is shown and the layout choices are disabled.
  - `you/__tests__/s1-you.test.tsx` › "Logout is aria-disabled while signing out".
  - `shell/__tests__/drawerFocus.test.tsx` › "drawer with no focusable content focuses the drawer itself".
  - `shell/__tests__/switcherName.test.tsx` › the row's accessible name is `"<name>, <chip>, <status>"`, with comma separators.
  - Phone overlay: render SettingsSearch and SearchMessages on a phone and assert their `bottom` style includes `env(safe-area-inset-bottom` (jsdom can't lay it out, so check the CSS).
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **S1** `SettingsSearch.module.css:36`, `SearchMessages.module.css:36`: `bottom: calc(var(--ws-tabbar-height, 64px) + env(safe-area-inset-bottom, 0px))`.
  - **S3** `WorkspaceShell.tsx:81-88` `useHashChangeOnNavigate`: skip when `useNavigationType() === 'POP'`. On a click on the already-open category link, dispatch the event from the link's `onClick`.
  - **S4** Return `openId` from `useWorkspaceSources` (it is computed at `:52`), and drop the second `matchPath` at `WorkspaceShell.tsx:121`. Change `.drawerButton` to `composes: square from './DeviceRail.module.css'`, keeping only what differs. The `.srOnly` consolidation is skipped (see Skips).
  - **S5** `useWorkspaceSources.ts:63-65`: read `unreadIndicatorEnabled` through the same query key You › Map uses (`you/preferences/MapPrefsPage.tsx`; no `refetchInterval`). AND it into both unread `enabled` flags, and hide the badges when it is `false`. Default `true` while loading.
  - **S6** `WorkspaceShell.tsx:124`: when the source for `lastId` has status `'disabled'`, treat `lastId` as `null`.
  - **S8** `LayoutPage.tsx:33-38`: read `isError` and `isPending` from `useUserPreferences`. Show `<StateView kind="error">` on error, and disable the choices while pending.
  - **S9**:
    - `useLayout.ts:61` uses `prefPath('layout')`.
    - `GeneralLayoutCard.tsx:122` uses a new key, `workspace.server.layout_group` ("Layout").
    - Replace the 50 ms sleeps (`r4-server-general.test.tsx:105,159,199`, `r3-classic-banner.test.tsx:49,142`) with `waitFor` on the request log.
    - The r3 "Try it" test also asserts the banner text is gone.
  - **S15**:
    - Logo tile uses `var(--device-3)` (`SignIn.module.css:41`; board 11-01).
    - `SignInCard.tsx:273` picks Reload from an `expired: boolean` prop instead of comparing message text.
    - `SignInDialog` resets its title when it opens.
    - Replace `SignInGate.test.tsx:45`'s sleep with `waitFor`.
  - **S21** Wrap `ChatProviders.tsx:3` to ≤120 chars.
  - **S23a** `YouHome.tsx:98` Logout row: `aria-disabled` and a dimmed class while `signingOut`. If `TwoLineRow` has no prop for that, pass `className`.
  - **S23b** `WorkspaceShell.tsx:228-230`: the drawer gets `tabIndex={-1}`, and focus falls back to the drawer when no `a, button` is found.
  - **S23c** `DeviceSwitcherSheet.tsx:76-87`: `aria-label` on the row, made from the parts joined with `", "`. The parts stay `aria-hidden`.
- [ ] **Step 4: Run `npx vitest run src/workspace/shell src/workspace/you src/workspace/auth src/workspace/server src/components/WorkspaceBanner`.** All pass.
- [ ] **Step 5: Commit.**

### Task W2: Shared patterns (Sheet, ConfirmSheet, OneTimeReveal, RowMenu, NewsSheet)

**Size:** ~90 lines, mostly tests · **Risk:** Low · **Files:** `patterns/OneTimeReveal.tsx`, `patterns/ConfirmSheet.tsx`, `patterns/RowMenu.tsx`, `patterns/Sheet.tsx`, `misc/NewsSheet.tsx`, `server/BrokerPresetsSheet.tsx`, `patterns/__tests__/Sheet.test.tsx`, `patterns/__tests__/sharedPatterns.test.tsx`, `misc/__tests__/17-09-news.test.tsx`.

**Interfaces:**
- Produces: `Sheet` accepts `bodyRef?: React.Ref<HTMLDivElement>` (the scroll container). NewsSheet uses it instead of `parentElement`.

- [ ] **Step 1: Write failing tests**
  - Sheet:
    - "focus returns to the opener on close".
    - "Shift+Tab on the first element wraps to the last".
  - ConfirmSheet:
    - "danger tone sets the danger class".
    - "Cancel is enabled when not busy".
    - "a click on Confirm while busy does not call onConfirm".
    - "clicking the footer Confirm submits through `form=`" (a real button click, not `fireEvent.submit`).
    - "the busy live region is mounted empty before busy". Assert the `role=status` node exists with no text before busy, and holds text after.
  - StateView: "shows `detail`". SendsLine: "renders its icon".
  - OneTimeReveal:
    - "two identical secrets render two rows".
    - "a clipboard failure shows an error line". Make `navigator.clipboard.writeText` reject and expect the `workspace.patterns.copy_failed` text.
  - RowMenu:
    - "selecting a checkbox item returns focus to the trigger".
    - "Tab closes the open menu".
  - NewsSheet: "changing page scrolls the body to top" (spy on `scrollTo` through `bodyRef`).
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **S10** `OneTimeReveal.tsx:56` `key={i}`. In `:45`'s catch, set `copyFailed` and render the line (new key `workspace.patterns.copy_failed`). In `ConfirmSheet.tsx:91`, keep the `role="status"` span always mounted and fill it only while busy.
  - **S17 (RowMenu part)** `RowMenu.tsx:135-138`: call `trigger.current?.focus()` before `onSelect`, unless the item navigates. Add a `keydown` Tab handler on the portalled menu that closes it and lets Tab continue from the trigger.
  - **S22**:
    - `Sheet.tsx`: forward `bodyRef` to the body div.
    - `NewsSheet.tsx:46`: scroll through `bodyRef`.
    - `BrokerPresetsSheet.tsx:45-50` `whenTopLayer`: compare the topmost open dialog against this sheet's own ref instead of using `closest('[role=dialog]')`, so a portalled finder can't close the form.
- [ ] **Step 4: Run `npx vitest run src/workspace/patterns src/workspace/misc src/workspace/server`.** All pass.
- [ ] **Step 5: Commit.**

### Task W3: Chat threads, message rows, node-page menus

**Size:** ~150 lines · **Risk:** Medium (C11 changes the tab order of every message row) · **Files:** `chat/MessageRowD.tsx`, `chat/MessageRowD.module.css`, `chat/MessageHoverBar.tsx`, `chat/MessageHoverBar.module.css`, `chat/MessageDetailsPanel.tsx`, `chat/useMessageActions.tsx`, `chat/ChannelHeaderMenu.tsx`, `chat/DmHeader.tsx`, `map/NodePeek.tsx`, `map/MapNodeList.tsx`, `nodes/nodeColumns.tsx`, `patterns/NodeActionMenus.tsx`, `chat/__tests__/10-08-message-actions.test.tsx`, `chat/__tests__/10-05-read-only.test.tsx`.

**Interfaces:**
- Consumes: `avatarToken(id: string)` from `chat/channelLabel.ts:54` (unchanged).

- [ ] **Step 1: Write failing tests**
  - "Esc on the ⋯ menu returns focus to ⋯".
  - "choosing a ⋯ item returns focus to ⋯ (when the row still exists)".
  - "closing message details returns focus to the element that opened it".
  - "a desktop message row is one Tab stop; ArrowRight/ArrowLeft move between reply/react/translate/⋯".
  - "the message text toggle is a button and toggles with Enter".
  - "ChannelHeaderMenu: ArrowDown/ArrowUp move focus between items; Home/End jump; a repeated Enter keydown is ignored".
  - C9: "React and Resend are disabled with the TX-disabled reason (txOff fixture)" and "…with the disconnected reason".
  - "the ⋯ menu on the last row opens upward". In jsdom, stub `getBoundingClientRect` so the row sits within the menu's height of the list's bottom, then assert `data-placement="up"`.
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **C6**:
    - `MessageRowD.tsx:182`: the clickable text wrapper becomes `<button type="button" className={styles.textToggle}>` with the same handler, and the CSS resets the button look.
    - `ChannelHeaderMenu.tsx:42,73`: add arrow/Home/End handling modelled on `patterns/RowMenu.tsx`, and focus the first item on open. Item activation skips `e.repeat`.
  - **C10**:
    - `MessageHoverBar.tsx:43-46`: keep a ref to the ⋯ button and focus it after Esc or after an item runs (guard with `isConnected`).
    - `useMessageActions.tsx:106`: when details open, store `document.activeElement`. On close, restore focus to it if it is still connected.
  - **C11** Roving tabindex in `MessageHoverBar`. Only the row's focus target has `tabIndex=0`, and the bar's buttons are `-1`. Arrow keys move between them, and Esc returns to the row.
  - **C12** Measure on open. If the row's bottom plus the menu height is past the scroll container's bottom, set `data-placement="up"`, and add a CSS rule `bottom: calc(100% + 6px)`.
  - **C8** `NodeActionMenus.tsx:566-571`: `ChannelOptions` takes the already-filtered `slots` from `:161` instead of filtering again.
  - **C17 / M7e** Replace the inline colour hashes with `avatarToken(...)` in `DmHeader.tsx:37`, `NodePeek.tsx:42`, `MapNodeList.tsx:73` and `nodeColumns.tsx:48`. `MeshCoreNodesTable.tsx:81` hashes a public key on purpose and stays.
- [ ] **Step 4: Run `npx vitest run src/workspace/chat src/workspace/map src/workspace/nodes src/workspace/patterns`.** All pass.
- [ ] **Step 5: Run `npm run test:workspace-e2e -- -g "10-0"`.** All pass.
- [ ] **Step 6: Commit.**

### Task W4: Unread, DMs, search, activity

**Size:** ~90 lines · **Risk:** Low–Medium · **Files:** `shell/useWorkspaceSources.ts`, `shell/shellUnread.ts`, `node-page/dialogs/PurgeDataSheet.tsx`, `chat/SearchMessages.tsx`, `activity/useActivity.ts`, `activity/ActivityFeed.module.css`, tests under `shell/`, `chat/`, `activity/`.

- [ ] **Step 1: Write failing tests**
  - "with Show MQTT off, a source whose only unread is MQTT shows no rail or sidebar badge". The fixture routes on `excludeMqtt=true`.
  - "Purge All Messages refetches the poll" (expect a second `GET /api/poll`).
  - "phone search is not aria-modal and the tab bar is reachable by Tab".
  - "search result with no local node id reads 'DM' with the sender, not 'DM with '" (extend 10-15 at `:125`).
  - "search with no poll at all does not navigate a DM".
  - "an unseen activity row's accessible name contains Unread".
  - "activity refresh after Load more refetches only the first page" (count `GET /api/activity` calls).
  - "phone Mark all read failure shows the error" (c-home-e4).
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **C5** Pass `excludeMqtt: !showMqttMessages` (from `useUI()`) to `useUnreadCounts` at `useWorkspaceSources.ts:65`, and make the key in `shellUnread.ts:12` match: `!showMqttMessages` in place of `false`. Callers of `useOpenDeviceUnread` pass the flag. Both sides keep one polling observer.
  - **C7c** `PurgeDataSheet.tsx`, after the messages purge at `:86`: `void refetchPoll()`, using the poll from `useChatRuntime`'s source, or `queryClient.invalidateQueries({ queryKey: ['poll', …] })`. This must not mount a new `usePoll`.
  - **C14** `SearchMessages.tsx:129`: on phone, render `role="region"` with no `aria-modal` and no `useDialogA11y` trap. Desktop is unchanged.
  - **C19** `SearchMessages.tsx:92-97`: when `peerOf` returns `''`, show the DMs scope label (an existing key) instead of `DM with `.
  - **C16**:
    - `useActivity.ts:80`: before refetching, trim the infinite query to its first page with `queryClient.setQueryData(key, d => ({ pages: d.pages.slice(0,1), pageParams: d.pageParams.slice(0,1) }))`.
    - `ActivityFeed.module.css:16`: move the `-10px` hit area to a `::before` pseudo-element on `.device`.
    - First-visit seeding is a question (Q8), not done here.
- [ ] **Step 4: Run `npx vitest run src/workspace/shell src/workspace/chat src/workspace/activity src/workspace/node-page`.** All pass.
- [ ] **Step 5: Commit.**

### Task W5: Map and node page

**Size:** ~70 lines · **Risk:** Low · **Files:** `map/DeviceMap.tsx`, `map/deviceLayerGroups.tsx`, `map/MapContextMenu.tsx`, `patterns/NodeActionMenus.tsx`, `patterns/NodeActionMenus.module.css`, `map/NodePeek.module.css`, `node-page/NodeHeader.tsx`, `node-page/Neighbours.tsx`, `tests/workspace-e2e/boards.ts`, tests under `map/__tests__/`.

**Interfaces:**
- Produces: `neighborInfoKey(sourceId: string | null)`, exported from `node-page/Neighbours.tsx` and used by `DeviceMap.tsx:163`.

- [ ] **Step 1: Write failing tests**
  - "f2-layers: each layer checkbox's label matches the setter it flips". Keep a `{ showX: label }` map.
  - "phone focus request is dropped when the map errors". Render with BaseMap throwing, and expect `onFocusHandled` to be called.
  - "centre-on-map works after switching to 3D".
  - "peek tiles have aria-haspopup=dialog".
  - "NodeHeader: a node with no user id has no Message action".
  - "Measure from here twice at the same spot restarts the measurement".
  - "Measure disabled shows the needs-two-nodes hint".
  - "waypoint expiry under 10 min: Create is disabled". This replaces the vacuous validate() check in `15-07-waypoint-editor.test.tsx:81-88`.
  - "double-click on the map opens the editor menu" (the dblclick path).
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **M3b** `DeviceMap.tsx:343`: `useMemo(() => new Set(data.visibleMapNodes), [data.visibleMapNodes])`.
  - **M3c** `deviceLayerGroups.tsx:90`: use `logger.error`. The `:104` string moves in W13.
  - **M4a** `boards.ts:591`: replace `waitForTimeout(2500)` with a `page.waitForFunction` that resolves after the map's `moveend` and once no tile is loading.
  - **M5** `NodeActionMenus.tsx:481`: the `buttons` variant gets `aria-haspopup="dialog"` and its own `.tileButton` class. Move the rules from `NodePeek.module.css:221-251` into `NodeActionMenus.module.css`.
  - **M6a/b** `DeviceMap.tsx:256-262`: when BaseMap reports an error (its `onError`, or the boundary's fallback render), call `onFocusHandled()`. Add `effective3D` to the deps.
  - **M8a** `NodeHeader.tsx:88`: add `!!node.user?.id &&` to `canMessage`.
  - **M8b** One exported `neighborInfoKey`, used at `Neighbours.tsx:39` and `DeviceMap.tsx:163`.
  - **M10d** `DeviceMap.tsx:222-224`: keep a `measureNonce` that increments on each "Measure from here", and pass it as the controller's `key`.
  - **M10e** `MapContextMenu.tsx:120`: when `measureDisabled`, use the hint key added in W13.
- [ ] **Step 4: Run `npx vitest run src/workspace/map src/workspace/node-page src/workspace/patterns`.** All pass.
- [ ] **Step 5: Run `npm run test:workspace-e2e -- -g "15-"`.** All pass.
- [ ] **Step 6: Commit.**

### Task W6: Nodes list and table

**Size:** ~25 lines · **Risk:** Low · **Files:** `nodes/ColumnPicker.tsx`, `nodes/NodesTable.tsx`, `nodes/NodesTable.module.css`, `nodes/NodeFiltersSheet.tsx`, `nodes/NodesPage.tsx`, `map/DeviceMap.tsx:477`, `nodes/__tests__/rowLayout.ts`.

- [ ] **Step 1: Write failing tests**
  - "Alt+ArrowUp on a hidden column does nothing and its grip is disabled".
  - "role 0 shows no role on the desktop table" (matches the phone list).
  - "filters sheet opened from the map has no 'More filters opens the same panel' note".
  - "Online count updates when a poll returns the same nodes later". Advance the fake clock past the online window, trigger a refetch with identical data, and expect the count to drop.
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **M7d** `ColumnPicker.tsx:41-50`: disable the grip and ignore Alt+Arrow when the row is unchecked.
  - **M7f** `NodesTable.tsx:85`: apply the same `!== '0'` check as `NodesList.tsx:46`.
  - **M7g** `NodeFiltersSheet` gets a `fromMap?: boolean` prop, set at `DeviceMap.tsx:477`, that hides `filters_note`.
  - **M7h** `NodesPage.tsx:151`: depend on the nodes query's `dataUpdatedAt` as well as `nodes`, so each poll recomputes "now". No timer.
  - **M7i** `rowLayout.ts:13`: restore only the spies it creates (`spy.mockRestore()`) instead of `vi.restoreAllMocks`.
  - **M7j** `NodesTable.module.css:339`: `.table tr:not([aria-hidden]):hover td`.
- [ ] **Step 4: Run `npx vitest run src/workspace/nodes src/workspace/map`.** All pass.
- [ ] **Step 5: Commit.**

### Task W7: Overview map and phone tools

**Size:** ~100 lines · **Risk:** Low–Medium (M13d changes how the tool radios behave) · **Files:** `overview/OverviewMap.tsx`, `overview/analysis/overviewLayerGroups.tsx`, `overview/analysis/OverviewOverlays.tsx`, `overview/analysis/MapToolsMenu.tsx`, `overview/analysis/PhoneMapBar.tsx`, `overview/analysis/PhoneToolsSheet.tsx`, `overview/analysis/PhoneToolsSheet.module.css`, `overview/analysis/ToolItems.tsx`, tests under `overview/__tests__/` (`OverviewMap.test.tsx`, `overviewLanding.test.tsx`, `analysisCoverage.test.tsx`, `renderOverview.tsx`, `overviewDashboardRules.test.tsx`, `5-01-overview-analysis.test.tsx`).

- [ ] **Step 1: Write and tighten tests**
  - Replace the 50 ms sleep at `OverviewMap.test.tsx:84` with `waitFor` on the landing hook's settled state.
  - `overviewLanding.test.tsx:46-53`: after the setting loads, assert the URL is unchanged across two `waitFor` ticks.
  - "/ with `state.showList` does not run the landing redirect".
  - Delete the dead `findByRole(...).catch` at `analysisCoverage.test.tsx:107`, and the unused `inDrawer`/`passthrough` at `renderOverview.tsx:68,94`.
  - `analysisCoverage.test.tsx`: `has()` at `:224-236` matches an exact accessible name by role, and the phone matcher at `:286` drops `exact:false`.
  - Zoom-to-fit test (`overviewDashboardRules.test.tsx:98-103`): assert `fitBounds` was called.
  - "Colour nodes by: ArrowDown moves the checked radio".
  - "Map tools radio: a second click keeps it on; arrows move".
  - "Time opens the tools sheet focused on the Time section".
  - 5-01: "Role badges toggle shows/hides the badges" (the second state).
  - "packet-flight anchors ignore nodes not on the map".
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **M11c** `OverviewMap.tsx:186`: `skip: !landing || !!state?.showList`.
  - **M12g** `OverviewOverlays.tsx:115-124`: build anchors from the marker nodes OverviewMap passes, not `analysisNodes`.
  - **M12j / M13d** Roving tabindex with arrow keys on the `overviewLayerGroups.tsx:164-176` radiogroup and on `MapToolsMenu.tsx:48-56`. A radio only activates its tool; clicking the active one does not toggle it off.
  - **M13b** `ToolItems` accepts `className`. Replace `PhoneToolsSheet.module.css:9`'s `.tools > button` with that class. PhoneToolsSheet and PhoneMapBar import only the rules they use from `LayersDrawer.module.css`, through `composes:`.
  - **M13c** `OverviewMap.tsx:308-312`: find filters by id, not by index.
  - **M13e** `PhoneMapBar.tsx:44`: drop `aria-pressed`, keep `aria-haspopup`, and put the state in the label.
  - **M13f** `PhoneToolsSheet` takes `initialSection?: 'time'`, and Time passes it. The sheet focuses that section's heading.
- [ ] **Step 4: Run `npx vitest run src/workspace/overview`.** All pass.
- [ ] **Step 5: Run `npm run test:workspace-e2e -- -g "5-0"`.** All pass.
- [ ] **Step 6: Commit.**

### Task W8: Overview messages and packets

**Size:** ~130 lines · **Risk:** Medium (O4b memoisation, O5c data source, O5d provider order) · **Files:** `overview/OverviewMessages.tsx`, `overview/OverviewMessages.module.css`, `overview/ReceptionsPanel.module.css`, `overview/OverviewPackets.tsx`, `overview/PacketStream.tsx`, `overview/PacketDetailPanel.tsx` (RelayModal), `tools/PacketsPopout.tsx`, `tools/PacketFilters.tsx`, `tools/PacketFilters.module.css` (new), `tools/SecurityPage.tsx`, tests under `overview/__tests__/` and `tools/__tests__/`.

- [ ] **Step 1: Write failing tests**
  - "a MeshCore reaction from an unreadable source adds no chip".
  - "a poll with unchanged messages re-renders no message row". Use a render-count spy on the memoised row.
  - "no empty-state text while the device list is loading". Delay the sources fixture.
  - "re-pins to bottom on new message only when already at bottom". Stub `scrollTop`/`scrollHeight`, then cover both cases.
  - "chart bars use the hook's per-series colour".
  - "Dir cell has the direction title".
  - "opening RelayModal makes no /api/poll request".
  - "MeshCore pop-out fetches auth status once".
  - "16-05 security toggles use the kit switch class".
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **O4a** `OverviewMessages.tsx:222`: regroup the MeshCore chips with `groupUnifiedMeshCoreReactions` over the readable messages, inside a `useMemo`.
  - **O4b** Extract a memoised `FeedRow` that takes plain props (row, flags, counts) and builds `headExtra` and `footer` inside itself.
  - **O4c** `ReceptionsPanel.module.css`: wrap the table in `overflow-x: auto`. Check board 7-01 at 1280 px.
  - **O4d** `OverviewMessages.module.css:372-375`: change the channel select to `flex: 1 1 auto`. Check the phone board.
  - **O4e** Hold the empty state until `useShellDevices` has loaded.
  - **O4g** Merge the duplicate `.chips .button` rules (`:378-384`).
  - **O5a** `OverviewPackets.tsx:169-180`: the bar's background is the hook's `color`, which is a theme token.
  - **O5c** RelayModal reads node names from a non-polling nodes query scoped to `packet.sourceId`, or from the cache with `skipToken`, instead of `useNodes()`. The test proves no `/api/poll`.
  - **O5d** `PacketsPopout.tsx:212-240`: pick MeshCore or Meshtastic before mounting the Workspace providers, so Classic `PacketMonitorPage` brings its own and nothing is nested twice.
  - **O5e** `PacketStream.tsx:48-50`: `title={t(direction_tx|rx)}`, reusing Classic's keys.
  - **O9b** `SecurityPage.tsx:563,583`: use `RowSwitch` (or `className={kit.switch}`).
  - **O9c** Move the rules `PacketFilters.tsx:12` takes from `PacketsPopout.module.css` into `PacketFilters.module.css`.
- [ ] **Step 4: Run `npx vitest run src/workspace/overview src/workspace/tools`.** All pass.
- [ ] **Step 5: Run `npm run test:workspace-e2e -- -g "7-0|16-05|18-0"`.** All pass.
- [ ] **Step 6: Commit.**

### Task W9: Reports, Users, Dashboard tiles

**Size:** ~100 lines · **Risk:** Medium (O7 changes the numbers on tiles) · **Files:** `reports/MeshIssuesPage.tsx`, `reports/CoveragePage.tsx`, `reports/reportParts.module.css`, `reports/__tests__/6-07-nodeinfo-enrichment.test.tsx`, `reports/__tests__/reportsRoutes.test.tsx`, `reports/__tests__/6-03-coverage.test.tsx`, `overview/UsersPage.tsx`, `overview/usePermissionMatrix.ts`, `dashboard/DeviceDashboard.tsx`, `__fixtures__/reports.ts`.

- [ ] **Step 1: Write failing tests**
  - "Mesh issues: changing a filter keeps the Source chips while /summary reloads".
  - "/overview/reports?report=coverage opens Coverage".
  - "Dismiss all opens today's confirm and posts nothing before Confirm".
  - Back-link href per prefix for every 4.5 page (`reportsRoutes.test.tsx` route table).
  - 6-07: add a `src-g2` copy candidate to the fixture, and assert `fromSourceId: 'src-g2'` and the preselected fields (`longName, shortName, hwModel`).
  - Dashboard: "MeshCore Direct tile counts pathLen 0 and skips ignored/aged nodes, matching the table" and "traceroute hop mode: Direct tile matches the Nodes view".
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **O1b** `MeshIssuesPage.tsx:51`: keep the last non-empty `sourceNames` in a `useRef`.
  - **O2c** Open boards 6-02 and 6-03. If either draws a description line under the title, render the matching description key (`analysis.mesh_issues.description` / `analysis.coverage.description`). If not, make no change and record a ruling.
  - **O3b** `reportParts.module.css:192-196`: scope with `:where(.targets) > button, :where(.targets) > label`, so the Classic `display:none` wins.
  - **O6b/c** Export one `forbidden` helper from `usePermissionMatrix.ts`, used at `UsersPage.tsx:37`. Add one `blankChannelDbPermission(id)` helper for `:147,:150`.
  - **O7** `DeviceDashboard.tsx:~166-175`:
    - MeshCore tiles use `pathLen === 0` and apply the age window and the ignore list the table uses (`useNodeQuickAgeFilter`, `useMeshCoreIgnoredNodes`; read those passively if the table already owns them).
    - Meshtastic reads traceroutes only when the hop mode is traceroute, passively (`skipToken` on the key NodesPage uses), so it adds no polling observer. With no cached data, the tile keeps today's count; record a ruling.
- [ ] **Step 4: Run `npx vitest run src/workspace/reports src/workspace/overview src/workspace/dashboard`.** All pass.
- [ ] **Step 5: Commit.**

### Task W10: Settings, devices, Server pages

**Size:** ~110 lines · **Risk:** Medium (S16 shows managers to readers; S20 changes connect-wait semantics) · **Files:** `settings/categories/DangerCategory.tsx`, `settings/categories/AdvancedCard.tsx`, `settings/CategoryPage.tsx`, `settings/SettingsList.tsx`, `settings/SettingsList.module.css`, `settings/SettingsSearch.module.css`, `settings/__tests__/settingsFrame.test.tsx`, `settings/__tests__/b-set-d4-search.test.tsx`, `server/MapTilesPage.tsx`, `server/__tests__/13-10-background-jobs.test.tsx`, `devices/Devices.module.css`, `devices/deviceInfo.ts`, `devices/useSourceForm.ts`.

- [ ] **Step 1: Write failing tests**
  - settingsFrame "loads once": await a `waitFor` per category hop (`:85-86`).
  - "DangerCategory adds no polling observer". With the shell poll stubbed, mount Danger and count `GET /api/poll`.
  - "Advanced card outside a category writes no pref".
  - "hidden-modules list has an accessible name".
  - "phone settings list page has a main landmark".
  - "settings search query clears after navigating away".
  - Map & tiles: "a settings:read viewer sees the tileset and GeoJSON lists, with every edit control disabled".
  - "the {z}/{x}/{y} error is linked to the URL field by aria-describedby".
  - useSourceForm: "a joiner still resolves when the starter aborts".
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **S12**:
    - `DangerCategory.tsx:79`: read the poll passively (`skipToken` on the shell's poll key) instead of `usePoll()`.
    - `AdvancedCard.tsx:21`: skip the pref write when `categoryId` is empty.
    - `CategoryPage.tsx:299`: `aria-label` on the `<ul>`, reusing its visible heading key.
    - `SettingsList.tsx:215`: render the phone page variant as `<main>`.
  - **S13**:
    - Fix the misleading comment at `b-set-d4-search.test.tsx:124`.
    - `SettingsList.tsx:142`: clear the query on location change.
    - `SettingsSearch.module.css:11`: `font: inherit`.
    - `SettingsList.module.css:119`: `text-overflow: ellipsis` on the input, plus an `aria-label` with the full text.
  - **S16** `MapTilesPage.tsx:57`: `gate="read"`. Writes stay behind the existing write check through `useReadOnly`, as the Privacy rows do (L6). No new write path.
  - **S17 (form part)** `MapTilesPage.tsx:196`: render the z/x/y error inside the URL `Field` and link it with `aria-describedby`.
  - **S18** Reword the `13-10-background-jobs.test.tsx:4-8` header to match what the tests assert.
  - **S19 (small parts)**:
    - `Devices.module.css:434-437` `.pair`: `grid-template-columns: 1fr 120px` (board h2).
    - `deviceInfo.ts:42`: type the config instead of `any`, and drop the eslint-disable.
    - Then run `npm run lint:ci` and, if a count fell, `node scripts/lint-ratchet.mjs --update --rule @typescript-eslint/no-explicit-any`.
  - **S20** `useSourceForm.ts:541-543`: the shared wait loop takes no caller signal (it already ends at 20 s). Each caller races the shared promise against its own `signal`.
- [ ] **Step 4: Run `npx vitest run src/workspace/settings src/workspace/server src/workspace/devices`.** All pass.
- [ ] **Step 5: Commit.**

### Task W11: MeshCore and Reticulum

**Size:** ~80 lines · **Risk:** Medium (R1d and R5b change the component tree) · **Files:** `source/WorkspaceSource.tsx`, `settings/SettingsFrame.tsx:81`, `settings/SettingsList.module.css:382`, `meshcore/remote/RepeaterSettingsCategory.tsx`, `settings/kit/kit.module.css`, `meshcore/RegionFeedPage.tsx`, `meshcore/MeshCoreNodesTable.tsx`, `meshcore/McTools.module.css`, `reticulum/` (ReticulumScreen and ReticulumSettingsFrame), `routes.ts:105-106`, `meshcore/__tests__/meshcoreSettingsPages.test.tsx`.

- [ ] **Step 1: Write failing tests**
  - "MeshCore: node page → Settings makes one status/snapshot read, not two" (request count).
  - "Reticulum: settings → back makes no immediate re-read".
  - "Observer: type a broker password, Cancel, open again, and the field is empty".
  - "region feed Nodes tab count equals the header count with an old node present".
  - "region feed passes typed no-op actions". This is a tsc-level change, so the existing 8-15 tests must stay green with the cast removed.
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **R1d** In `WorkspaceSource`'s MeshCore settings branch, render `<MeshCoreScreen key={sourceId} screen={{ kind: 'settings', path }} />` at the same tree position as the screens branch, so `useMeshCore` is not remounted.
  - **R5b** Give `ReticulumScreen` a `settings` kind that renders `ReticulumSettingsFrame` inside the same runtime.
  - **R1a** `SettingsList.module.css:382`: `.sessionLabel` gets `min-width: 0`, and its status gets `text-overflow: ellipsis`. Check board 8-06 at 1280 px.
  - **R1b** Let the row help in the kit wrap (`white-space: normal`). Check board 8-07.
  - **R4a** `RegionFeedPage.tsx` FeedNodes (~`:393-404`): replace `as unknown as UseMeshCoreState` with a typed `READ_ONLY_ACTIONS` const of no-op functions that satisfies the actions type.
  - **R4b** `MeshCoreNodesTable.tsx:135-142`: skip `filterMeshCoreRowsByAge` when `feed`.
  - **R4c** Give the observers table wrapper `overflow-x: auto`. Check board 8-15 at 1280 px.
  - **R5c** Delete the double blank line at `routes.ts:105-106`.
- [ ] **Step 4: Run `npx vitest run src/workspace/meshcore src/workspace/reticulum src/workspace/source src/workspace/settings`.** All pass.
- [ ] **Step 5: Run `npm run test:workspace-e2e -- -g "8-0|8-1|9-0"`.** All pass.
- [ ] **Step 6: Commit.**

### Task W12: Automations

**Size:** ~60 lines (strings move in W13) · **Risk:** Low–Medium (O8d) · **Files:** `automations/rules.ts`, `automations/RulePage.tsx`, `automations/TemplateWizard.tsx`, `automations/__tests__/m2-rule.test.tsx`.

- [ ] **Step 1: Write failing tests**
  - "Run now with a step that names no source shows `run.no_source`".
  - "reopening a rule re-reads its runs".
  - "JSON mode offers Reset homes from history when the trigger supports it".
  - "TemplateWizard without automations:read shows the denied view and fetches nothing".
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **O8c** `rules.ts:26`: `staleTime: 0` (Classic re-reads on each open). No interval.
  - **O8d** `RulePage.tsx:331`: drop the `mode === 'steps'` condition. In JSON mode, read the trigger from the parsed JSON, and hide the option when the JSON doesn't parse.
  - **O8e** `TemplateWizard.tsx:84-86`: gate on `automations:read` with the shared denied view the rules list uses.
- [ ] **Step 4: Run `npx vitest run src/workspace/automations`.** All pass.
- [ ] **Step 5: Commit.**

### Task W13: i18n strings, test hygiene, docs

**Size:** ~90 lines · **Risk:** Low · **Files:** `public/locales/en.json`, `automations/RuleTest.tsx`, `automations/VariablesPage.tsx`, `map/deviceLayerGroups.tsx`, `map/MapContextMenu.tsx`, `overview/analysis/TimeControl.tsx`, `overview/analysis/PhoneToolsSheet.tsx`, `overview/OverviewMap.tsx`, `__fixtures__/board-checks/15-25-request-telemetry.json`, the tests named below, `docs/superpowers/workspace-final-report.md:61`.

- [ ] **Step 1: Write failing tests**
  - "Apply as Light shows the applied theme in the Light Theme row" (13-01: `getByLabelText('Light Theme')` display value).
  - "a failed pin save shows the settings_save_failed toast" (500 fixture).
  - "SettingValue: `1` vs `1.0` is not marked changed" (`data-changed`).
- [ ] **Step 2: Run, and see the new tests fail or pass.** These cover fixes that already landed in 97fd3b9, so they may pass at once. In that case, break the fix by hand to see each one fail, then restore it.
- [ ] **Step 3: Implement**
  - **O8a** Move the ~25 RuleTest field labels and fallbacks (`RuleTest.tsx:32-56,85,96`) and `VariablesPage.tsx:73` 'Create failed' to `workspace.automations.test.*` / `workspace.automations.var.create_failed`. Where Classic has an `automations.*` key with the same words, reuse it.
  - **M3c** `deviceLayerGroups.tsx:104` "Not available in 3D": reuse an existing `map.*` key if there is one, or add `workspace.map.not_in_3d`.
  - **M12f** "Time Slider" (`TimeControl.tsx:16`, `PhoneToolsSheet.tsx:42`): `t('map.timeSlider')` if that key exists. If not, add `workspace.overview.time_slider`.
  - **M12i** Zoom-to-fit title and aria-label (`OverviewMap.tsx:254-255`): reuse Classic's key.
  - **M10e** Add `workspace.map.measure_needs_nodes` for W5.
  - **R8** Set `"source": "written"` in `15-25-request-telemetry.json`, so `scripts/workspace/port-board-checks.mjs` won't restore "Request" from the git-excluded `s15.json`.
  - **tsconfig.tests** Fix the 19 Workspace test type errors that are not jest-dom matcher typings:
    - `automations/__tests__/fixRound1.test.tsx:75,122` and `fixRound2.test.tsx:71,99` (screen argument type)
    - `automations/__tests__/routes.test.ts:18` (Translate)
    - `overview/__tests__/usersMatrixRequests.test.tsx:63,81,89,96,101` (`Promise<boolean>` mocks)
    - `reports/__tests__/6-03-coverage.test.tsx:54`, `meshIssuesPhone.test.tsx:55` (mock.calls tuple)
    - `server/__tests__/13-05-map-tiles.test.tsx:29`
    - `settings/__tests__/radioSaveQueue.test.tsx:19,162`
    - `you/__tests__/s1-you.test.tsx:95,105`
    
    The 2,476 jest-dom `TS2339` errors come from repo-wide config and are not touched.
  - **O12** `workspace-final-report.md:61`: the Firmware page is restyled (`settings/categories/FirmwareCategory.tsx`, boards 12-09/12-19). Correct the line.
- [ ] **Step 4: Run the checks.**
  - `npx vitest run src/workspace`: all pass.
  - `npx tsc -p tsconfig.tests.json --noEmit 2>&1 | grep '^src/workspace' | grep -v TS2339`: empty.
  - The i18n coverage test passes.
- [ ] **Step 5: Commit.**

### Task W14: Approved decisions D1–D3

**Size:** ~12 lines · **Risk:** Low · **Files:** `shell/PhoneShell.module.css`, `map/deviceLayerGroups.tsx`, `map/DeviceMap.tsx`, `node-page/dialogs/MergeIdentitySheet.tsx`, `node-page/dialogs/MergeIdentitySheet.module.css`, tests under `map/__tests__/` and `node-page/__tests__/`.

- [ ] **Step 1: Write failing tests**
  - "phone Layers sheet has no Packet monitor toggle" (D2). The desktop Layers drawer still has it.
  - "merge no-undo line uses the danger icon class" (D3).
- [ ] **Step 2: Run, and see the new tests fail.**
- [ ] **Step 3: Implement**
  - **D1** `shell/PhoneShell.module.css:39-53,100`: add `.header[data-device] .switch:focus-visible .square { outline: 2px solid var(--color-accent); outline-offset: 3px }`, so the ring wraps the 44 px square and not only the 24 px name row. CSS only; check it on the phone shell board.
  - **D2** `map/deviceLayerGroups.tsx:37`: add `isPhone: boolean` to `DeviceLayerParams`, and pass it from `map/DeviceMap.tsx:193` (`useIsPhone()`). Gate the packet-monitor toggle (`:315`) and the returned `showPacketMonitor` (`:329`) with `!p.isPhone`.
  - **D3** `node-page/dialogs/MergeIdentitySheet.tsx:26-30,117`: `warning()` takes `{ danger?: boolean }`. The no-undo call passes `danger: true`, which uses a new `.dangerIcon { color: var(--color-danger) }` in the module instead of `.warningIcon`. This matches Classic `NodeIdentityMergeDialog.module.css:188-202`.
- [ ] **Step 4: Run `npx vitest run src/workspace/map src/workspace/node-page src/workspace/shell`.** All pass.
- [ ] **Step 5: Commit.**

---

## Decision tasks

**Decided 2026-11-24:** the requester took every recommendation. D1–D3 are done in Task W14. D4–D7 are not done; each gets a ruling (JM–JP). Q1–Q7 are skipped.

The recommendation is in brackets.

- **D1. Phone switcher focus ring** (S27) [do]. `shell/PhoneShell.module.css:39-53,100`: `.header[data-device] .switch:focus-visible .square { outline: 2px solid var(--color-accent); outline-offset: 3px }`. Test: the CSS rule exists, plus a board check (phone shell). About 4 lines, Low.
- **D2. Packet monitor toggle hidden on phone** (M14) [do]. `deviceLayerGroups.tsx:37` adds `isPhone` to `DeviceLayerParams`, and `DeviceMap.tsx:193` passes it. Gate `:315` and `:329` with `!p.isPhone`. Test: "phone Layers sheet has no Packet monitor". About 4 lines, Low.
- **D3. Merge no-undo block in danger colour** (M15) [do]. `node-page/dialogs/MergeIdentitySheet.tsx:26-30,117`: `warning(…, { danger: true })` uses a new `.dangerIcon { color: var(--color-danger) }`. Matches Classic. Test: the class is present. About 3 lines, Low.
- **D4. Reticulum rate history charts every interface** (R5a) [don't; record a ruling]. Today it charts only Dashboard favourites, as Classic's Dashboard does. Charting all of them adds one 24 h telemetry read per interface every 30 s. It's a 2-line change (`InterfacesPage.tsx:185,212`) if you want board 9-03 exactly.
- **D5. AclManager Enter-to-apply** (R2, Ruling JI) [don't; JI stands]. The option: wrap the fields in a `<form>` whose submit, and the Apply button, open a `ConfirmSheet submitOnEnter={false}` with a SendsLine. Only Confirm sends `setperm`. That adds a confirm Classic doesn't have (Classic's `MeshCoreAclManager.tsx:76` sends on Enter with no confirm). About 15 lines, Medium. Mesh impact: one `setperm` per confirm, the same as today; no new sends.
- **D6. Ruling BI, `workspace.*` in i18n coverage** (S26) [keep the exclusion while Workspace is opt-in]. Removing it is a 3-line edit to `src/config/i18nLanguageCoverage.test.ts:46,73-74`, a non-Workspace test. Coverage would then drop: es 92→74, pl 93→74, fr 52→42, zh_Hans 52→41, zh_Hant 59→47, ru 49→39, id 71→57. `KNOWN_PARTIAL` would have to grow to `de,fr,ru,zh_Hans,zh_Hant`. Runtime is unaffected (`fallbackLng: 'en'`).
- **D7. Leave guard on browser Back** (S25) [don't now]. With `BrowserRouter`, `useBlocker` isn't available. A Workspace-only guard would push a sentinel history entry and catch `popstate` in the capture phase before react-router's listener. About 50 lines in `settings/LeaveGuard.tsx`, Medium–High risk (history-stack edge cases, and it depends on listener order). Revisit if the app moves to a data router (the LeaveGuard comment already says so).

## Questions for the requester (not in the main plan)

**Decided 2026-11-24: all skipped.**

These need a Classic change or are new features:

- **Q1. Settings sidebar change dots** (DR, b2). This is a new feature. The dirty state is `RadioSaveQueue.queue[].categoryId` (`useRadioSaveQueue.ts:40-47`), provided in `SettingsFrame.tsx:225`. The desktop sidebar (`shell/DeviceSidebar.tsx:96`) is outside that provider, so the queue's category ids would have to be lifted into a small per-source store. About 35 lines, Medium. All in Workspace code, but new.
- **Q2. Shared-hook fixes** (Classic `src/hooks/`):
  - C1: MeshCore neighbour-info silently returns on a bad id (`useMeshtasticNodeActions.ts:283-289`; add a toast).
  - C7a: `purgeNodeData` resolves on failure, so the sheet carries on to the delete (`:688-717`).
  - C7b: inline purge requests duplicate `App.tsx`/`useSourceView.ts`.
  - C18: `scanForAdmin`/`markAircraft` copies of Classic's transmitting paths (MessagesTab, AircraftMarkMenuItems).
- **Q3. New tests in Classic test files**: C2 (`useMeshtasticMessageActions.test.ts`: replyId DM, rollback, error paths), S11 (`useDeviceConfigSaves.test.ts`: fixedPosition true, privateKey), and R10 (`useSourceView.test.ts:87-92` theme keys). These add tests only, with no behaviour change, but they edit Classic test files.
- **Q4. Classic extractions**:
  - S2: duplicate Settings/Toast providers in re-hosted `pages/*`.
  - C13: SearchFilters shared with SearchModal.
  - M7b: ExportMenuButton `className`, so `:global` can go.
  - M9: NodeIdentityChangeNotice `onMerge`.
  - M12a/c/d: MapAnalysis pin authoring, refit and nodeOptions.
  - M13g/h: inspector close at 44 px, LinkProfileDrawer `:global`.
  - O3c/O3d: class hooks on Classic report filters, and a duplicate doc block.
  - O5b: shared packet option lists and helpers.
  - O8b: RuleTest field specs shared with AutomationTester.
  - S19: horizontal kebab icon in `UiIcon`.
- **Q5. MeshCore console History loads on open** (R1c). The fix moves desktop History into a collapsed `<details>`, which changes the 8-06 board layout. Is that a visual call you want made?
- **Q6. ConfirmSheet covers the danger-zone buttons at 1280 px** (R3a). The fix is in the shared `Sheet` pattern (width or backdrop), which affects every right-side sheet.
- **Q7. Activity first-visit badge** (C16). With no saved "seen" time, every loaded item counts as unseen (up to 50). Should the first view seed the pref (one PUT), so the badge counts only new activity?

## Skips (recommended, with reasons)

- **Pure size and structure refactors with no user effect:**
  - C3 ChannelThread split
  - C17 shared thread-helpers hook (W3 still does the colour copies)
  - M3d DeviceMap split
  - M7a NodesTable CSS split
  - M8c NodeHeader CSS size
  - M10c useMapEditing returning JSX
  - O6d UsersPage/AuditPage size
  - S4 `.srOnly` consolidation across 15 modules
  - S19 Devices CSS split, primitives move, Passive Mode in two steps
  - O4f ExportForm copy (also Classic)
  - O9a PacketTable `cell()` dedupe (−40 lines, Medium risk, and it touches four boards)
  
  Each would be churn with regression risk and nothing a user sees.
- **R6 / HR (undrawn MeshCore pages keep Classic sections):** no boards exist, so this is design work, not a fix.
- **M12l** Overview transports separate from MapContext: by design (Map Analysis state).
- **M10a** GeofenceRow prefix strip: needs a Classic summary helper, for a cosmetic gain.
- **M4b** `dispatchEvent` clicks: already commented as necessary (the link is off-viewport).
- **O4h** row opens the panel by mouse only: the "Heard by N" button is the keyboard path.
- **O6a** hand-written q4/o4 checks: accepted (`"source": "written"`).
- **R1e** 7.3 "M7": never described anywhere, so there is nothing to act on.
- **M3a** stale DeviceMapLayers comments: a Classic file, and the comments read as current.

## Already fixed (dropped from the plan)

| Item | Evidence |
|---|---|
| C4 MessageRowD memo | `MessageRowD.tsx:308` `messageRowPropsEqual`; stable `tapbacksFor` (`messageRowSupport.ts:117-120`) |
| M1 AJ state cleared | `map/__tests__/centerOnMap.test.tsx:84-88` |
| M7c column save failure | `nodes/nodeColumns.tsx:141-144` toasts |
| M8d SignalTrendBadge fallback | `node-page/OverviewTab.tsx:80` matches Classic `NodeDetailsBlock.tsx:90-91` |
| M11b SidebarMode 'overview' | still used, `WorkspaceShell.tsx:268,289`, `PhoneShell.tsx:113` |
| O1a "Show 0 issues" | `reports/MeshIssuesPage.tsx:180-183` |
| O10 CHANNEL_DB_OFFSET comment | `src/utils/channelReadAccess.ts:16` |
| O12 / ER Firmware not restyled | `settings/categories/FirmwareCategory.tsx` on the kit, boards 12-09/12-19; only the report line is stale (W13) |
| S12 purge busy untested | `settings/__tests__/12-10-danger.test.tsx:105-121` |
| S14 Danger-zone Reboot wait | `settings/categories/DangerCategory.tsx:269` → `SettingsFrame.tsx:250` RebootWait |
| R8 15-25 "Request" | removed in a8d5f6d (W13 only stops a regeneration undoing it) |
| R9 `prefFields.test.tsx` tsc errors | jest-dom matcher typings missing from `tsconfig.tests.json`, repo-wide (7,089 errors; 2,476 of the 2,495 in Workspace files are this `TS2339`). Nothing specific to that file. |
| O3a 6-07 donor | not a bug: `useCopyNodeInfo.ts:126-129` falls back to the first candidate because the fixture has no G2 candidate (W9 fixes the fixture) |

## Out of scope

- **b1 (Classic/server), excluded:**
  - r3 banner on 5 pages, Classic DM Mark All Read sourceId, SearchModal DM label, ApiService 403 double read, Classic relay estimate, BK waypoint resend, CM Fix All pacing, DA `remote_admin` grants.
  - GI-b URL import sourceId, GI-c positionPrecision, `/api/solar/trigger` auth, analysis cooldowns, h5/i4 connection history, 6.6 unbuilt fields, server timer re-arms, Classic export-all, 8.3 per-source saves, Auto Welcome, Quiet nodes favourites, pop-out primary window.
  - reboot wait sourceId, messageRoutes DELETE channel, SectionNav decode, ChannelInfoSheet purge result, 2.7 activity server items (C15), 2.9 notifier items, MQTT canClear, audit time presets, settings?node= drop, queued Override Frequency, A23-M5, A23-M7.
- **b2 not named in the brief:** rail scrollbar, K1 9 px overlap, 5.3/C-M7 write order, GC/GE/GH remote Bluetooth and config URL, GZ-M5 Edit re-enables, 8.4 rules with no limit, 8.4 did-not-fire detail.

## Final gate (after W13 and any approved D tasks)

| Check | Pass condition |
|---|---|
| `npm run lint:ci 2>&1 \| grep '^FAIL' \| grep -v '.claude/worktrees' \| grep -v design-scratch` | empty |
| `npx tsc --noEmit` and the server tsconfig | exit 0 |
| `npx vitest run --maxWorkers=4` with PostgreSQL 5433 and MySQL 3307 up | `success: true`, 0 failed; check `numPendingTests`, not just the headline |
| `npm run build && npm run check:bundle-size` | exit 0 |
| `npm run test:workspace-e2e` | all pass |
| Regenerated boards for the visual items (7-01, 7-05, 8-06, 8-07, 8-15, 11-01, h2, phone shell) | layout matches the board |

Then add a "Own-issues pass" section to the final report and the ledger (rulings from JM).
