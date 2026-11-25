# Workspace follow-ups Implementation Plan (#6365)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Workspace-side items still open after the own-issues pass: the JV reaction-chip note, the two tables that overflow at 1280 px, the two CSS-only fixes nobody had looked at, and the final-review minors worth doing.

**Architecture:** Four small tasks (F1–F4) inside `src/workspace/` and `tests/workspace-e2e/`, then a docs task (F5). Layout checks the unit tests can't see go in one new Playwright spec, `tests/workspace-e2e/followups.spec.ts`, which reuses the board fixtures. No Classic edit unless the requester picks option B in decision A.

**Tech Stack:** React 19 + TypeScript, TanStack Query 5, CSS modules, Vitest + Testing Library, Playwright (`npm run test:workspace-e2e`).

**Spec:** the "Own-issues pass" section of `docs/superpowers/workspace-final-report.md` (JV, "Still open after this pass"), the design boards `design-scratch/png3/7-01-messages.png` and `8-15-mqtt-region-feed.png`, and the re-verification below (HEAD e2c0a9d, 2026-11-25).

## Global Constraints

- The design boards win on layout.
- Rule X: Classic changes only by behaviour-preserving extraction, and Classic tests need no edits. Only decision A option B touches Classic.
- No backend change. No new feature.
- No new intervals (`setInterval`, `refetchInterval`, a polling `usePoll`).
- Never add a second polling observer to a query the shell already polls, and never use a `skipToken` observer on a key that something refetches. Read such a key with `useCachedQueryData`.
- Escape closes only the top layer.
- `submitOnEnter={false}` on any ConfirmSheet that transmits or destroys.
- Tests wait for a button to be enabled before clicking it.
- Guard keyboard sends and destroys against key repeat (`if (e.repeat) return`).
- Any item that grows past about 3× its size estimate, or needs a visual call the board doesn't settle, stops and is reported instead of done.
- Rulings go in `docs/superpowers/workspace-ledger.md`, starting at **JY** (then JZ, KA, …). The controller writes them; implementers propose them in their report.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XZBsd77K8LhKbcQtqcxWE6
  ```
- Push only to `claude/eager-pascal-svegts`. No PR.

## Mesh impact checklist (CLAUDE.md)

Nothing here sends a packet, arms a timer or adds a limit.
1. **Airtime:** none. F3 moves focus after a delete; the delete is a MeshMonitor database delete (`DELETE /api/messages/:id`), not a mesh send, and it is unchanged.
2. **Spam:** none. No new send path, no new event.
3. **Save resets a timer:** no scheduler is touched.

Server reads: unchanged. F4 only stops `useCachedQueryData` re-subscribing to the query cache on each render; it never fetched.

## Re-verification (2026-11-25, HEAD e2c0a9d)

| Item | Finding |
|---|---|
| 1. JV reaction chips | **Not reachable.** `unifiedRoutes.ts:443-518` keeps a MeshCore row, reactions included, only when the viewer has `messages:read` or `channel_N:read` on that row's source. `unifiedRoutes.meshcoreReactions.test.ts` pins it ("a reaction from B" is absent for a viewer of A only; "drops a reaction on an unreadable channel"). The Workspace's readable set (`useWorkspaceSources.ts:61-64`, any per-source read grant) is a superset of that, so the chips (`useUnifiedMessagesFeed.ts:284`, over every loaded row) count only reactions the viewer may read. JV's visibility note is wrong; see decision A. |
| 2a. 7-01 receptions table | Overflows at 1280 px: table 348 px in a 334 px wrap (14 px). Cells carry units (`-7.0 dB`, `-101 dBm`, `ReceptionsPanel.tsx:27-28`); the board draws bare numbers (`−7`, `−101`) under SNR / RSSI headers. The panel is fixed width, so 1440 px is the same. |
| 2b. 8-15 observers table | Overflows at 1280 px: 622 px in 533 px (89 px). The nodes table below it is clipped too ("KEY"). The split columns match the board (535 / 330 px). The text doesn't: the board's table body is ~13 px and its headers ~11 px; ours are 16 px (inherited) and 13 px (`McTools.module.css:359-374`). At 1440 px it fits (632 in 632). |
| 3a. D1 focus ring | Works, but draws **two** rings for one button: the new ring on the 44 px square, and the base `.switch:focus-visible` ring around the 24 px name row (`PhoneShell.module.css:49-53,106-109`). Screenshot `d1-focus-tab.png`. See decision B. |
| 3b. W4-e hit area | It is the Activity header's device button (`ActivityFeed.tsx:74-84`), not a row. The `::before` (`ActivityFeed.module.css:25-30`) adds 10 px above and below a 17 px button: **37 px**, not the 44 px its comment promises. Probe: 9 px above or below hits the button, 11 px hits the `h1`/header. Screenshot `w4e-hitarea.png` (hit area tinted red). The focus ring itself is fine. |
| 4a. Keyboard delete → `<body>` | Confirmed. `useMessageActions.tsx:128-148`: after a confirmed delete the row and its action-bar opener are gone, so the Sheet's focus restore has nowhere to go. |
| 4b. Absence sleeps | Confirmed in 8 files (e.g. `w8-messages.test.tsx:42,57`, `8-15-region-feed.test.tsx:38-90`, `15-07-waypoint-editor.test.tsx:87-111`). |
| 4c. `useCachedQueryData` re-subscribes | Confirmed. `useCachedQueryData.ts:12` passes a new `subscribe` closure each render, so `useSyncExternalStore` unsubscribes and resubscribes every render. |
| 4d. NodeHeader `.tiles` duplicates | No true duplicate found. The one overlap, `.tiles > a.message` (`NodeHeader.module.css:279-282`) repeating `.message`'s colours, is load-bearing: `.tiles > a` (0,1,1) would otherwise override `.message` (0,1,0). |
| 4e. `mapSettled` timeout | Confirmed (`boards.ts:2651-2666`), but the Playwright test timeout (30 s) already bounds it. |

## Review Focus

1. **A 1280 px desktop with the panel open:** every column of the receptions, observers and nodes tables is visible with no sideways scroll. e2e test in F1.
2. **Phone, keyboard focus on the device switcher:** one ring, around the device square. e2e test in F2.
3. **Phone, a thumb landing just above or below "Station G2 ⌄" on Activity:** it still opens the switcher, up to 22 px from the text's centre. e2e test in F2.
4. **Keyboard user deletes the last message in a thread:** focus lands on the message before it, never `<body>`. Test in F3.
5. **A phone viewer of the receptions sheet:** the cards keep their units ("SNR -7.0 dB"); only the desktop table drops them. Existing test `7-06-messages.test.tsx:37` stays green unchanged.

---

## How every task runs

- Read the cited code first.
- Write the failing tests named in the task, see them fail, implement, see them pass.
- Run the task's folder (`npx vitest run src/workspace/<area>`); an e2e task also runs `npm run test:workspace-e2e -- followups` (after `vite build`, which that script runs).
- Commit once per task: `fix(workspace): <area> follow-ups (#6365)`.
- The full gate runs once, after F5.

### Task F1: The wide tables fit at 1280 px (7-01, 8-15)

**Size:** ~15 lines + a ~40-line e2e spec · **Risk:** Low

**Files:**
- Modify: `src/workspace/overview/ReceptionsPanel.tsx:27-28,121-122`
- Modify: `src/workspace/meshcore/McTools.module.css` (after `.table td`, ~line 375)
- Modify: `src/workspace/meshcore/RegionFeedPage.tsx:197,226` (the two overview tables)
- Modify: `src/workspace/overview/__tests__/7-01-messages.test.tsx:48`
- Create: `tests/workspace-e2e/followups.spec.ts`

**Interfaces:**
- Produces: `followups.spec.ts` with `open(page, boardId, viewport)` (route the board's fixtures, run its `init`, `goto` its path, wait for `networkidle`, run its `setup`) and `fits(page, tableSelector) → { client, scroll }` (the table's parent `clientWidth` / `scrollWidth`). F2 adds tests to the same file.

- [ ] **Step 1: Write the failing tests**
  - Vitest, `7-01-messages.test.tsx:48`: `expect(rows[0]).toHaveTextContent(/SG2-7\.0-101.*Yes/)` and `expect(rows[0]).not.toHaveTextContent('dB')`.
  - e2e, `followups.spec.ts`, at `{ width: 1280, height: 800 }`, `colorScheme: 'dark'`:
    - "7-01 receptions table fits its panel": board `7-01-messages`; `fits(page, 'aside table')`; `expect(scroll).toBeLessThanOrEqual(client)`.
    - "8-15 observers and nodes tables fit their column": board `8-15-mqtt-region-feed`; wait for `getByTestId('feed-observer').first()`; the same check on `table:has([data-testid=feed-observer])` and on the nodes table (the second `table` in the overview split).
- [ ] **Step 2: Run, and see them fail** (today: 348 > 334, 622 > 533).
- [ ] **Step 3: Implement**
  - **Receptions:** the desktop table cells show bare numbers, as the board does: SNR `r.rxSnr.toFixed(1)`, RSSI `String(r.rxRssi)`, `'—'` when null. The headers already name the units. The phone cards (`:73-74`) keep `snr()` / `rssi()` with units, because they are prose. Keep one decimal on SNR; the board's integers come from round fixture values.
  - **Region feed:** add `.feedTable { font-size: 13px }` and `.feedTable th { font-size: 11px }` to `McTools.module.css`, and `className={`${styles.table} ${styles.feedTable}`}` on the overview's observers and nodes tables. Leave `.table` alone: `MeshCorePacketsPage` and `RunsTab` use it on other boards.
- [ ] **Step 4: Run** `npx vitest run src/workspace/overview src/workspace/meshcore` and `npm run test:workspace-e2e -- followups "7-0|8-15|8-23"`. All pass. Look at the regenerated `test-results/workspace-boards/7-01-messages.png` and `8-15-mqtt-region-feed.png` against the boards.
- [ ] **Step 5: Commit.**

### Task F2: Phone focus ring and hit area (D1, W4-e)

**Size:** ~6 lines CSS + ~35 lines e2e · **Risk:** Low · **Depends on:** decision B.

**Files:**
- Modify: `src/workspace/shell/PhoneShell.module.css:48-53`
- Modify: `src/workspace/activity/ActivityFeed.module.css:24-30`
- Modify: `tests/workspace-e2e/followups.spec.ts`

**Interfaces:**
- Consumes: `open()` from F1.

- [ ] **Step 1: Write the failing e2e tests** (viewport `{ width: 390, height: 844 }`)
  - "phone switcher shows one focus ring, on the square" (board `c-home-e1-home`): focus `header[data-device] button` with Shift+Tab then Tab; assert it `matches(':focus-visible')`, its computed `outline-style` is `none`, and the `.square` child's (`[class*=square]`) computed `outline-style` is `solid`.
  - "Activity device button is a 44 px target" (board `c-home-e4-activity`): take the device button's box; `document.elementFromPoint(centreX, centreY ± 21)` resolves (via `closest('button')`) to that button.
- [ ] **Step 2: Run, and see them fail** (two rings today; ±21 px hits the `h1` and header).
- [ ] **Step 3: Implement**
  - **D1 (option B1):** in the `.header[data-device] .switch:focus-visible .square` block's neighbourhood, add `.header[data-device] .switch:focus-visible { outline: none; }` so only the square's ring shows. The name text has no ring of its own then; the square is right beside it.
  - **W4-e:** `.device::before { inset: calc((100% - 44px) / 2) 0; }`, which centres a 44 px box on the button whatever its height. Keep it from taking layout height (that was the point of the `::before`). Fix the comment if it changes.
- [ ] **Step 4: Run** `npx vitest run src/workspace/shell src/workspace/activity` and `npm run test:workspace-e2e -- followups "c-home|phone"`. All pass. Screenshot both focus states again for the report.
- [ ] **Step 5: Commit.**

### Task F3: Keyboard delete hands focus to a neighbouring message

**Size:** ~15 lines + 1 test · **Risk:** Low–Medium (focus timing against the Sheet's restore)

**Files:**
- Modify: `src/workspace/chat/useMessageActions.tsx:46,93-95,128-148`
- Test: `src/workspace/chat/__tests__/10-08-message-actions.test.tsx`

- [ ] **Step 1: Write the failing tests**
  - "after a keyboard delete, focus moves to the next message" (desktop DM with ≥ 3 messages; focus the middle row, ArrowRight into the bar, open Delete, wait for Confirm to be enabled, confirm): `await waitFor(() => expect(document.activeElement).toHaveAttribute('data-message-id', <next id>))`.
  - "deleting the last message moves focus to the one before it": the same on the last row, expecting the previous id.
  - "cancelling a delete leaves focus where the Sheet returns it": `document.activeElement` is not `document.body`.
- [ ] **Step 2: Run, and see them fail** (focus ends on `<body>`).
- [ ] **Step 3: Implement** in `useMessageActions`:
  - On `'delete'`, find the target's row by id among `document.querySelectorAll('[data-row-target][data-message-id]')` (the desktop keyboard rows, `MessageRowD.tsx:241-249,280`), and remember the id of the row after it, else the row before it, in a ref. Look it up by `msg.id`, not `document.activeElement`, so a delete from Message details works too. Phone rows have no `data-row-target`, so nothing is remembered there.
  - After `deleteMessage` succeeds and `toDelete` is null, focus that row (`querySelector` with `CSS.escape(id)`) in an effect, which runs after the Sheet's unmount restore. Clear the ref on cancel and on failure.
- [ ] **Step 4: Run** `npx vitest run src/workspace/chat`. All pass.
- [ ] **Step 5: Commit.**

### Task F4: `useCachedQueryData` subscribes once

**Size:** ~3 lines + 1 test · **Risk:** Low

**Files:**
- Modify: `src/workspace/dashboard/useCachedQueryData.ts:9-15`
- Create: `src/workspace/dashboard/__tests__/useCachedQueryData.test.tsx`

- [ ] **Step 1: Write the failing tests**
  - "subscribes to the query cache once across re-renders": spy on `queryClient.getQueryCache().subscribe`, `renderHook` then `rerender()` three times, expect one call.
  - "returns the cached data and follows setQueryData": `setQueryData(key, 1)` → `1`; `setQueryData(key, 2)` inside `act` → `2`.
- [ ] **Step 2: Run, and see the first fail** (4 calls).
- [ ] **Step 3: Implement:** wrap `subscribe` in `useCallback(…, [queryClient])`. `getSnapshot` may stay inline; it returns the cache's own reference.
- [ ] **Step 4: Run** `npx vitest run src/workspace`. All pass.
- [ ] **Step 5: Commit.**

### Task F5: Docs and rulings

**Size:** ~40 lines docs · **Risk:** none

- [ ] **Step 1:** Ledger rulings from JY: JY corrects JV's visibility note (decision A's outcome), JZ the bare-number receptions table, KA the region-feed table size, KB the D1 single ring (decision B's outcome), and one per skip below.
- [ ] **Step 2:** A "Follow-ups pass" section at the end of `workspace-final-report.md`: tasks, rulings, the gate results, and the before/after screenshots described in words (the PNGs stay out of git).
- [ ] **Step 3: Commit** `docs(workspace): follow-ups pass in the final report and ledger (#6365)`.

## Decisions for the requester

- **A. The JV reaction-chip "leak"** [A1].
  - **A1 (recommended):** no code. The server already drops every MeshCore row, reactions included, from a source or channel the viewer can't read, and a route test pins it. Ruling JY corrects JV's note.
  - **A2:** defence in depth anyway. Classic: `useUnifiedMessagesFeed` also returns `allMessages` (one line, additive, no Classic test edit). Workspace: `OverviewMessages` regroups chips with `groupUnifiedMeshCoreReactions(allMessages.flatMap(m => readableMessage(m, readable) ?? []))` in a `useMemo`, plus a test "a MeshCore reaction from an unreadable source adds no chip". About 8 lines, Low risk. It guards nothing the server lets through today.
- **B. D1 shows two rings** [B1].
  - **B1 (recommended):** one ring, on the square (`outline: none` on the button). One line.
  - **B2:** keep both rings, as shipped.
  - **B3:** one ring around square and name together. The square is absolutely positioned outside the button's box, so this means restructuring the header markup. ~20 lines, Medium. Not worth it.

## Skips (recommended, with reasons)

- **4b Absence sleeps.** Each asserts that something did *not* happen (no request, no extra render), so there is no positive event to wait on. A fixed sleep is the usual way to say that; converting them is churn across 8 files for no user effect.
- **4d NodeHeader `.tiles` duplicates.** The only overlap is needed for specificity (see the table). Nothing to remove.
- **4e `mapSettled` timeout.** The 30 s test timeout already ends a stuck wait; an explicit one only changes the failure message.

## Out of scope

- Every b1 item (Classic or server bugs), anything ruled in JM–JQ, and the rest of JV (the O7 favourite gap, S15's expired flag), which still need Classic edits.
- The 7-01 "Heard" column shows "10:24 AM" where the board shows "10:24": that is the viewer's time-format preference, not layout.

## Final gate (after F5)

| Check | Pass condition |
|---|---|
| `npm run lint:ci 2>&1 \| grep '^FAIL' \| grep -v '.claude/worktrees' \| grep -v design-scratch` | empty |
| `npx tsc --noEmit` and the server tsconfig | exit 0 |
| `npx vitest run --maxWorkers=4` | `success: true`, 0 failed; check `numPendingTests`. PostgreSQL/MySQL are not needed (no backend or schema change), but say whether they ran. |
| `npm run build && npm run check:bundle-size` | exit 0 |
| `npm run test:workspace-e2e` | all pass |
| Regenerated boards 7-01, 8-15, c-home-e1, c-home-e4 | layout matches the board |
