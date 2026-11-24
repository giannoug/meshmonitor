# Workspace layout: final report (#6365)

MeshMonitor's UI shows one source at a time behind a row of tabs, with long console-style settings pages and a phone layout that is the desktop squeezed. This branch builds **Workspace**, the opt-in shell the design canvas draws: a device rail (Overview, then one square per device), the layout-D sidebar with each device's tools, channels and DMs, Overview for everything that spans devices, You and Server for per-user and install-wide settings, and on phones a Home · DMs · Activity · You tab bar with sheets and push navigation. Every monitoring surface (map, analysis, reports, unified views, packets, telemetry, security, automations) is a first-class place in the shell. Workspace ships alongside today's layout (Classic), which keeps working unchanged; users opt in. The spec is [specs/2026-11-13-workspace-redesign-design.md](specs/2026-11-13-workspace-redesign-design.md) and its build covers 324 boards.

- Branch: `claude/eager-pascal-svegts`
- Final code commit: `3e00f28` (Ruling F JC, after the first draft of this report); the verification gate ran there. Later commits change only docs.
- Committed ledger: [workspace-ledger.md](workspace-ledger.md)
- Final contact sheet: https://claude.ai/artifact/WiYsVAGa8BBPLMWSuj3BqS (all 324 boards, 14 MB, JPEG re-encoded)

## BLOCKED

None. No task was blocked or skipped.

Searched with `grep -n "BLOCKED:" docs/superpowers/workspace-ledger.md .superpowers/sdd/2026-11-13-workspace-redesign/progress.md`. The only hits are the line-format definition (ledger line 11) and progress.md's header line that names the format; neither is an entry.

## Final report items

Every line tagged `FINAL REPORT ITEM` in the committed ledger, in ledger order under its section, followed by the ones that appear only in progress.md. Text is verbatim. The two items the plan asks for by name come first.

### Called out

- **D4 drop set.** Removing the preview gate is commits **cd650fe** (gate removal, Task 9.3) and **df61732** (its banner fix). Drop both to ship with the gated preview restored (Ruling 9.3 IT).
- **The o2-info "flake" was a real bug (Ruling F JB, superseding F JA).** A cold deep link to an Info group (`info/radio`, `info/mqtt`) bounced to Info before the first poll and the auth check landed. Fixed in **5c04ab3** and **c8d4646**: InfoPage now waits only while the answer can change and reads the current poll's config first. Its remaining minor (a source whose `/status` keeps failing shows Loading… instead of redirecting) is under Deferred minors.
- **Layout-choice save failures (Ruling F JC).** The Task 1.8 carry "must fix before enabling" was still open when the gate came off; fixed in **3e00f28** before this report was final.

### From the committed ledger

**Task 3.6 — map context menu, waypoints, local markers**

- Ruling: controller BI — i18nLanguageCoverage.test.ts leaves `workspace.*` keys out of the coverage count while the opt-in Workspace layout (#6365) is in preview; KNOWN_PARTIAL is unchanged — why: the threshold decides which languages the picker offers every user, and preview-only strings would otherwise drop zh_Hans (49.87%) for Classic users. Every later phase adds more workspace.* keys — cost if wrong: one filter line. FINAL REPORT ITEM: remove the exclusion before Workspace leaves preview.
- Ruling: controller BK — FINAL REPORT ITEM, today's server (unchanged, since the task allows no backend changes): a new waypoint with a rebroadcast interval is sent again by the scheduler within ~60 s, because the first send is not recorded as its last broadcast. Waypoint routes also have no HTTP rate limiter. A save does not reset the rebroadcast timer.

**Phase 3 summary (gate)**

- Backend changes this phase: none. Server behaviour is untouched. Two existing waypoint-server issues are logged as a FINAL REPORT ITEM (Ruling BK).

**Phase 4 summary (gate)**

- Mesh impact this phase: no new send paths, no automatic sends, no new timers. Packet capture is a server-side logging setting under today's `settings:write` gate and transmits nothing. Enrichment keeps today's unpaced send (Ruling CM, FINAL REPORT ITEM).
- Pre-existing issues found and left for follow-up (FINAL REPORT ITEMs): any Users save clears MeshCore `remote_admin` grants in both layouts (Ruling DA); Classic's relay-estimate modal pools direct-neighbour stats across sources.

**Task 5.2 — settings frame, row kit, category routes**

- Ruling: 5.2 DM — I1: Workspace settings read /api/poll once on open and again after their own writes (frame's DataProvider has the link down, so usePoll never arms an interval); today's App refreshed every 30 s. Accepted: fewer requests than today, no new timer (N); re-reviewer verifies the claim — if wrong (users need live channel refresh), the fix is to supply a connected link state, not a new interval. FINAL REPORT ITEM.

**Task 5.3 — radio save bar, Review, leave guard**

- Ruling: 5.3 DP — the leave guard covers in-app link clicks and device switch; browser Back and programmatic navigate leave without asking (the app uses a router with no blocker; changing the router is outside this redesign) — shortcut comment in LeaveGuard.tsx — FINAL REPORT ITEM — if wrong, a Back press drops queued edits as Classic does today.
- Ruling: 5.3 DR — change dots in the desktop settings sidebar not built (sidebar is drawn by the shell outside the frame that owns the queue) — deferred to 9.1 pattern sweep — FINAL REPORT ITEM — if wrong, a board indicator missing, no control lost.

**Task 5.5 — Identity, Channels, Security**

- Ruling: 5.5 ED — leave guard still misses browser Back, now for channel drafts too; covered by DP, already a FINAL REPORT ITEM — cost if wrong: a lost channel draft on Back.

**Task 5.6 — Device and module categories**

- Ruling: 5.6 EL — MQTT keeps its own section and save bar (DN path), since a link-only staging has no field diff and the queue would not write it — accepted; FINAL REPORT ITEM (MQTT is the one radio category off the queue) — cost if wrong: an explicit MQTT queue entry.

**Task 5.7 — Maintenance, Backup, Firmware, Danger zone**

- Ruling: 5.7 ER — Firmware unrestyled (today's FirmwareUpdateSection inside the Workspace page) is provisionally accepted pending review — why: the brief's first constraint was "do not change what it downloads or flashes"; a redraw of a 1,500-line flash flow with half-flash recovery is a separate risk class — cost if wrong: 12-09/12-19 do not match the board until a dedicated restyle lands; FINAL REPORT ITEM if the review does not force it.

**Task 5.9 — remote target in settings**

- Ruling: 5.9 GC — M8: remote channel Delete (role Disabled), channel JSON export/import and config-URL share/import are offered on a remote target where they reuse the existing Channels / Share pages with the remote values and the remote send path (one admin packet per changed slot, SendsLine honest). Bluetooth stays out (EA/EM); FINAL REPORT ITEM: remote Bluetooth is Classic-only. If one of these turns out not to fit the remote path cleanly, give a Ruling line and it becomes a FINAL REPORT ITEM.
- Ruling: 5.9 GE — remote config-URL export withheld is accepted as a FINAL REPORT ITEM — why: rebuilding the URL per tick would send a mesh read per ticked slot (mesh checklist) — cost if wrong: one Classic-only remote capability.
- Ruling: 5.9 GF — remote module lock seeding as supported follows today (D9d) — why: Admin Commands allows the same sends — cost if wrong: a 2.7.x node silently drops TM/MeshBeacon settings, as today. FINAL REPORT ITEM.
- Ruling: 5.9 GH — remote config-URL import is withheld on a remote target, like export (GE); FINAL REPORT ITEM: remote URL share/import is Classic-only and today's Classic import also drops sourceId — why: GC offered it only "where it fits the remote path", and the import API cannot target the selected source, so it could transmit from another radio — cost if wrong: one more remote capability stays in Classic. This also removes N2 and N3. N4 joins round 2.
- Ruling: 5.9 GG-a accepted (re-reviewer: acceptable): remote JSON export uses the earlier read and sends nothing; a stale file is possible. FINAL REPORT ITEM. GG-b (12-25 check string) is accepted.
- Ruling: 5.9 GI — pre-existing, out of scope, FINAL REPORT ITEMs:
  - (a) Browser Back can drop unsent remote edits; the leave guard covers link clicks only (same family as ED).
  - (b) Classic's remote config-URL import drops sourceId (api.ts importConfig), so on a multi-source install it transmits through the primary source.
  - (c) PRIVACY: channelLoadingUtils.ts:64 maps an elided positionPrecision to 32. A remote channel save then sends 32 (full-precision position) for a channel whose node has precision 0 (position off). This is the case in Classic Admin Commands today and is mirrored by the Workspace remote path. A follow-up task is suggested.
- Ruling: 5.9 GC — the config-URL export (Share's Export card) is not offered on a remote target — why: it rebuilds the URL on every tick change, a remote `export-config` asks the node for each ticked slot over the mesh each time, and today's remote call carries no sourceId — cost if wrong: a FINAL REPORT ITEM; remote URL export stays Classic-only.
- Ruling: 5.9 GH — remote config-URL import is withheld like export (GE). The Share link is hidden, and `channels/share` on a remote target falls back to the channel list, with no reason copy (GE showed none). FINAL REPORT ITEM: remote URL share/import is Classic-only, and today's Classic remote import also drops sourceId — why: the import API cannot name this source, so it could transmit through another radio — cost if wrong: one more remote capability stays in Classic.

**Phase 5 summary (gate)**

- FINAL REPORT ITEMs raised this phase:
  - DM: no live /api/poll refresh in settings.
  - DP/ED: the leave guard misses browser Back. This now also covers remote edits (GI-a).
  - DR: no change dots in the sidebar.
  - EL: MQTT keeps its own bar locally.
  - The 5.3 write order.
  - GE/GH: remote config-URL share and import are Classic-only.
  - GC: remote Bluetooth is Classic-only.
  - GF: remote module locks are seeded as supported, as today.
  - GG-a: remote JSON export may be stale.
  - GI-b: Classic's remote URL import drops sourceId and transmits through the primary source.
  - GI-c (PRIVACY, pre-existing): a remote channel read maps an elided positionPrecision 0 to 32 (channelLoadingUtils.ts:64), so a later remote channel save can switch on full-precision location. Filing it as a follow-up task failed: the tool timed out twice.
  - No PR created (requester's instruction).

**Task 6.5 — server categories, part 2**

- FINAL REPORT ITEMs from 6.5:
  - PRE-EXISTING SECURITY: /api/solar/trigger is mounted with optionalAuth only, so it has no permission gate.
  - No cooldown on "Run analysis now" (mesh issues) or "Fetch Estimates Now" (solar).
  - Ruling CM stands: the manual Fix All enrichment path sends unpaced.

**Task 6.6 — Add device flow and Server › Devices**

- Ruling: 6.6 GZ — promote M1 (hostOf must never show userinfo on a parse failure; the fixture carries user:pass@), M2 (no duplicate Back on a failed result), M3 (failed result shows the admin status `lastError` as secondary text; the first row must not say "Reached" when the host was not reached), M4 (phone Add device ≥44 px), M5 (test comment saying Edit's `enabled: true` is today's body on purpose; FINAL REPORT ITEM: Classic and Workspace Edit re-enable a disabled source), M6 (fill the edit form before the first render, drop the exhaustive-deps disable), plus the ⚠️ CR check (Escape in a nested finder closes only it; a test if nested). M7 (file splits) and M8 (Passive Mode in both steps) deferred to F.1 triage.

**Task 6.7 — Device states and Connection card**

- Ruling: 6.7 HC — the phone device header keeps the board's height (64 px, or what it was before d006ce7). The switcher stays the square plus name (the square is 44 px). The status line is its own button, at least 24 px tall (WCAG 2.5.8 minimum), with its hit area padded down to the header's bottom edge where it can be, and no overlap with the switcher. This is an exception to the ≥44 px phone-target rule for this one secondary control. — why: every phone board draws the header at that height, and the switcher keeps a 44 px target — cost if wrong: one control below 44 px (FINAL REPORT ITEM); the alternative is a 96 px header on every phone device screen.
- Ruling: 6.7 h5/i4 — the "Last 24 hours" up/down bar is not drawn. Today's API keeps no connection history or uptime for a source (`GET /api/sources/:id/status` and `GET /api/connection` give only the current state), and no client-side history was invented. The board checks drop "Last 24 hours". FINAL REPORT ITEM: a source connection-history field or route is needed to draw it — why: dispatch (no backend change) — cost if wrong: one server field and a bar.
- Ruling: 6.7 h5/i4 — "Offline since 14:02" / "(2 h 13 min)" / "Offline for 2 h 13 min" are replaced by today's words. The header uses "Disconnected" (statusLabel, as 1.7 / 6.6). The card uses `getStatusInfo` ("Connecting" for an auto-retrying source, as Server › Devices). Today's status reply has no time to say "since" from. FINAL REPORT ITEM: the same server field — why: D9d — cost if wrong: string swap, plus a field.
- Ruling: 6.7 i4 HC — the phone device header keeps the boards' 64 px. The square and the name are the switcher button: its target includes the 44 px square, which hangs from the 24 px name row. The status line is its own button under the name, running down to the header's bottom edge, 30 px tall: at least 24 px (WCAG 2.5.8), and starting right of the square and below the name, so the two never share a hit area. It opens the Connection card. This is an exception to the 44 px phone-target rule for this one secondary control. FINAL REPORT ITEM — why: the 96 px header of d006ce7 pushed every phone device screen ~23 px below the boards (controller, Ruling 6.7 HC) — cost if wrong: a 30 px target where the rule asks 44 px.

**Phase 6 summary (gate)**

- FINAL REPORT ITEMs raised this phase:
  - **No connection history.** There is no "offline since" time and no 24 h up/down history for a source, so h5/i4 draw today's status words without the duration bar. Drawing them needs a server field.
  - **Phone status line target.** The phone status-line button is 30 px tall, an exception to the ≥44 px rule (HC).
  - **Edit re-enables a source.** Editing a disabled source PUTs `enabled: true`, in Classic and in Workspace, because that is today's body (6.6 GZ M5).
  - **PRE-EXISTING SECURITY:** `/api/solar/trigger` is mounted with optionalAuth only.
  - **No cooldowns.** "Run analysis now" and "Fetch Estimates Now" have none. The manual "Fix All" path is unpaced (CM).
  - **Remote admin attempts.** Remote admin allows up to 10 attempts.
  - **News auto-open.** Before GO, the Workspace had no news auto-open.
  - **Not built in 6.6:**
    - the found-serial-ports list, because no endpoint exists;
    - a stored device colour ("Square"), because none is stored;
    - the broker's per-bridge rewrites in the Workspace edit (Classic keeps them).
  - No PR created (requester's instruction).

**Task 7.3 — MeshCore repeater and room admin**

- Ruling: 7.3 HI — the danger confirm keeps today's typed contact-name word for a console reboot. s8n2 says "Reboot and a console reboot ask plainly" as a statement of today's behaviour, not as an override, and today does guard reboot with a typed word (MESHCORE_REMOTE_ADMIN.md). The global constraint keeps the typed word where today asks for one. Add 8-06's "What happens" list through ConfirmSheet's `consequences`. FINAL REPORT ITEM: the s8n2 note misstates today's reboot guard. — cost if wrong: one typed word more than the board shows.

**Task 7.4 — MeshCore settings, channels, maintenance**

- Ruling: 7.4 HM — accept the slot list showing the first and last 4 hex characters of a channel key, as the board draws it. The raw key reaches only writers, who can already see it in full in the editor and the Share URL; 96 bits stay hidden. FINAL REPORT ITEM: today's list shows none of it. — cost if wrong: 32 bits of a PSK on screen for a writer.
- Ruling: 7.4 HO — Purge messages checks messages:write for this source, which is narrower than today's sourceless check. This is accepted: CLAUDE.md requires per-source permission checks on a sourceId route. FINAL REPORT ITEM. — cost if wrong: a user with messages:write only on another source loses Purge here.
- Ruling: 7.4 all — the undrawn pages with large sections (Path hash & scope, Sender names, Contacts, Observer, Adverts & forwarding, Clock, Reactions, Required repeaters, Display, Filters, Notifications) hold today's sections as they are, with their own save buttons / today's SaveBar — why: s8n4 draws none of them, Rule X allows no fork, GR — cost if wrong: Classic-styled blocks inside Workspace pages; a kit redraw later. FINAL REPORT ITEM.
- Ruling: 7.4 8-09 — the slot list shows a key's first and last 4 hex characters, as the board draws it (HM) — why: the raw key reaches only writers, who already see it in full in the editor and the Share URL; 96 bits stay hidden — cost if wrong: 32 bits of a PSK on screen for a writer. FINAL REPORT ITEM: today's list shows none of the key.
- Ruling: 7.4 all — Purge all messages checks `messages:write` on this source, narrower than today's sourceless check (HO) — why: CLAUDE.md requires per-source permission checks on a route that acts on a `sourceId` — cost if wrong: a user with `messages:write` only on another source loses Purge here. FINAL REPORT ITEM.

**Task 7.5 — MeshCore packets, info, automations, region feed**

- Ruling: 7.5 HP — fix I1–I5. The dock line is accurate per built-in: where today's server runs or re-arms on save, say so in today's terms; otherwise say saving sends nothing. This is wording, not a limit, so no user decision is needed; the re-arm behaviour itself stays a FINAL REPORT ITEM. Use today's meshcore.advert.flood_automated_warning, shown for flood only (D9b). The region feed's Nodes and Channels reuse 7.2's MeshCoreNodesTable and 7.1's channel thread, read-only, per s8n5.
- Ruling: 7.5 HR — MeshCore map, the channels/rooms/dms list views, telemetry, notifications and security stay re-hosted. No board in Section 8 draws them as pages (the review confirmed this), so building them would be design without a canvas. FINAL REPORT ITEM: the plan gap.

**Task 7.6 — Reticulum**

- Ruling: 7.6 HU — the Reticulum dashboard page mounts the shared Dashboard grid whole until Task 8.1, which owns that redraw; 8.1's brief must name reticulumDashboardSource. canEdit now checks dashboard:write on this source, narrower than today's sourceless check; this is accepted under the per-source rule (as HO). FINAL REPORT ITEM.
- Ruling: 7.6 9-01/9-10 — The composer shows the shared byte counter "N/200" without blocking — why: Composer has no prop to hide it, and adding one to the Classic MessageComposeInput was avoided; today's LXMF box has no counter or limit — cost if wrong: a misleading counter. FINAL REPORT ITEM.
- Ruling: 7.6 9-03 — Today's Dashboard grid moves from under the Interfaces cards to its own URL `dashboard` (the sidebar's Dashboard row) and is mounted whole there; Phase 8 redraws the Dashboard for every device type — why: the board has a Dashboard row and its own rate-history block; the grid is the shared Dashboard component, not a Reticulum view — cost if wrong: a Classic-styled grid until Phase 8. FINAL REPORT ITEM.
- Ruling: 7.6 HU — The Dashboard page's `canEdit` checks `dashboard:write` on this source, narrower than today's sourceless check (as HO) — why: CLAUDE.md's per-source rule — cost if wrong: a user with `dashboard:write` only on another source cannot edit this device's Dashboard. FINAL REPORT ITEM.

**Phase 7 summary (gate)**

- FINAL REPORT ITEMs raised this phase:
  - **Server re-arms on save (today's behaviour, unchanged):**
    - Auto-pathfinding queues a run 0–5 min after a save, and its last-run time lives in memory.
    - Auto-announce and timer triggers restart their intervals from the save.
    - Auto Delete by Distance and Auto Favorite run 2 min after a save.
    - The dock lines now say so.
  - **Canvas note s8n2** misstates today's console reboot guard (HI). The 8-06 reboot bullet also contradicts the firmware notes.
  - **Narrower per-source checks:** Purge messages (`messages:write`, HO) and the Reticulum dashboard `canEdit` (`dashboard:write`, HU).
  - **Channel keys:** the channel slot list shows 4+4 hex of a channel key to writers. Today's list shows none (HM).
  - **Re-hosted MeshCore views** with no boards (HR).
  - **Build memory (pre-existing):** `tsc` needs more than a 2 GB heap on the base too. The build needs `NODE_OPTIONS` of at least 4 GB.
  - **Container restarts:** the container restarted twice during this phase. No work was lost.
  - No PR created (requester's instruction).

**Task 8.1 — Device dashboard, per-user board**

- Ruling: 8.1 HV — the dashboard filters come back as a compact control reusing useDashboardFilters (search, node, type, role) over the board items. Sort is replaced by the user's own order, which is the board's model (D12); FINAL REPORT ITEM. Fix I1–I4:
  - Remove only the chart keys the draft removed; `changed` is measured against the snapshot. Test a star arriving mid-edit.
  - Read status from the shell or the cache, with no polling observer.
  - lowBattery is null ("—") without battery data. MeshCore Nodes reads ?show= so the tiles filter.
  - Phone 44 px element rules under the module class, inside card bodies.
- Ruling: 8.1 all — today's search, node, type, role filters and sort are not on the Workspace board; the user's order replaces sort — why: the boards draw none and the board is per user — cost if wrong: a filter row (useDashboardFilters is reusable). FINAL REPORT ITEM (GR).
- Ruling: 8.1 HV — sort is replaced by the user's own order (D12); search, node, type and role filters are back over the charts through today's `useDashboardFilters` — FINAL REPORT ITEM.

**Task 8.3 — Device automations and built-ins**

- Ruling: 8.3 14-06 — Export Scripts sends the script paths (what `/api/scripts/export` validates); today's "export all" branch posts metadata objects — why: the server reads paths — cost if wrong: none (FINAL REPORT ITEM: Classic's export-all may export nothing).
- FINAL REPORT ITEM: 8.3 — save re-arms (today's server, unchanged): Auto Announce (Announce on Start can send within 30 s of a save), Auto Traceroute and LocalStats (first send 0–5 min after a save), Auto Time Sync, Geofence while-inside timers, Auto Delete by Distance (run 2 min after a save). The Workspace dock states each.
- FINAL REPORT ITEM: 8.3 — per-source saves of Auto Key Management and Remote Admin Scanner never reach the running scheduler until a reconnect (global branch only).
- FINAL REPORT ITEM: 8.3 — Auto Welcome enabled per source does not mark existing nodes welcomed (global branch only); not verified whether they are then welcomed.
- FINAL REPORT ITEM: 8.3 — Classic "export all" posts ScriptMetadata objects; the server's path check throws (AutoResponderSection.tsx:254-269, scriptRoutes.ts:980). Pre-existing; not fixed (Rule X). The Workspace sends paths.

**Task 8.4 — Overview automations: rules, runs, trace, variables, templates**

- FINAL REPORT ITEM: Every save or enable of any rule stops and re-creates **all** schedule rules' cron jobs (`rescheduleCron`); harmless for
  cron (time-of-day), but a timed rule enabled after its end is turned straight back off (`endTimedAutomation`). Unchanged.
- FINAL REPORT ITEM: Disabling a rule drops its in-memory geofence / staleness / battery-trend / left-home baselines; re-enabling re-baselines
  (no fire, but a transition during the off period is not alerted). Unchanged.
- FINAL REPORT ITEM: Run now on a rule whose sending steps name no device has no triggering device to send through (the confirm says so).
- FINAL REPORT ITEM: Rules without a limit (Weather bot, Net check-in in the fixtures): no limit proposed — ask before you decide.
- FINAL REPORT ITEM: tracePathSchedule's last run is persisted per `${automationId}:${nodeId}:${publicKey}` (tracePathScheduleService.ts:10-11, 27); a rename keeps it, a step edit that renumbers compile()'s positional node ids re-arms that path's interval — today's builder behaviour, unchanged.

**Task 8.5 — Device packets, info, security and quiet nodes**

- FINAL REPORT ITEM: Meshtastic Quiet nodes: favourites are not protected by the bulk-delete route (only MeshCore protects them); the confirm says so. Unchanged server behaviour.
- FINAL REPORT ITEM: Pop out opens today's window with no source (the primary device's monitor), even from another device's monitor — today's behaviour, kept.
- FINAL REPORT ITEM: Today's InfoTab fetches LocalStats channel utilisation and airtime but never showed them; the Radio card shows them (no new request).

**Phase 8 summary (gate)**

- FINAL REPORT ITEMs raised this phase:
  - **Dashboard:** sort is replaced by the user's own order (HV); the Overview board has no filters and its Edit needs only a signed-in user (8.2).
  - **Server re-arms on save (today's behaviour, unchanged):** Auto Announce, Auto Traceroute, LocalStats, Auto Time Sync, geofence timers, Auto Delete by Distance (8.3); every rule save re-creates all cron jobs, disabling a rule drops its in-memory baselines, and a step edit can re-arm a trace-path interval (8.4).
  - **Per-source scheduler gaps (today):** Auto Key Management and Remote Admin Scanner per-source saves wait for a reconnect; Auto Welcome per source does not mark existing nodes welcomed (8.3).
  - **Classic bug, not fixed (Rule X):** "export all" posts metadata objects the server rejects (8.3).
  - **Run now** with no device named in a sending step has nothing to send through; the confirm says so (8.4).
  - **Tools:** Meshtastic Quiet nodes bulk delete does not protect favourites (server); Pop out opens the primary device's window from any device; the Radio card now shows LocalStats utilisation and airtime that InfoTab fetched but never showed (8.5).
  - No PR created (requester's instruction).

**Task 9.1 — Shared confirm, toasts, states, reboot wait**

- Task 9.1: minor (deferred): over-long comment line in ChatProviders.tsx; reboot wait polls /api/connection without sourceId (today's RebootModal behaviour) — FINAL REPORT ITEM; Maintenance › Reboot now opens the reboot wait (≤44 server reads, nothing on the mesh) — FINAL REPORT ITEM.
- FINAL REPORT ITEM: the reboot wait reads /api/connection without a sourceId (today's RebootModal), so on a non-primary source it can read the primary's state.
- FINAL REPORT ITEM: Maintenance › Reboot (this radio) now opens the reboot wait — up to 44 server reads, nothing on the mesh.
- FINAL REPORT ITEM: board-test cold-load findBy timeouts under the full 4-worker run (10-01, 6-08, 18-05 seen) are pre-existing (reproduced on a1e5e94); the 9.1 gate run had 0 failed.

**Task 9.3 — Remove the preview gate, enable Classic entry points**

- Task 9.3: minor (deferred): Classic page loads now resolve layout from /api/settings + /api/user/preferences (react-query, 5 min) instead of /api/config — spec §5.1 rules 2-4; FINAL REPORT ITEM. Classic chrome snapshot fixture has offerWorkspaceBanner 'true' and its selector excludes the banner, so it proves less than the plan assumed.
- FINAL REPORT ITEM: the D4 drop set (gate removal) is cd650fe + df61732.
- FINAL REPORT ITEM: the r3 banner (Task 1.8) was hidden behind Classic's fixed header and Nodes view until 9.3; fixed in df61732.

**Phase 9 summary (gate)**

- FINAL REPORT ITEMs raised this phase:
  - **D4 drop set:** cd650fe + df61732 remove the gate. Drop both to ship with the preview gate restored.
  - **Classic layout resolution** now reads `/api/settings` and `/api/user/preferences` (react-query, 5 min) instead of `/api/config` (spec §5.1).
  - **Reboot wait** reads `/api/connection` without a `sourceId`, as RebootModal does today. Maintenance › Reboot now opens the wait.
  - **Banner placement:** while the r3 offer shows, Classic's AppBanners sit one banner lower (IU).
  - **Board-test cold-load timeouts** under the full 4-worker run are pre-existing; every gate run this phase had 0 failed.
  - No PR created (requester's instruction).

**Final review (F.1) and fix pass (F.2)**

- F.1: five area reviews (A1, A23, B, C, D), all "With fixes", 0 Critical, 8 Important. F.2 (930faed) fixed all 8 and 22 promoted minors; scoped re-review 30/30 addressed. Deferred: A1-M3/M6, A23-M2 (reboot wait reads primary — FINAL REPORT ITEM), A23-M5, A23-M7, B-M4/M5, C-M7 (remote batch write order — FINAL REPORT ITEM).
- JA follow-up (5c04ab3, c8d4646): FINAL REPORT ITEM — the o2-info "flake" was a real bug: a cold deep link to an Info group (info/radio, info/mqtt) bounced to Info before the first poll and the auth check landed. InfoPage now waits only while the answer can change (auth loading, shell status unknown/connecting, or link up with no poll answer yet) and reads the current poll's config first. Review clean after 1 fix round.

### Only in progress.md

These were never copied to the committed ledger; the rest of progress.md's tagged lines restate ledger items above.

- FINAL REPORT ITEM: server bug (out of scope, confirmed by controller): messageRoutes.ts DELETE /:id uses `message.channel !== 0` for channel-vs-DM, but DMs are channel -1 → non-admins can't delete a single DM; channel-0 delete needs messages:write instead of channel_0:write. Affects Classic too. spawn_task timed out twice — list as a follow-up in the final report.
- Task 2.6: FINAL REPORT ITEM: Classic DM Mark All Read sends no sourceId → on a non-primary device marks the primary's DMs (MessagesTab.tsx:1297 → MessagingContext.tsx:203). Classic left unchanged; follow-up.
- Task 2.6: FINAL REPORT ITEM: Classic SearchModal labels a DM by `to` and opens `from` (opens own node for our DMs). Follow-up.
- FINAL REPORT ITEM: ApiService reads a 403 body twice, so every 403 toast says 'Request failed' instead of the server message (pre-existing, found in 4.5; not changed) — candidate cleanup after plan.

Also found while writing this report: progress.md line 127 carried a Task 1.8 minor to Task 9.3 as "must fix before enabling" (banner Try it / Not now / menu item failures only logged, no user feedback); the gate had come off without it. **Fixed in 3e00f28 (Ruling F JC):** a failed save now shows an inline alert in the banner and in the user-menu item (the menu stays open on failure); review clean. A sweep of the other 31 `deferred → <task>` carries found 26 resolved and 5 open minors (Ruling F JD, listed under Deferred minors).

## Verification evidence

The controller's gate at `3e00f28` (the last code commit). CI has not run on this fork (Actions off), so these are local runs.

| Check | Result |
|---|---|
| `npm run lint:ci`, in-repo filter (Ruling F) | 0 FAIL lines |
| `tsc` client | exit 0 |
| `tsc` server | exit 0 |
| Vitest, PostgreSQL (5433) and MySQL (3307) containers up | success true · 41,630 total · 41,500 passed · 0 failed · 109 pending · 21 todo · 11,162 suites, 0 failed |
| `npm run build` + `npm run check:bundle-size` | exit 0 |
| Playwright `npm run test:workspace-e2e` | 388 passed (6.5 min) |

About 109 pending is the normal count with both database containers up: the PostgreSQL and MySQL suites ran. If either container is down those suites skip silently and pending rises to roughly 2,000 while the run still reports success. The Playwright run also regenerated every board screenshot in `test-results/workspace-boards/`.

## Board coverage

All 324 boards of spec Appendix A, expanded from its ranges (P1 8, P2 23, P3 36, P4 49, P5 42, P6 60, P7 48, P8 42, P9 16). a-chat-D-desktop and a-chat-D-phone are listed under P2 as well as P1 and are counted once, in P1. Every board has a check fixture at `src/workspace/__fixtures__/board-checks/<board>.json` and a Playwright screenshot at `test-results/workspace-boards/<board>.png`; none is missing.

Status: **116 accepted**, **208 deviation**, **0 blocked**.

| Board | Phase | Test file | Screenshot | Status |
|---|---|---|---|---|
| `a-chat-D-desktop` | P1 | src/workspace/shell/__tests__/a-chat-D-desktop.test.tsx | `a-chat-D-desktop.png` | deviation (Ruling 2.3 L124) |
| `a-chat-D-phone` | P1 | src/workspace/shell/__tests__/a-chat-D-phone.test.tsx | `a-chat-D-phone.png` | deviation (Ruling 2.6 L203) |
| `c-home-e2-switcher` | P1 | src/workspace/shell/__tests__/c-home-e2-switcher.test.tsx | `c-home-e2-switcher.png` | deviation (Ruling 1.7 L60) |
| `r2-you-layout` | P1 | src/workspace/you/__tests__/r2-you-layout.test.tsx | `r2-you-layout.png` | accepted |
| `r3-classic-banner` | P1 | src/components/WorkspaceBanner/__tests__/r3-classic-banner.test.tsx (no expectBoard; Ruling 1.8 L86) | `r3-classic-banner.png` | accepted |
| `r4-server-general` | P1 | src/workspace/server/__tests__/r4-server-general.test.tsx | `r4-server-general.png` | deviation (Ruling controller V L79, 1.8 L92) |
| `s1-you` | P1 | src/workspace/you/__tests__/s1-you.test.tsx | `s1-you.png` | deviation (Ruling 1.7 L68) |
| `s3-layout` | P1 | src/workspace/you/__tests__/s3-layout.test.tsx | `s3-layout.png` | deviation (Ruling 1.8 L91) |
| `c-home-e1-home` | P2 | src/workspace/chat/__tests__/c-home-e1-home.test.tsx | `c-home-e1-home.png` | deviation (Ruling 2.6 L203) |
| `c-home-e3-dms` | P2 | src/workspace/chat/__tests__/c-home-e3-dms.test.tsx | `c-home-e3-dms.png` | accepted |
| `c-home-e4-activity` | P2 | src/workspace/activity/__tests__/c-home-e4-activity.test.tsx | `c-home-e4-activity.png` | accepted |
| `c-home-e5-activity-empty` | P2 | src/workspace/activity/__tests__/c-home-e5-activity-empty.test.tsx | `c-home-e5-activity-empty.png` | accepted |
| `c-home-e6-desktop-activity` | P2 | src/workspace/activity/__tests__/c-home-e6-desktop-activity.test.tsx | `c-home-e6-desktop-activity.png` | accepted |
| `10-01-dm-conversation` | P2 | src/workspace/chat/__tests__/10-01-dm-conversation.test.tsx | `10-01-dm-conversation.png` + `-latte` | deviation (Ruling 2.4 L154) |
| `10-02-message-details` | P2 | src/workspace/chat/__tests__/10-02-message-details.test.tsx | `10-02-message-details.png` | deviation (Ruling 2.5 L184, 2.5 L185) |
| `10-03-channel-menu` | P2 | src/workspace/chat/__tests__/10-03-channel-menu.test.tsx | `10-03-channel-menu.png` | deviation (Ruling 2.3 L124) |
| `10-04-beacons` | P2 | src/workspace/chat/__tests__/10-04-beacons.test.tsx | `10-04-beacons.png` | accepted |
| `10-05-read-only` | P2 | src/workspace/chat/__tests__/10-05-read-only.test.tsx | `10-05-read-only.png` | deviation (Ruling 2.3 L124, 2.3 L127) |
| `10-06-channel-thread` | P2 | src/workspace/chat/__tests__/10-06-channel-thread.test.tsx | `10-06-channel-thread.png` | accepted |
| `10-07-dm-conversation` | P2 | src/workspace/chat/__tests__/10-07-dm-conversation.test.tsx | `10-07-dm-conversation.png` | deviation (Ruling 2.4 L154) |
| `10-08-message-actions` | P2 | src/workspace/chat/__tests__/10-08-message-actions.test.tsx | `10-08-message-actions.png` | deviation (Ruling 2.5 L173) |
| `10-09-translate` | P2 | src/workspace/chat/__tests__/10-09-translate.test.tsx | `10-09-translate.png` | deviation (Ruling 2.5 L187) |
| `10-10-message-details` | P2 | src/workspace/chat/__tests__/10-10-message-details.test.tsx | `10-10-message-details.png` | deviation (Ruling 2.5 L184, 2.5 L185) |
| `10-11-dm-inbox` | P2 | src/workspace/chat/__tests__/10-11-dm-inbox.test.tsx | `10-11-dm-inbox.png` | deviation (Ruling 2.6 L203) |
| `10-12-channel-info` | P2 | src/workspace/chat/__tests__/10-12-channel-info.test.tsx | `10-12-channel-info.png` | deviation (Ruling 2.3 L124) |
| `10-13-beacons` | P2 | src/workspace/chat/__tests__/10-04-beacons.test.tsx | `10-13-beacons.png` | accepted |
| `10-14-read-only` | P2 | src/workspace/chat/__tests__/10-05-read-only.test.tsx | `10-14-read-only.png` | deviation (Ruling 2.3 L124, 2.3 L127) |
| `10-15-search-messages` | P2 | src/workspace/chat/__tests__/10-15-search-messages.test.tsx | `10-15-search-messages.png` | deviation (Ruling 2.6 L203) |
| `10-16-search-messages` | P2 | src/workspace/chat/__tests__/10-16-search-messages.test.tsx | `10-16-search-messages.png` | deviation (Ruling 2.6 L203) |
| `18-05-emoji-picker` | P2 | src/workspace/chat/__tests__/18-05-emoji-picker.test.tsx | `18-05-emoji-picker.png` | accepted |
| `18-06-emoji-picker` | P2 | src/workspace/chat/__tests__/18-06-emoji-picker.test.tsx | `18-06-emoji-picker.png` | accepted |
| `Main` | P3 | src/workspace/map/__tests__/Main.test.tsx | `Main.png` | accepted |
| `f2-layers` | P3 | src/workspace/map/__tests__/f2-layers.test.tsx | `f2-layers.png` | deviation (Ruling 3.1 L293, 3.1 L302) |
| `f3-nodes` | P3 | src/workspace/nodes/__tests__/f3-nodes.test.tsx | `f3-nodes.png` | deviation (Ruling 3.3 L342) |
| `f4-node` | P3 | src/workspace/node-page/__tests__/f4-node.test.tsx | `f4-node.png` | accepted |
| `f5-telemetry` | P3 | src/workspace/node-page/__tests__/f5-telemetry.test.tsx | `f5-telemetry.png` | accepted |
| `g1-map` | P3 | src/workspace/map/__tests__/g1-map.test.tsx | `g1-map.png` | deviation (Ruling controller BC L312, 3.2 L316, 3.2 L324) |
| `g2-layers` | P3 | src/workspace/map/__tests__/g2-layers.test.tsx | `g2-layers.png` | deviation (Ruling controller BC L312, 3.2 L320) |
| `g3-nodes` | P3 | src/workspace/nodes/__tests__/g3-nodes.test.tsx | `g3-nodes.png` | deviation (Ruling 3.3 L341, 3.3 L342) |
| `g4-node` | P3 | src/workspace/node-page/__tests__/g4-node.test.tsx | `g4-node.png` | accepted |
| `g5-links` | P3 | src/workspace/node-page/__tests__/g5-links.test.tsx | `g5-links.png` | deviation (Ruling 3.4 L366) |
| `15-01-node-menus` | P3 | src/workspace/node-page/__tests__/15-01-node-menus.test.tsx | `15-01-node-menus.png` | deviation (Ruling 3.5 L399, 3.5 L400) |
| `15-02-position` | P3 | src/workspace/node-page/__tests__/15-02-position.test.tsx | `15-02-position.png` | accepted |
| `15-03-admin` | P3 | src/workspace/node-page/__tests__/15-03-admin.test.tsx | `15-03-admin.png` | accepted |
| `15-04-traceroute-history` | P3 | src/workspace/node-page/__tests__/15-04-traceroute-history.test.tsx | `15-04-traceroute-history.png` | accepted |
| `15-05-node-dialogs` | P3 | src/workspace/node-page/__tests__/15-05-node-dialogs.test.tsx | `15-05-node-dialogs.png` | deviation (Ruling 3.5 L386) |
| `15-06-identity-merge` | P3 | src/workspace/node-page/__tests__/15-06-identity-merge.test.tsx | `15-06-identity-merge.png` | accepted |
| `15-07-waypoint-editor` | P3 | src/workspace/map/__tests__/15-07-waypoint-editor.test.tsx | `15-07-waypoint-editor.png` | deviation (Ruling 3.6 L413) |
| `15-08-map-menu` | P3 | src/workspace/map/__tests__/15-08-map-menu.test.tsx | `15-08-map-menu.png` | deviation (Ruling 3.6 L425) |
| `15-09-neighbour-peek` | P3 | src/workspace/map/__tests__/15-09-neighbour-peek.test.tsx | `15-09-neighbour-peek.png` | deviation (Ruling 3.1 L288) |
| `15-10-more-filters` | P3 | src/workspace/nodes/__tests__/15-10-more-filters.test.tsx | `15-10-more-filters.png` | deviation (Ruling 3.3 L336) |
| `15-11-node-menus` | P3 | src/workspace/node-page/__tests__/15-11-node-menus.test.tsx | `15-11-node-menus.png` | deviation (Ruling 3.5 L399, 3.5 L400) |
| `15-12-position` | P3 | src/workspace/node-page/__tests__/15-12-position.test.tsx | `15-12-position.png` | accepted |
| `15-13-waypoint-editor` | P3 | src/workspace/map/__tests__/15-13-waypoint-editor.test.tsx | `15-13-waypoint-editor.png` | deviation (Ruling 3.6 L413) |
| `15-14-filters` | P3 | src/workspace/nodes/__tests__/15-14-filters.test.tsx | `15-14-filters.png` | deviation (Ruling 3.3 L336) |
| `15-15-add-from-url` | P3 | src/workspace/nodes/__tests__/15-15-add-from-url.test.tsx | `15-15-add-from-url.png` | accepted |
| `15-16-admin` | P3 | src/workspace/node-page/__tests__/15-16-admin.test.tsx | `15-16-admin.png` | accepted |
| `15-17-traceroute-history` | P3 | src/workspace/node-page/__tests__/15-17-traceroute-history.test.tsx | `15-17-traceroute-history.png` | accepted |
| `15-18-node-dialogs` | P3 | src/workspace/node-page/__tests__/15-18-node-dialogs.test.tsx | `15-18-node-dialogs.png` | deviation (Ruling 3.5 L396, 3.5 L401) |
| `15-19-identity-merge` | P3 | src/workspace/node-page/__tests__/15-19-identity-merge.test.tsx | `15-19-identity-merge.png` | accepted |
| `15-20-long-press-menu` | P3 | src/workspace/map/__tests__/15-20-long-press-menu.test.tsx | `15-20-long-press-menu.png` | deviation (Ruling 3.6 L425) |
| `15-21-neighbour-peek` | P3 | src/workspace/map/__tests__/15-21-neighbour-peek.test.tsx | `15-21-neighbour-peek.png` | accepted |
| `15-22-data-menu` | P3 | src/workspace/node-page/__tests__/15-22-data-menu.test.tsx | `15-22-data-menu.png` | deviation (Ruling 3.5 L399) |
| `15-23-delete-waypoint` | P3 | src/workspace/map/__tests__/15-23-delete-waypoint.test.tsx | `15-23-delete-waypoint.png` | accepted |
| `15-24-geofence` | P3 | src/workspace/map/__tests__/15-24-geofence.test.tsx | `15-24-geofence.png` | deviation (Ruling 3.6 L415) |
| `15-25-request-telemetry` | P3 | src/workspace/node-page/__tests__/15-25-request-telemetry.test.tsx | `15-25-request-telemetry.png` | deviation (Ruling 3.5 L386) |
| `15-26-local-marker` | P3 | src/workspace/map/__tests__/15-26-local-marker.test.tsx | `15-26-local-marker.png` | deviation (Ruling 3.6 L415) |
| `f6-overview` | P4 | src/workspace/overview/__tests__/f6-overview.test.tsx | `f6-overview.png` | deviation (Ruling 4.1 L453, 4.1 L455) |
| `5-01-overview-analysis` | P4 | src/workspace/overview/__tests__/5-01-overview-analysis.test.tsx | `5-01-overview-analysis.png` | deviation (Ruling 4.2 L485) |
| `5-02-layers-analysis` | P4 | src/workspace/overview/__tests__/5-02-layers-analysis.test.tsx | `5-02-layers-analysis.png` | accepted |
| `5-03-time-trails` | P4 | src/workspace/overview/__tests__/5-03-time-trails.test.tsx | `5-03-time-trails.png` | accepted |
| `5-04-link-profile` | P4 | src/workspace/overview/__tests__/5-04-link-profile.test.tsx | `5-04-link-profile.png` | deviation (Ruling 4.2 L485) |
| `5-05-site-planner` | P4 | src/workspace/overview/__tests__/5-05-site-planner.test.tsx | `5-05-site-planner.png` | accepted |
| `5-06-route-segment` | P4 | src/workspace/overview/__tests__/5-06-route-segment.test.tsx | `5-06-route-segment.png` | accepted |
| `5-07-overview-home` | P4 | src/workspace/overview/__tests__/5-07-overview-home.test.tsx | `5-07-overview-home.png` | deviation (Ruling 4.1 L453, 4.1 L461) |
| `5-08-overview-map` | P4 | src/workspace/overview/__tests__/5-08-overview-map.test.tsx | `5-08-overview-map.png` | deviation (Ruling 4.1 L460) |
| `5-09-tools-time` | P4 | src/workspace/overview/__tests__/5-09-tools-time.test.tsx | `5-09-tools-time.png` | deviation (Ruling 4.3 L495) |
| `5-10-inspector-sheet` | P4 | src/workspace/overview/__tests__/5-10-inspector-sheet.test.tsx | `5-10-inspector-sheet.png` | accepted |
| `5-11-link-profile-sheet` | P4 | src/workspace/overview/__tests__/5-11-link-profile-sheet.test.tsx | `5-11-link-profile-sheet.png` | accepted |
| `5-12-layers-sheet` | P4 | src/workspace/overview/__tests__/5-12-layers-sheet.test.tsx | `5-12-layers-sheet.png` | accepted |
| `5-13-planner-dop-sheet` | P4 | src/workspace/overview/__tests__/5-13-planner-dop-sheet.test.tsx | `5-13-planner-dop-sheet.png` | accepted |
| `6-01-reports-list` | P4 | src/workspace/reports/__tests__/6-01-reports-list.test.tsx | `6-01-reports-list.png` | deviation (Ruling 4.4 L513, 4.4 L514, 4.4 L515, 4.4 L516, 4.4 L517) |
| `6-02-mesh-issues` | P4 | src/workspace/reports/__tests__/6-02-mesh-issues.test.tsx | `6-02-mesh-issues.png` | deviation (Ruling 4.4 L519, 4.4 L520, 4.4 L521) |
| `6-03-coverage` | P4 | src/workspace/reports/__tests__/6-03-coverage.test.tsx | `6-03-coverage.png` | deviation (Ruling 4.4 L527, 4.4 L528, 4.4 L529) |
| `6-04-traceroute-explorer` | P4 | src/workspace/reports/__tests__/6-04-traceroute-explorer.test.tsx | `6-04-traceroute-explorer.png` | accepted |
| `6-05-solar` | P4 | src/workspace/reports/__tests__/6-05-solar.test.tsx | `6-05-solar.png` | deviation (Ruling 4.5 L562) |
| `6-06-mqtt-violations` | P4 | src/workspace/reports/__tests__/6-06-mqtt-violations.test.tsx | `6-06-mqtt-violations.png` | deviation (Ruling 4.5 L564) |
| `6-07-nodeinfo-enrichment` | P4 | src/workspace/reports/__tests__/6-07-nodeinfo-enrichment.test.tsx | `6-07-nodeinfo-enrichment.png` | deviation (Ruling 4.5 L556, 4.5 L558) |
| `6-08-reports-list` | P4 | src/workspace/reports/__tests__/6-08-reports-list.test.tsx | `6-08-reports-list.png` | deviation (Ruling 4.4 L513) |
| `6-09-mesh-issues` | P4 | src/workspace/reports/__tests__/6-09-mesh-issues.test.tsx | `6-09-mesh-issues.png` | deviation (Ruling 4.4 L519, 4.4 L523, 4.4 L524) |
| `6-10-coverage` | P4 | src/workspace/reports/__tests__/6-10-coverage.test.tsx | `6-10-coverage.png` | deviation (Ruling 4.4 L529, 4.4 L530, 4.4 L531, 4.4 L532) |
| `6-11-traceroute-explorer` | P4 | src/workspace/reports/__tests__/6-11-traceroute-explorer.test.tsx | `6-11-traceroute-explorer.png` | deviation (Ruling 4.5 CO L549, 4.5 CP L550, 4.5 L560, 4.5 L561) |
| `6-12-solar` | P4 | src/workspace/reports/__tests__/6-12-solar.test.tsx | `6-12-solar.png` | deviation (Ruling 4.5 L562) |
| `6-13-mqtt-violations` | P4 | src/workspace/reports/__tests__/6-13-mqtt-violations.test.tsx | `6-13-mqtt-violations.png` | deviation (Ruling 4.5 CP L550, 4.5 L565) |
| `6-14-nodeinfo-enrichment` | P4 | src/workspace/reports/__tests__/6-14-nodeinfo-enrichment.test.tsx | `6-14-nodeinfo-enrichment.png` | accepted |
| `6-15-mesh-issues-filters` | P4 | src/workspace/reports/__tests__/6-15-mesh-issues-filters.test.tsx | `6-15-mesh-issues-filters.png` | deviation (Ruling 4.4 L526) |
| `7-01-messages` | P4 | src/workspace/overview/__tests__/7-01-messages.test.tsx | `7-01-messages.png` | deviation (Ruling 4.6 L579, 4.6 L580) |
| `7-02-export-messages` | P4 | src/workspace/overview/__tests__/7-02-export-messages.test.tsx | `7-02-export-messages.png` | deviation (Ruling 4.6 CU L574, 4.6 L582) |
| `7-03-telemetry-graphs` | P4 | src/workspace/overview/__tests__/7-03-telemetry-graphs.test.tsx | `7-03-telemetry-graphs.png` | deviation (Ruling 4.7 L594, 4.7 L595) |
| `7-04-telemetry-latest` | P4 | src/workspace/overview/__tests__/7-04-telemetry-latest.test.tsx | `7-04-telemetry-latest.png` | deviation (Ruling 4.7 L594) |
| `7-05-packets` | P4 | src/workspace/overview/__tests__/7-05-packets.test.tsx | `7-05-packets.png` | deviation (Ruling 4.7 L598, 4.7 L599) |
| `7-06-messages` | P4 | src/workspace/overview/__tests__/7-06-messages.test.tsx | `7-06-messages.png` | deviation (Ruling 4.6 L580) |
| `7-07-telemetry` | P4 | src/workspace/overview/__tests__/7-07-telemetry.test.tsx | `7-07-telemetry.png` | deviation (Ruling 4.7 L594) |
| `7-08-packets` | P4 | src/workspace/overview/__tests__/7-08-packets.test.tsx | `7-08-packets.png` | deviation (Ruling 4.7 L598) |
| `7-09-export-messages` | P4 | src/workspace/overview/__tests__/7-09-export-messages.test.tsx | `7-09-export-messages.png` | deviation (Ruling 4.6 L584) |
| `o4-users` | P4 | src/workspace/overview/__tests__/o4-users.test.tsx | `o4-users.png` | deviation (Ruling 4.8 CZ L611, 4.8 L616, 4.8 L617, 4.8 L618, 4.8 L619, 4.8 L620, 4.8 L633) |
| `o5-audit` | P4 | src/workspace/overview/__tests__/o5-audit.test.tsx | `o5-audit.png` | deviation (Ruling 4.8 L630, 4.8 L631, 4.8 L632, 4.8 L633) |
| `q4-permissions` | P4 | src/workspace/overview/__tests__/q4-permissions.test.tsx | `q4-permissions.png` | deviation (Ruling 4.8 CZ L611, 4.8 L617, 4.8 L619, 4.8 L624, 4.8 L633) |
| `13-13-manage-user` | P4 | src/workspace/overview/__tests__/13-13-manage-user.test.tsx | `13-13-manage-user.png` | deviation (Ruling 4.8 L616, 4.8 L626, 4.8 L633) |
| `13-18-users` | P4 | src/workspace/overview/__tests__/13-18-users.test.tsx | `13-18-users.png` | deviation (Ruling 4.8 L627, 4.8 L633) |
| `16-03-audit-log` | P4 | src/workspace/overview/__tests__/16-03-audit-log.test.tsx | `16-03-audit-log.png` | deviation (Ruling 4.8 L630, 4.8 L632, 4.8 L633) |
| `16-08-audit-entry` | P4 | src/workspace/overview/__tests__/16-08-audit-entry.test.tsx | `16-08-audit-entry.png` | deviation (Ruling 4.8 L631, 4.8 L633) |
| `18-01-packets-popout` | P4 | src/workspace/tools/__tests__/18-01-packets-popout.test.tsx | `18-01-packets-popout.png` | deviation (Ruling 4.7 L599, 4.7 L601) |
| `18-02-packets-popout` | P4 | src/workspace/tools/__tests__/18-02-packets-popout.test.tsx | `18-02-packets-popout.png` | deviation (Ruling 4.7 L601) |
| `18-03-mqtt-receptions` | P4 | src/workspace/tools/__tests__/18-03-mqtt-receptions.test.tsx | `18-03-mqtt-receptions.png` | accepted |
| `18-04-mqtt-receptions` | P4 | src/workspace/tools/__tests__/18-04-mqtt-receptions.test.tsx | `18-04-mqtt-receptions.png` | accepted |
| `b-set-d1-lora` | P5 | src/workspace/settings/__tests__/b-set-d1-lora.test.tsx | `b-set-d1-lora.png` | deviation (Ruling 5.3 L698, 5.3 L702, 5.3 L703) |
| `b-set-d2-modules` | P5 | src/workspace/settings/__tests__/b-set-d2-modules.test.tsx | `b-set-d2-modules.png` | deviation (Ruling 5.2 L676) |
| `b-set-d3-review` | P5 | src/workspace/settings/__tests__/b-set-d3-review.test.tsx | `b-set-d3-review.png` | deviation (Ruling 5.3 L701) |
| `b-set-d4-search` | P5 | src/workspace/settings/__tests__/b-set-d4-search.test.tsx | `b-set-d4-search.png` | deviation (Ruling 5.4 L720, 5.4 L722, 5.4 L723) |
| `b-set-d5-notifications` | P5 | src/workspace/settings/__tests__/b-set-d5-notifications.test.tsx | `b-set-d5-notifications.png` | accepted |
| `b-set-d6-remote` | P5 | src/workspace/settings/__tests__/b-set-d6-remote.test.tsx | `b-set-d6-remote.png` | deviation (Ruling 5.9 L889, 5.9 GA L907) |
| `b-set-p1-list` | P5 | src/workspace/settings/__tests__/b-set-p1-list.test.tsx | `b-set-p1-list.png` | accepted |
| `b-set-p2-lora` | P5 | src/workspace/settings/__tests__/b-set-p2-lora.test.tsx | `b-set-p2-lora.png` | deviation (Ruling 5.3 L698) |
| `b-set-p3-sheet` | P5 | src/workspace/settings/__tests__/b-set-p2-lora.test.tsx | `b-set-p3-sheet.png` | deviation (Ruling 5.3 L698) |
| `b-set-p4-modules` | P5 | src/workspace/settings/__tests__/b-set-p4-modules.test.tsx | `b-set-p4-modules.png` | accepted |
| `s2-notifications` | P5 | src/workspace/you/__tests__/s2-notifications.test.tsx | `s2-notifications.png` | deviation (Ruling 5.8 L859) |
| `12-01-channels` | P5 | src/workspace/settings/__tests__/12-01-channels.test.tsx | `12-01-channels.png` | deviation (Ruling 5.5 L752, 5.5 L754) |
| `12-02-channel-edit` | P5 | src/workspace/settings/__tests__/12-02-channel-edit.test.tsx | `12-02-channel-edit.png` | deviation (Ruling 5.5 L755, 5.5 L756, 5.5 L765) |
| `12-03-share-import` | P5 | src/workspace/settings/__tests__/12-03-share-import.test.tsx | `12-03-share-import.png` | deviation (Ruling 5.5 L758) |
| `12-04-security` | P5 | src/workspace/settings/__tests__/12-04-security.test.tsx | `12-04-security.png` + `-latte` | deviation (Ruling 5.5 L761) |
| `12-05-identity` | P5 | src/workspace/settings/__tests__/12-05-identity.test.tsx | `12-05-identity.png` | deviation (Ruling 5.5 L760) |
| `12-06-device-index` | P5 | src/workspace/settings/__tests__/12-06-device-index.test.tsx | `12-06-device-index.png` | deviation (Ruling 5.6 L777, 5.6 L778, 5.6 L779, 5.6 L780) |
| `12-07-modules-index` | P5 | src/workspace/settings/__tests__/12-07-modules-index.test.tsx | `12-07-modules-index.png` | deviation (Ruling 5.2 L678, 5.4 L729) |
| `12-08-maintenance` | P5 | src/workspace/settings/__tests__/12-08-maintenance.test.tsx | `12-08-maintenance.png` | deviation (Ruling 5.7 L803, 5.7 L804) |
| `12-09-firmware-update` | P5 | src/workspace/settings/__tests__/12-09-firmware.test.tsx | `12-09-firmware-update.png` | deviation (Ruling 5.7 L801, 5.7 L824, 5.7 L827) |
| `12-10-danger-confirm` | P5 | src/workspace/settings/__tests__/12-10-danger.test.tsx | `12-10-danger-confirm.png` | accepted |
| `12-11-remote-node-cli` | P5 | src/workspace/settings/__tests__/12-11-remote-node-cli.test.tsx | `12-11-remote-node-cli.png` | deviation (Ruling 5.9 L897) |
| `12-12-meshmonitor-data` | P5 | src/workspace/settings/__tests__/12-12-meshmonitor-data.test.tsx | `12-12-meshmonitor-data.png` | deviation (Ruling 5.8 L843, 5.8 L848, 5.8 L850) |
| `12-13-mqtt-bridge` | P5 | src/workspace/settings/__tests__/12-13-mqtt-bridge.test.tsx | `12-13-mqtt-bridge.png` | accepted |
| `12-14-channels` | P5 | src/workspace/settings/__tests__/12-01-channels.test.tsx | `12-14-channels.png` | deviation (Ruling 5.5 L754) |
| `12-15-channel-edit` | P5 | src/workspace/settings/__tests__/12-02-channel-edit.test.tsx | `12-15-channel-edit.png` | deviation (Ruling 5.5 L755, 5.5 L756) |
| `12-16-share-qr` | P5 | src/workspace/settings/__tests__/12-03-share-import.test.tsx | `12-16-share-qr.png` | accepted |
| `12-17-security` | P5 | src/workspace/settings/__tests__/12-04-security.test.tsx | `12-17-security.png` | deviation (Ruling 5.5 L761) |
| `12-18-maintenance` | P5 | src/workspace/settings/__tests__/12-08-maintenance.test.tsx | `12-18-maintenance.png` | deviation (Ruling 5.7 L803) |
| `12-19-firmware` | P5 | src/workspace/settings/__tests__/12-09-firmware.test.tsx | `12-19-firmware.png` | deviation (Ruling 5.7 L801, 5.7 L824, 5.7 L827, 5.7 L828) |
| `12-20-remote-picker` | P5 | src/workspace/settings/__tests__/12-20-remote-picker.test.tsx | `12-20-remote-picker.png` | accepted |
| `12-21-identity` | P5 | src/workspace/settings/__tests__/12-05-identity.test.tsx | `12-21-identity.png` | accepted |
| `12-22-device-index` | P5 | src/workspace/settings/__tests__/12-22-device-index.test.tsx | `12-22-device-index.png` | deviation (Ruling 5.6 L777, 5.6 L778, 5.6 L779) |
| `12-23-meshmonitor-data` | P5 | src/workspace/settings/__tests__/12-12-meshmonitor-data.test.tsx | `12-23-meshmonitor-data.png` | deviation (Ruling 5.8 L850, 5.8 L851) |
| `12-24-mqtt-bridge` | P5 | src/workspace/settings/__tests__/12-13-mqtt-bridge.test.tsx | `12-24-mqtt-bridge.png` | accepted |
| `12-25-remote-console` | P5 | src/workspace/settings/__tests__/12-25-remote-console.test.tsx | `12-25-remote-console.png` | deviation (Ruling 5.9 L882, 5.9 GA L907) |
| `12-26-security-strict` | P5 | src/workspace/settings/__tests__/12-04-security.test.tsx | `12-26-security-strict.png` | accepted |
| `12-27-restore-confirm` | P5 | src/workspace/settings/__tests__/12-08-maintenance.test.tsx | `12-27-restore-confirm.png` | deviation (Ruling 5.7 L805) |
| `12-28-purge-confirm` | P5 | src/workspace/settings/__tests__/12-10-danger.test.tsx | `12-28-purge-confirm.png` | accepted |
| `12-29-target-actions` | P5 | src/workspace/settings/__tests__/12-25-remote-console.test.tsx | `12-29-target-actions.png` | accepted |
| `18-07-security-balanced` | P5 | src/workspace/settings/__tests__/12-04-security.test.tsx | `18-07-security-balanced.png` | accepted |
| `18-08-security-balanced` | P5 | src/workspace/settings/__tests__/12-04-security.test.tsx | `18-08-security-balanced.png` | accepted |
| `b-set-d7-server` | P6 | src/workspace/server/__tests__/b-set-d7-server.test.tsx | `b-set-d7-server.png` | accepted |
| `b-set-p5-you` | P6 | src/workspace/you/__tests__/b-set-p5-you.test.tsx | `b-set-p5-you.png` | accepted |
| `r1-you-security` | P6 | src/workspace/you/__tests__/r1-you-security.test.tsx | `r1-you-security.png` | deviation (Ruling 6.1 L963) |
| `s4-security` | P6 | src/workspace/you/__tests__/s4-security.test.tsx | `s4-security.png` | deviation (Ruling 6.1 L965) |
| `11-01-sign-in` | P6 | src/workspace/auth/__tests__/11-01-sign-in.test.tsx | `11-01-sign-in.png` | deviation (Ruling 6.2 L988, 6.2 L989, 6.2 L991) |
| `11-02-two-factor-step` | P6 | src/workspace/auth/__tests__/11-02-two-factor-step.test.tsx | `11-02-two-factor-step.png` | deviation (Ruling 6.2 L992, 6.2 L993) |
| `11-03-set-up-two-factor` | P6 | src/workspace/you/__tests__/11-03-set-up-two-factor.test.tsx | `11-03-set-up-two-factor.png` | deviation (Ruling 6.1 L968) |
| `11-04-passkey-only` | P6 | src/workspace/you/__tests__/11-04-passkey-only.test.tsx | `11-04-passkey-only.png` | accepted |
| `11-05-api-token` | P6 | src/workspace/you/__tests__/11-05-api-token.test.tsx | `11-05-api-token.png` | deviation (Ruling 6.1 L972) |
| `11-06-change-password` | P6 | src/workspace/you/__tests__/11-06-change-password.test.tsx | `11-06-change-password.png` | accepted |
| `11-07-sign-in` | P6 | src/workspace/auth/__tests__/11-07-sign-in.test.tsx | `11-07-sign-in.png` | deviation (Ruling 6.2 L988) |
| `11-08-two-factor-step` | P6 | src/workspace/auth/__tests__/11-08-two-factor-step.test.tsx | `11-08-two-factor-step.png` | deviation (Ruling 6.2 L992) |
| `11-09-recovery-code` | P6 | src/workspace/auth/__tests__/11-09-recovery-code.test.tsx | `11-09-recovery-code.png` | deviation (Ruling 6.2 L994) |
| `11-10-set-up-two-factor` | P6 | src/workspace/you/__tests__/11-03-set-up-two-factor.test.tsx | `11-10-set-up-two-factor.png` | accepted |
| `11-11-passkeys` | P6 | src/workspace/you/__tests__/11-11-passkeys.test.tsx | `11-11-passkeys.png` | deviation (Ruling 6.1 L967) |
| `11-12-passkey-only` | P6 | src/workspace/you/__tests__/11-04-passkey-only.test.tsx | `11-12-passkey-only.png` | accepted |
| `11-13-api-token` | P6 | src/workspace/you/__tests__/11-05-api-token.test.tsx | `11-13-api-token.png` | accepted |
| `13-01-appearance` | P6 | src/workspace/you/preferences/__tests__/13-01-appearance.test.tsx | `13-01-appearance.png` + `-latte` | deviation (Ruling 6.3 L1009, 6.3 L1011, 6.3 L1012) |
| `13-02-theme-editor` | P6 | src/workspace/you/preferences/__tests__/13-02-theme-editor.test.tsx | `13-02-theme-editor.png` | deviation (Ruling 6.3 L1014) |
| `13-03-language-units` | P6 | src/workspace/you/preferences/__tests__/13-03-language-units.test.tsx | `13-03-language-units.png` | deviation (Ruling 6.3 L1009, 6.3 L1015) |
| `13-04-map-prefs` | P6 | src/workspace/you/preferences/__tests__/13-04-map-prefs.test.tsx | `13-04-map-prefs.png` | deviation (Ruling 6.3 L1009, 6.3 L1016) |
| `13-05-map-tiles` | P6 | src/workspace/server/__tests__/13-05-map-tiles.test.tsx | `13-05-map-tiles.png` | deviation (Ruling 6.4 L1053) |
| `13-06-embed` | P6 | src/workspace/server/__tests__/13-06-embed.test.tsx | `13-06-embed.png` | deviation (Ruling 6.4 L1055) |
| `13-07-backup-maintenance` | P6 | src/workspace/server/__tests__/13-07-backup-maintenance.test.tsx | `13-07-backup-maintenance.png` | deviation (Ruling 6.4 L1044) |
| `13-08-channel-database` | P6 | src/workspace/server/__tests__/13-08-channel-database.test.tsx | `13-08-channel-database.png` | deviation (Ruling 6.4 L1049, 6.4 L1050) |
| `13-09-scripts` | P6 | src/workspace/server/__tests__/13-09-scripts.test.tsx | `13-09-scripts.png` | accepted |
| `13-10-background-jobs` | P6 | src/workspace/server/__tests__/13-10-background-jobs.test.tsx | `13-10-background-jobs.png` | deviation (Ruling 6.5 L1071, 6.5 L1073) |
| `13-11-integrations` | P6 | src/workspace/server/__tests__/13-11-integrations.test.tsx | `13-11-integrations.png` | accepted |
| `13-12-security-privacy` | P6 | src/workspace/server/__tests__/13-12-security-privacy.test.tsx | `13-12-security-privacy.png` | deviation (Ruling 6.5 L1075, 6.5 L1076) |
| `13-14-help-about` | P6 | src/workspace/you/preferences/__tests__/13-14-help-about.test.tsx | `13-14-help-about.png` | deviation (Ruling 6.3 L1020) |
| `13-15-appearance` | P6 | src/workspace/you/preferences/__tests__/13-01-appearance.test.tsx | `13-15-appearance.png` | accepted |
| `13-16-server-list` | P6 | src/workspace/server/__tests__/13-16-server-list.test.tsx | `13-16-server-list.png` | deviation (Ruling 6.4 L1040) |
| `13-17-channel-database` | P6 | src/workspace/server/__tests__/13-08-channel-database.test.tsx | `13-17-channel-database.png` | accepted |
| `13-19-theme-editor` | P6 | src/workspace/you/preferences/__tests__/13-02-theme-editor.test.tsx | `13-19-theme-editor.png` | accepted |
| `13-20-language-units` | P6 | src/workspace/you/preferences/__tests__/13-03-language-units.test.tsx | `13-20-language-units.png` | accepted |
| `13-21-map-prefs` | P6 | src/workspace/you/preferences/__tests__/13-04-map-prefs.test.tsx | `13-21-map-prefs.png` | accepted |
| `13-22-map-tiles` | P6 | src/workspace/server/__tests__/13-05-map-tiles.test.tsx | `13-22-map-tiles.png` | accepted |
| `13-23-embed` | P6 | src/workspace/server/__tests__/13-06-embed.test.tsx | `13-23-embed.png` | accepted |
| `13-24-backup-maintenance` | P6 | src/workspace/server/__tests__/13-07-backup-maintenance.test.tsx | `13-24-backup-maintenance.png` | deviation (Ruling 6.4 L1047) |
| `13-25-scripts` | P6 | src/workspace/server/__tests__/13-09-scripts.test.tsx | `13-25-scripts.png` | accepted |
| `13-26-background-jobs` | P6 | src/workspace/server/__tests__/13-10-background-jobs.test.tsx | `13-26-background-jobs.png` | accepted |
| `13-27-integrations` | P6 | src/workspace/server/__tests__/13-11-integrations.test.tsx | `13-27-integrations.png` | accepted |
| `13-28-security-privacy` | P6 | src/workspace/server/__tests__/13-12-security-privacy.test.tsx | `13-28-security-privacy.png` | accepted |
| `13-29-help-about` | P6 | src/workspace/you/preferences/__tests__/13-14-help-about.test.tsx | `13-29-help-about.png` | accepted |
| `18-09-add-reticulum` | P6 | src/workspace/devices/__tests__/h2-add-connection.test.tsx | `18-09-add-reticulum.png` | accepted |
| `18-10-add-reticulum` | P6 | src/workspace/devices/__tests__/h2-add-connection.test.tsx | `18-10-add-reticulum.png` | accepted |
| `18-11-notification-services` | P6 | src/workspace/server/__tests__/18-11-notification-services.test.tsx | `18-11-notification-services.png` | accepted |
| `18-12-notification-services` | P6 | src/workspace/server/__tests__/18-11-notification-services.test.tsx | `18-12-notification-services.png` | accepted |
| `h1-add-type` | P6 | src/workspace/devices/__tests__/h1-add-type.test.tsx | `h1-add-type.png` | deviation (Ruling 6.6 L1120) |
| `h2-add-connection` | P6 | src/workspace/devices/__tests__/h2-add-connection.test.tsx | `h2-add-connection.png` | deviation (Ruling 6.6 HA L1105, 6.6 L1108) |
| `h3-add-connect` | P6 | src/workspace/devices/__tests__/h3-add-connect.test.tsx | `h3-add-connect.png` | deviation (Ruling 6.6 L1108, 6.6 L1116, 6.6 L1118) |
| `h4-server-devices` | P6 | src/workspace/devices/__tests__/h4-server-devices.test.tsx | `h4-server-devices.png` | deviation (Ruling 6.6 HA L1105, 6.6 L1110, 6.6 L1131) |
| `h5-offline` | P6 | src/workspace/devices/__tests__/h5-offline.test.tsx | `h5-offline.png` | deviation (Ruling 6.7 L1139, 6.7 L1140, 6.7 L1141, 6.7 L1142, 6.7 L1144, 6.7 L1145, 6.7 L1146, 6.7 L1160) |
| `h6-first-run` | P6 | src/workspace/devices/__tests__/h6-first-run.test.tsx | `h6-first-run.png` | accepted |
| `i1-add-type` | P6 | src/workspace/devices/__tests__/h1-add-type.test.tsx | `i1-add-type.png` | accepted |
| `i2-meshcore` | P6 | src/workspace/devices/__tests__/h2-add-connection.test.tsx | `i2-meshcore.png` | deviation (Ruling 6.6 L1111, 6.6 L1112) |
| `i3-failed` | P6 | src/workspace/devices/__tests__/h3-add-connect.test.tsx | `i3-failed.png` | deviation (Ruling 6.6 L1108, 6.6 L1118, 6.6 L1130) |
| `i4-offline` | P6 | src/workspace/devices/__tests__/i4-offline.test.tsx | `i4-offline.png` | deviation (Ruling 6.7 L1139, 6.7 L1140, 6.7 L1142, 6.7 L1144) |
| `i5-receive-only` | P6 | src/workspace/chat/__tests__/i5-receive-only.test.tsx | `i5-receive-only.png` | deviation (Ruling 6.7 L1150, 6.7 L1151) |
| `i6-guest` | P6 | src/workspace/shell/__tests__/i6-guest.test.tsx | `i6-guest.png` | deviation (Ruling 6.7 L1154, 6.7 L1156) |
| `g6-meshcore` | P7 | src/workspace/meshcore/__tests__/g6-meshcore.test.tsx | `g6-meshcore.png` | deviation (Ruling 7.2 L1250) |
| `8-01-heltec-shell` | P7 | src/workspace/meshcore/__tests__/8-01-heltec-shell.test.tsx | `8-01-heltec-shell.png` | deviation (Ruling 7.1 L1213, 7.1 L1215, 7.1 L1218, 7.1 L1219, 7.1 L1221) |
| `8-02-route-details` | P7 | src/workspace/meshcore/__tests__/8-02-route-details.test.tsx | `8-02-route-details.png` | deviation (Ruling 7.1 L1217) |
| `8-03-room-login` | P7 | src/workspace/meshcore/__tests__/8-03-room-login.test.tsx | `8-03-room-login.png` | deviation (Ruling 7.1 L1225) |
| `8-04-room-posts` | P7 | src/workspace/meshcore/__tests__/8-04-room-posts.test.tsx | `8-04-room-posts.png` | deviation (Ruling 7.1 L1213, 7.1 L1215) |
| `8-05-companion-contact` | P7 | src/workspace/meshcore/__tests__/8-05-companion-contact.test.tsx | `8-05-companion-contact.png` | deviation (Ruling 7.2 L1245, 7.2 L1247, 7.2 L1249, 7.2 L1256) |
| `8-06-repeater-console` | P7 | src/workspace/meshcore/__tests__/8-06-repeater-console.test.tsx | `8-06-repeater-console.png` | deviation (Ruling 7.3 L1275, 7.3 L1277, 7.3 L1285, 7.3 L1291, 7.3 L1292) |
| `8-07-repeater-settings` | P7 | src/workspace/meshcore/__tests__/8-07-repeater-settings.test.tsx | `8-07-repeater-settings.png` | deviation (Ruling 7.3 L1279, 7.3 L1285) |
| `8-08-settings-radio` | P7 | src/workspace/meshcore/__tests__/8-08-settings-radio.test.tsx | `8-08-settings-radio.png` | accepted |
| `8-09-channels` | P7 | src/workspace/meshcore/__tests__/8-09-channels.test.tsx | `8-09-channels.png` | deviation (Ruling 7.4 L1320) |
| `8-10-maintenance` | P7 | src/workspace/meshcore/__tests__/8-10-maintenance.test.tsx | `8-10-maintenance.png` | deviation (Ruling 7.4 L1324, 7.4 L1325, 7.4 L1326) |
| `8-11-nodes` | P7 | src/workspace/meshcore/__tests__/8-11-nodes.test.tsx | `8-11-nodes.png` | deviation (Ruling 7.2 L1252) |
| `8-12-packet-detail` | P7 | src/workspace/meshcore/__tests__/8-12-packet-detail.test.tsx | `8-12-packet-detail.png` | deviation (Ruling 7.5 L1353, 7.5 L1355, 7.5 L1361) |
| `8-13-info` | P7 | src/workspace/meshcore/__tests__/8-13-info.test.tsx | `8-13-info.png` | deviation (Ruling 7.5 L1351, 7.5 L1361) |
| `8-14-automations` | P7 | src/workspace/meshcore/__tests__/8-14-automations.test.tsx | `8-14-automations.png` | deviation (Ruling 7.5 L1352, 7.5 L1356) |
| `8-15-mqtt-region-feed` | P7 | src/workspace/meshcore/__tests__/8-15-region-feed.test.tsx | `8-15-mqtt-region-feed.png` | accepted |
| `8-16-meshcore-home` | P7 | src/workspace/meshcore/__tests__/8-16-meshcore-home.test.tsx | `8-16-meshcore-home.png` | deviation (Ruling 7.1 L1221, 7.1 L1236) |
| `8-17-room-login` | P7 | src/workspace/meshcore/__tests__/8-17-room-login.test.tsx | `8-17-room-login.png` | accepted |
| `8-18-room-posts` | P7 | src/workspace/meshcore/__tests__/8-18-room-posts.test.tsx | `8-18-room-posts.png` | deviation (Ruling 7.1 L1213, 7.1 L1215) |
| `8-19-channel-thread` | P7 | src/workspace/meshcore/__tests__/8-19-channel-thread.test.tsx | `8-19-channel-thread.png` | accepted |
| `8-20-companion-contact` | P7 | src/workspace/meshcore/__tests__/8-20-companion-contact.test.tsx | `8-20-companion-contact.png` | deviation (Ruling 7.2 L1245, 7.2 L1249) |
| `8-21-repeater-console` | P7 | src/workspace/meshcore/__tests__/8-21-repeater-console.test.tsx | `8-21-repeater-console.png` | deviation (Ruling 7.3 L1274, 7.3 L1275, 7.3 L1277, 7.3 L1285, 7.3 L1292) |
| `8-22-settings-list` | P7 | src/workspace/meshcore/__tests__/8-22-settings-list.test.tsx | `8-22-settings-list.png` | accepted |
| `8-23-region-feed` | P7 | src/workspace/meshcore/__tests__/8-15-region-feed.test.tsx | `8-23-region-feed.png` | accepted |
| `8-24-route-details` | P7 | src/workspace/meshcore/__tests__/8-24-route-details.test.tsx | `8-24-route-details.png` | deviation (Ruling 7.1 L1217) |
| `8-25-repeater-settings` | P7 | src/workspace/meshcore/__tests__/8-25-repeater-settings.test.tsx | `8-25-repeater-settings.png` | deviation (Ruling 7.3 L1279, 7.3 L1285) |
| `8-26-channels` | P7 | src/workspace/meshcore/__tests__/8-09-channels.test.tsx | `8-26-channels.png` | deviation (Ruling 7.4 L1320) |
| `8-27-maintenance` | P7 | src/workspace/meshcore/__tests__/8-10-maintenance.test.tsx | `8-27-maintenance.png` | deviation (Ruling 7.4 L1324, 7.4 L1325) |
| `8-28-nodes-discover` | P7 | src/workspace/meshcore/__tests__/8-28-nodes-discover.test.tsx | `8-28-nodes-discover.png` | deviation (Ruling 7.2 L1252, 7.2 L1260) |
| `8-29-packet-detail` | P7 | src/workspace/meshcore/__tests__/8-12-packet-detail.test.tsx | `8-29-packet-detail.png` | accepted |
| `8-30-info` | P7 | src/workspace/meshcore/__tests__/8-13-info.test.tsx | `8-30-info.png` | accepted |
| `8-31-automations` | P7 | src/workspace/meshcore/__tests__/8-14-automations.test.tsx | `8-31-automations.png` | accepted |
| `9-01-reticulum-shell` | P7 | src/workspace/reticulum/__tests__/9-01-reticulum-shell.test.tsx | `9-01-reticulum-shell.png` | deviation (Ruling 7.6 L1371, 7.6 L1373) |
| `9-02-destinations` | P7 | src/workspace/reticulum/__tests__/9-02-destinations.test.tsx | `9-02-destinations.png` | accepted |
| `9-03-interfaces` | P7 | src/workspace/reticulum/__tests__/9-03-interfaces-paths.test.tsx | `9-03-interfaces.png` | accepted |
| `9-04-paths` | P7 | src/workspace/reticulum/__tests__/9-03-interfaces-paths.test.tsx | `9-04-paths.png` | accepted |
| `9-05-map-connections` | P7 | src/workspace/reticulum/__tests__/9-05-map-connections.test.tsx | `9-05-map-connections.png` | accepted |
| `9-06-settings-identity` | P7 | src/workspace/reticulum/__tests__/9-06-settings.test.tsx | `9-06-settings-identity.png` | accepted |
| `9-07-settings-rnode` | P7 | src/workspace/reticulum/__tests__/9-06-settings.test.tsx | `9-07-settings-rnode.png` | accepted |
| `9-08-info` | P7 | src/workspace/reticulum/__tests__/9-08-info.test.tsx | `9-08-info.png` | accepted |
| `9-09-reticulum-home` | P7 | src/workspace/reticulum/__tests__/9-01-reticulum-shell.test.tsx | `9-09-reticulum-home.png` | deviation (Ruling 7.6 L1390, 7.6 L1391) |
| `9-10-lxmf-thread` | P7 | src/workspace/reticulum/__tests__/9-01-reticulum-shell.test.tsx | `9-10-lxmf-thread.png` | deviation (Ruling 7.6 L1373) |
| `9-11-destinations` | P7 | src/workspace/reticulum/__tests__/9-02-destinations.test.tsx | `9-11-destinations.png` | accepted |
| `9-12-interfaces-paths` | P7 | src/workspace/reticulum/__tests__/9-03-interfaces-paths.test.tsx | `9-12-interfaces-paths.png` | accepted |
| `9-13-settings-list` | P7 | src/workspace/reticulum/__tests__/9-06-settings.test.tsx | `9-13-settings-list.png` | deviation (Ruling 7.6 L1392) |
| `9-14-map-connections` | P7 | src/workspace/reticulum/__tests__/9-05-map-connections.test.tsx | `9-14-map-connections.png` | accepted |
| `9-15-settings-identity` | P7 | src/workspace/reticulum/__tests__/9-06-settings.test.tsx | `9-15-settings-identity.png` | accepted |
| `9-16-info` | P7 | src/workspace/reticulum/__tests__/9-08-info.test.tsx | `9-16-info.png` | accepted |
| `j1-dashboard` | P8 | src/workspace/dashboard/__tests__/j1-dashboard.test.tsx | `j1-dashboard.png` | deviation (Ruling 8.1 L1456, 8.1 L1458, 8.1 L1460, 8.1 L1461) |
| `j2-dashboard-edit` | P8 | src/workspace/dashboard/__tests__/j2-dashboard-edit.test.tsx | `j2-dashboard-edit.png` | deviation (Ruling 8.1 L1460, 8.1 L1463, 8.1 L1464, 8.1 L1471) |
| `j3-overview-dashboard` | P8 | src/workspace/dashboard/__tests__/j3-overview-dashboard.test.tsx | `j3-overview-dashboard.png` | deviation (Ruling 8.2 L1486, 8.2 L1487, 8.2 L1488, 8.2 L1489, 8.2 L1492, 8.2 L1493, 8.2 L1500) |
| `k1-dashboard` | P8 | src/workspace/dashboard/__tests__/j1-dashboard.test.tsx | `k1-dashboard.png` | deviation (Ruling 8.1 L1456, 8.1 L1458) |
| `k2-dashboard-edit` | P8 | src/workspace/dashboard/__tests__/j2-dashboard-edit.test.tsx | `k2-dashboard-edit.png` | deviation (Ruling 8.1 L1460, 8.1 L1462) |
| `k3-add-widget` | P8 | src/workspace/dashboard/__tests__/j2-dashboard-edit.test.tsx | `k3-add-widget.png` | deviation (Ruling 8.1 L1460, 8.1 L1464) |
| `16-04-overview-dashboard` | P8 | src/workspace/dashboard/__tests__/j3-overview-dashboard.test.tsx | `16-04-overview-dashboard.png` | deviation (Ruling 8.2 L1486, 8.2 L1487, 8.2 L1488, 8.2 L1492, 8.2 L1493, 8.2 L1500) |
| `m1-automations` | P8 | src/workspace/automations/__tests__/m1-automations.test.tsx | `m1-automations.png` | accepted |
| `m2-rule` | P8 | src/workspace/automations/__tests__/m2-rule.test.tsx | `m2-rule.png` | deviation (Ruling 8.4 L1561) |
| `m3-builtin` | P8 | src/workspace/automations/__tests__/14-08-auto-acknowledge.test.tsx | `m3-builtin.png` | deviation (Ruling 8.3 L1531, 8.3 L1532, 8.3 L1546) |
| `m4-runs` | P8 | src/workspace/automations/__tests__/m4-runs.test.tsx | `m4-runs.png` | deviation (Ruling 8.4 L1564, 8.4 L1566) |
| `n1-automations` | P8 | src/workspace/automations/__tests__/m1-automations.test.tsx | `n1-automations.png` | accepted |
| `n2-rule` | P8 | src/workspace/automations/__tests__/m2-rule.test.tsx | `n2-rule.png` | deviation (Ruling 8.4 L1561, 8.4 L1563) |
| `n3-when` | P8 | src/workspace/automations/__tests__/m2-rule.test.tsx | `n3-when.png` | deviation (Ruling 8.4 L1562) |
| `n4-builtin` | P8 | src/workspace/automations/__tests__/n4-builtin.test.tsx | `n4-builtin.png` | deviation (Ruling 8.3 L1531, 8.3 L1540) |
| `14-01-overview-automations` | P8 | src/workspace/automations/__tests__/14-01-overview-automations.test.tsx | `14-01-overview-automations.png` | deviation (Ruling 8.4 L1575) |
| `14-02-variables` | P8 | src/workspace/automations/__tests__/14-02-variables.test.tsx | `14-02-variables.png` | accepted |
| `14-03-templates-wizard` | P8 | src/workspace/automations/__tests__/14-03-templates-wizard.test.tsx | `14-03-templates-wizard.png` | accepted |
| `14-04-live-trace` | P8 | src/workspace/automations/__tests__/14-04-live-trace.test.tsx | `14-04-live-trace.png` | deviation (Ruling 8.4 L1568) |
| `14-05-builtins-list` | P8 | src/workspace/automations/__tests__/14-05-builtins-list.test.tsx | `14-05-builtins-list.png` | accepted |
| `14-06-auto-responder` | P8 | src/workspace/automations/__tests__/14-06-auto-responder.test.tsx | `14-06-auto-responder.png` | deviation (Ruling 8.3 L1534, 8.3 L1535) |
| `14-07-geofence-trigger` | P8 | src/workspace/automations/__tests__/14-07-geofence-trigger.test.tsx | `14-07-geofence-trigger.png` | deviation (Ruling 8.3 L1533, 8.3 L1535) |
| `14-08-auto-acknowledge` | P8 | src/workspace/automations/__tests__/14-08-auto-acknowledge.test.tsx | `14-08-auto-acknowledge.png` | deviation (Ruling 8.3 L1533) |
| `14-09-overview-automations` | P8 | src/workspace/automations/__tests__/14-01-overview-automations.test.tsx | `14-09-overview-automations.png` | accepted |
| `14-10-variables` | P8 | src/workspace/automations/__tests__/14-02-variables.test.tsx | `14-10-variables.png` | accepted |
| `14-11-template-wizard` | P8 | src/workspace/automations/__tests__/14-03-templates-wizard.test.tsx | `14-11-template-wizard.png` | accepted |
| `14-12-responder-trigger` | P8 | src/workspace/automations/__tests__/14-06-auto-responder.test.tsx | `14-12-responder-trigger.png` | accepted |
| `14-13-runs-trace` | P8 | src/workspace/automations/__tests__/m4-runs.test.tsx | `14-13-runs-trace.png` | deviation (Ruling 8.4 L1564) |
| `14-14-builtins-list` | P8 | src/workspace/automations/__tests__/14-05-builtins-list.test.tsx | `14-14-builtins-list.png` | accepted |
| `14-15-geofence-trigger` | P8 | src/workspace/automations/__tests__/14-07-geofence-trigger.test.tsx | `14-15-geofence-trigger.png` | deviation (Ruling 8.3 L1533) |
| `14-16-auto-acknowledge` | P8 | src/workspace/automations/__tests__/14-08-auto-acknowledge.test.tsx | `14-16-auto-acknowledge.png` | deviation (Ruling 8.3 L1533) |
| `o1-packets` | P8 | src/workspace/tools/__tests__/o1-packets.test.tsx | `o1-packets.png` | deviation (Ruling 8.5 L1593, 8.5 L1602) |
| `o2-info` | P8 | src/workspace/tools/__tests__/o2-info.test.tsx | `o2-info.png` | deviation (Ruling 8.5 L1594, 8.5 L1595) |
| `o3-security` | P8 | src/workspace/tools/__tests__/o3-security.test.tsx | `o3-security.png` | deviation (Ruling 8.5 L1600) |
| `q1-tools` | P8 | src/workspace/tools/__tests__/q1-tools.test.tsx | `q1-tools.png` | accepted |
| `q2-packets` | P8 | src/workspace/tools/__tests__/o1-packets.test.tsx | `q2-packets.png` | deviation (Ruling 8.5 L1592, 8.5 L1604) |
| `q3-packet` | P8 | src/workspace/tools/__tests__/o1-packets.test.tsx | `q3-packet.png` | deviation (Ruling 8.5 L1593) |
| `16-01-info` | P8 | src/workspace/tools/__tests__/o2-info.test.tsx | `16-01-info.png` | deviation (Ruling 8.5 L1592, 8.5 L1594, 8.5 L1595) |
| `16-02-security` | P8 | src/workspace/tools/__tests__/o3-security.test.tsx | `16-02-security.png` | accepted |
| `16-05-security-digest` | P8 | src/workspace/tools/__tests__/o3-security.test.tsx | `16-05-security-digest.png` | accepted |
| `16-06-quiet-nodes` | P8 | src/workspace/tools/__tests__/16-06-quiet-nodes.test.tsx | `16-06-quiet-nodes.png` | deviation (Ruling 8.5 L1592, 8.5 L1606) |
| `16-07-delete-nodes` | P8 | src/workspace/tools/__tests__/16-06-quiet-nodes.test.tsx | `16-07-delete-nodes.png` | deviation (Ruling 8.5 L1592, 8.5 L1605) |
| `17-01-confirm-patterns` | P9 | src/workspace/patterns/__tests__/17-01-confirm-patterns.test.tsx | `17-01-confirm-patterns.png` | deviation (Ruling 9.1 L1649, 9.1 L1650) |
| `17-02-confirm-sheets` | P9 | src/workspace/settings/__tests__/12-02-channel-edit.test.tsx | `17-02-confirm-sheets.png` | accepted |
| `17-03-toasts-reboot` | P9 | src/workspace/patterns/__tests__/17-03-toasts-reboot.test.tsx | `17-03-toasts-reboot.png` | deviation (Ruling 9.1 L1652, 9.1 L1656) |
| `17-04-states` | P9 | src/workspace/patterns/__tests__/17-04-states.test.tsx | `17-04-states.png` | deviation (Ruling 9.1 L1657) |
| `17-05-privacy-document` | P9 | src/workspace/misc/__tests__/publicPages.test.tsx (routing and content, no expectBoard; Ruling 9.2 IP) | `17-05-privacy-document.png` | deviation (Ruling 9.2 L1693) |
| `17-06-embed-map` | P9 | src/workspace/misc/__tests__/publicPages.test.tsx (routing and content, no expectBoard; Ruling 9.2 IP) | `17-06-embed-map.png` | deviation (Ruling 9.2 L1693) |
| `17-07-outlier-cleanup` | P9 | src/workspace/misc/__tests__/17-07-outlier-cleanup.test.tsx | `17-07-outlier-cleanup.png` | deviation (Ruling 9.2 L1680, 9.2 L1682) |
| `17-08-broker-presets` | P9 | src/workspace/misc/__tests__/17-08-broker-presets.test.tsx | `17-08-broker-presets.png` | deviation (Ruling 9.2 L1687, 9.2 L1689) |
| `17-09-news` | P9 | src/workspace/misc/__tests__/17-09-news.test.tsx | `17-09-news.png` | accepted |
| `17-10-toasts-reboot` | P9 | src/workspace/patterns/__tests__/17-03-toasts-reboot.test.tsx | `17-10-toasts-reboot.png` | deviation (Ruling 9.1 L1652, 9.1 L1655) |
| `17-11-states` | P9 | src/workspace/patterns/__tests__/17-04-states.test.tsx | `17-11-states.png` | deviation (Ruling 9.1 L1658) |
| `17-12-privacy-document` | P9 | src/workspace/misc/__tests__/publicPages.test.tsx (routing and content, no expectBoard; Ruling 9.2 IP) | `17-12-privacy-document.png` | deviation (Ruling 9.2 L1693) |
| `17-13-embed-map` | P9 | src/workspace/misc/__tests__/publicPages.test.tsx (routing and content, no expectBoard; Ruling 9.2 IP) | `17-13-embed-map.png` | deviation (Ruling 9.2 L1693) |
| `17-14-outlier-cleanup` | P9 | src/workspace/misc/__tests__/17-07-outlier-cleanup.test.tsx | `17-14-outlier-cleanup.png` | deviation (Ruling 9.2 L1680) |
| `17-15-broker-presets` | P9 | src/workspace/misc/__tests__/17-08-broker-presets.test.tsx | `17-15-broker-presets.png` | deviation (Ruling 9.2 L1689) |
| `17-16-news` | P9 | src/workspace/misc/__tests__/17-09-news.test.tsx | `17-16-news.png` | accepted |

Excluded (6, rejected chat options A/B/C, not built): a-chat-A-desktop, a-chat-A-phone, a-chat-B-desktop, a-chat-B-phone, a-chat-C-desktop, a-chat-C-phone.

How status was decided:

- I grepped every ruling (ledger and progress-only) for each board's full id and its short id (`10-01`, `b-set-d3`, `j1`), and read each of the 595 rulings that matched.
- **deviation** means at least one ruling naming the board records a departure from what the board or its section note draws: a control, row, column, figure or line not built or built differently (D9c/D9d), different wording where today's en.json copy replaced the board's words (D9b), or a different placement or layer (sheet versus modal, dock versus banner). The cell lists those rulings as task, code if any, and ledger line (`L761` is line 761 of `docs/superpowers/workspace-ledger.md`; the Rulings section below reproduces it).
- These do **not** make a board a deviation: case-only check swaps (`"Purge all messages"` → `"Purge All Messages"`), Ruling Q drops of CSS-uppercased text, placeholders, aria-labels and input values (the board's text is still on screen), D9a colour tokens, test-method and fixture rulings, permission gates that match today, staged strings later un-staged, and rulings superseded later (for example 5.7 ER by EW, 5.8 MQTT bridge by FD, 6.1 r2 "Language" by 6.3's merged page).
- The `r1` hits from Tasks 2.3/2.4 are "round 1" notes about the DM sidebar, not board r1-you-security, and were ignored. Rulings that name a page but no board id were not attributed to a board.
- Test file is the file whose `expectBoard('<board>'` call checks the board, or the file that passes the board id to `expectBoard` through a variable. Five boards have no `expectBoard` and are covered as noted in the cell.

## Rulings

**1331 rulings**: 1313 from the committed ledger (1300 `Ruling:` lines, 12 written `Ruling XX:` or `Ruling IV`, and the F.2 parked line that carries Ruling IZ), 7 that are only in progress.md, and 11 that are only in f2-report.md. Each is verbatim, prefixed with its line number in its source file and grouped under the source's section heading.

### From docs/superpowers/workspace-ledger.md

#### Rulings

- **L15** Ruling: controller A — preflight rulings live here until Task 0.2 creates docs/superpowers/workspace-ledger.md; the controller copies them in at Task 0.2 completion — why: ledger file is a 0.2 deliverable — cost if wrong: none.
- **L16** Ruling: controller B — 5.9 may edit AdminCommandsTab only to consume logic extracted into hooks (Rule X); "untouched" in D15 means look and behaviour, not bytes — why: spec Global Constraint permits behaviour-preserving extraction; otherwise 5.9 would duplicate ~1k lines — cost if wrong: a Classic file diff the requester may question; Classic tests guard behaviour.
- **L17** Ruling: controller C — todos are tracked per phase; per-task state lives in this ledger — why: 52 tasks; ledger is the recovery map — cost: none.
- **L18** Ruling: controller D — models — implementers: sonnet for mechanical/backend tasks, opus for shell/settings-frame/integration tasks; task reviewers: sonnet (opus for 1.3–1.5, 2.2, 5.1–5.3, 5.9, 6.6 Rule X/routing tasks); final review: opus — why: cost vs risk — cost if wrong: extra fix rounds.
- **L19** Ruling: controller E — TG runs with NODE_OPTIONS=--max-old-space-size=8192 (tsc/eslint OOM at default heap on clean HEAD in this container) — why: environment limit, not code — cost: none.
- **L20** Ruling: controller F — lint:ci in-repo filter also drops design-scratch/ (git-excluded, like .claude/worktrees): `npm run lint:ci 2>&1 | grep '^FAIL' | grep -v -e '.claude/worktrees' -e 'design-scratch/'` — why: CI never sees it — cost: none.
- **L21** Ruling: controller G — implementer rulings from 0.1 report lines 71-79 adopted, except line 76 (superseded by 3af973e: fonts bundled as Vite assets + renderBuiltUrl css relative) — cost: none.
- **L22** Ruling: controller H — Task 0.2 step 4 (write missing checks) is split out to an independent check-writer agent after the implementer; implementer's port script exits 1 until then — why: implementers cannot dispatch agents and the plan wants grader ≠ builder — cost: one extra commit.
- **L23** Ruling: controller I — board-check matching stays case-sensitive exact substring; en.json spelling/case differences (Favourites/Favorites etc., in written AND ported checks) are swapped per board at build time under D9b with a Ruling and a check edit (spec §9.1) — why: spec already prescribes it; case-insensitive matching would loosen absent checks — cost: per-board check edits during build.
- **L24** Ruling: controller J — fixture cast names (Station G2, Rooftop RAK, Heltec MeshCore, Athens MQTT, Reticulum node) are legitimate must strings — why: spec §10 fixes the cast — cost: none.
- **L25** Ruling: 0.1 — renderWorkspace overrides i18n by making the global react-i18next mock delegate to the real hook and Trans inside a real I18nextProvider (`withRealProvider` in src/test/mockI18n.ts), rather than a per-file `vi.unmock` — why: the BP2 board-test template imports only renderWorkspace, and `vi.unmock` order-depends on import order — cost if wrong: the global setup changes back to the plain mock, and each Workspace test file adds `vi.unmock('react-i18next')`.
- **L26** Ruling: 0.1 — renderWorkspace defaults to a signed-in admin; passing `permissions` makes the user a non-admin unless `isAdmin` is given; `anonymous` gives `authenticated:false` with the given (default empty) permissions — why: board tests mostly show the full UI, and partial-permission tests pass grants — cost if wrong: flip the default in `authStatusFor`.
- **L27** Ruling: 0.1 — phone matchMedia evaluates min-width and max-width queries at a 390 px width (1280 px otherwise), not only the exact `(max-width: 767.98px)` string — why: the 768–1023 overlay-drawer queries must answer consistently — cost if wrong: none for useIsPhone, which uses the exact query.
- **L28** Ruling: 0.1 — `/api/user/preferences` is served in the ok() envelope `{success:true, data:{layout:'workspace'}}`, per spec §7 (routes use ok()/fail()) — why: the route does not exist yet, and the envelope is what it will return — cost if wrong: change one fixture handler when the route lands.
- **L29** Ruling: 0.1 — Inter comes from the @fontsource/inter 5.3.0 latin woff2 files (Inter 4.x, OFL), not the rsms release zip — why: about 24 KB per weight versus about 110 KB for full glyph sets — cost if wrong: swap in the full files from the release.
- **L30** Ruling: 0.1 — Fixture source ids are readable (`src-g2`, `src-heltec`, `src-rak`, `src-rns`, `src-mqtt`), not UUIDs — why: readable test routes — cost if wrong: none (ids are opaque strings everywhere).
- **L31** Ruling: 0.1 — The CI workflow installs the Playwright browser (`npx playwright install --with-deps chromium`) — why: a fresh runner has none; the no-install rule applies to this session's container only — cost if wrong: drop the step.
- **L32** Ruling: 0.1 — The eslint `tests/**` no-project block now includes `.ts`, and vitest excludes `tests/workspace-e2e/**` — why: these files are outside tsconfig and are Playwright specs, not Vitest suites — cost if wrong: none.
- **L33** Ruling: 0.2 — 70 boards' checks written by an independent check agent (source "written"); list in .superpowers ledger — why: plan Step 4 — cost if wrong: per-board check edits.
- **L34** Ruling: controller K — preferences PUT/DELETE use optionalAuth + in-handler anonymous check (403 ANONYMOUS_USER) instead of requireAuth — why: brief's requireAuth makes its own 403 unreachable; reviewer confirmed self-only, CSRF covered, deactivated sessions cleared — cost: API tokens cannot write preferences (acceptable for a UI store).
- **L35** Ruling: controller L — stored layout values other than classic|workspace are treated as unset in layout-usage — why: PUT rejects them; only hand-edited rows — cost: none.
- **L36** Ruling: controller — USER INSTRUCTION 2026-11-13: no PR is created automatically; plan steps that open or update a PR are skipped; phase summaries live in this ledger and the final report — why: requester's explicit instruction — cost: none.
- **L37** Ruling: controller M — LayoutGate in Classic mode renders only <Navigate> for Workspace-only paths (not classic+Navigate) — why: avoids mounting a Classic page for an URL it can't serve; reviewer accepted — cost: none.
- **L38** Ruling: controller N — WorkspaceApp has no app-level WebSocketProvider above /source/:id/* (only non-source routes get one), deviating from the plan's provider order — why: outer socket joins all sources and prefix-invalidates the open source's poll on every mesh-wide event; Classic does the same split — cost: 1.6 rail must use unread hooks/polling for live data.
- **L39** Ruling: controller O — accepted 1.5 deviations — renderSourceApp takes page components as first arg (eager-CSS plugin roots); workspaceRedirect takes {isAdmin}; per-source redirects only for Meshtastic sources (configuration/settings/notifications are MeshCore views) — cost: none.
- **L40** Ruling: controller P — 1.6 implementer rulings below adopted; reviewer confirmed --device-N tokens and the rail drawer button sound — cost: none.
- **L41** Ruling: 1.6 a-chat-D-desktop — the board test asserts only the frame's must strings (Station G2, Nodes, Configuration, More tools…, Message a node, Direct messages) and both absent strings; `200 left`, `nodes heard today`, `heard via`, `delivered` and the full `expectBoard` move to Phase 2 — why: chat pane is Phase 2 — cost if wrong: none.
- **L42** Ruling: 1.6 — the device square tokens are `--device-1…8`, not the brief's `--color-device-1…8`, defined once in the shared `:root` as aliases of `--chart-1,3,5,2,6,4,7,8` (the categorical layer, like `--seq-N`) — why: `semanticTokens.test.ts` (#4567) makes every `--color-*` a role that each of the 15 theme blocks declares and that is a REQUIRED custom-theme schema key; 8 new required keys would invalidate stored custom themes, and device hues are categorical, not roles. Every theme still gets them through its own `--chart-N`, which contrasts with its `--color-bg` — cost if wrong: rename in two files.
- **L43** Ruling: 1.6 — device abbrev = initials of the first two words (or the first two letters of one) — why: the board's G2/HC/RK/MQ follow no rule — cost if wrong: a later naming field.
- **L44** Ruling: 1.6 — the 768–1023 px drawer button sits at the top of the rail, not in a page header — why: a header bar would shift every re-hosted Classic page (they read one `--app-header-height` for both in-flow padding and fixed panes) — cost if wrong: move one button when Phase 2 adds a pane header.
- **L45** Ruling: 1.6 — the shell keeps the window as the scroller: rail and sidebar are `position: fixed`, the page column is offset, and re-hosted pages get `--sidebar-width = frame width` with `.app-main`'s margin cancelled — why: Classic's fixed panes (map, save bar, popups) and SectionNav's window scrolling keep working unchanged — cost if wrong: per-page offset fixes until each re-host is replaced.
- **L46** Ruling: 1.6 D9b — tool row labels use today's strings "Automation" (nav.automation) and "Device Configuration" (nav.device_configuration); "Map" via `mapNav`; the gear's label is "Global Settings" (`globalSettingsNav`); anonymous sign-in reads "Login" (auth.login) — why: D9b — cost if wrong: string swaps.
- **L47** Ruling: 1.6 — "Direct messages", "More tools…", "Message a node", "Overview", "Add device" are new `workspace.shell.*` strings (board copy; Classic's "Direct Messages" differs in case and is a different control, Ruling I) — cost if wrong: none.
- **L48** Ruling: 1.6 — rail unread = DMs from `/unread-by-source` for every device, plus channel unread for the open device only (`/unread-counts?sourceId=`, one 10 s poll); other devices' channel unread would need one poll per source — why: no new per-source polling — cost if wrong: Phase 2 adds it.
- **L49** Ruling: 1.6 — More tools… links to today's Info tab (`/info`) until Phase 8's `/tools`; Channels / Direct messages placeholders link to `channels` / `messages` (MeshCore `dms`) — why: brief ("link to today's tabs") — cost if wrong: none.
- **L50** Ruling: 1.6 — the device header has no ▾ menu and no Search button yet — why: their behaviour (device menu, message search 10-15) belongs to Phases 2/6 — cost if wrong: none.
- **L51** Ruling: 1.6 RF4 — only a device that was in the list and then disappears navigates to `/overview` with a toast; a URL for an id never seen keeps 1.5's in-place not-found state; disabled or disconnected devices stay open with "Disabled" / "Disconnected" in the status line — why: Review Focus 4 allows either; the 1.5 state is tested — cost if wrong: one condition.
- **L52** Ruling: 1.6 — Workspace board screenshots render with `colorScheme: 'dark'` (Mocha) — why: boards are drawn in Mocha; the headless light scheme picked Latte — cost if wrong: none (Latte shots come in 9.1).
- **L53** Ruling: 1.6 Rule X — `useMediaQuery` in `hooks/useIsMobileViewport.ts` is exported for `useIsPhone` — why: reuse; no behaviour change — cost if wrong: none.
- **L54** Ruling: controller Q — 1.7 c-home-e2-switcher.json drops "DEVICES" (CSS-uppercased "Devices"; textContent cannot see text-transform) — cost if wrong: re-add with a visible-text matcher.
- **L55** Ruling: controller R — 1.7 dispatch resolutions: Home = open device → last opened this session (in-memory) → /overview; DMs tab → today's DM view (messages / MeshCore dms) until Phase 2; Activity → /source/:id/activity; no Activity badge until Phase 2; Layout row → /you/layout; Sheet portals to body — cost: none.
- **L56** Ruling: controller S — the Workspace shell renders Classic's forced ChangePasswordModal when passwordChangeRequired (UserMenu is not mounted in Workspace) — why: recovery-code sign-in must force a new password in both layouts — cost: none.
- **L57** Ruling: controller T — 1.7 implementer rulings below adopted.
- **L58** Ruling: 1.7 a-chat-D-phone — the board test asserts only the frame strings (Station G2, Home, DMs) and both absent strings; Search, Channels, Direct messages, Automations, Tools and the header's quick device squares move to Phase 2 (c-home-e1 / a-chat-D-phone content) — why: the device home is Phase 2 — cost if wrong: none.
- **L59** Ruling: 1.7 c-home-e2-switcher — "DEVICES" removed from the board check; the section label is "Devices" (`workspace.shell.devices`) uppercased by CSS — why: the check compares textContent, which cannot see `text-transform`; an all-caps translation string reads letter by letter in some screen readers and does not localise — cost if wrong: one string.
- **L60** Ruling: 1.7 c-home-e2-switcher D9b — the state words are today's "Connected" / "Disconnected" / "Connecting" (`source.status_*`), not "connected" / "offline since 14:02"; no offline-since time exists in today's status reply — cost if wrong: string swap, plus a field for the time.
- **L61** Ruling: 1.7 c-home-e2-switcher — a connected Reticulum device reads "Reticulum · LXMF messages" (board), other states use the status words — why: board must string — cost if wrong: one condition.
- **L62** Ruling: 1.7 c-home-e2-switcher — "Receive-only" chip for `mqtt_broker`, `meshcore_mqtt` and a MeshCore source with `radio.receiveOnly` — why: ds7 "receive-only (MQTT)", and today's MeshCore receive-only mode — cost if wrong: one predicate.
- **L63** Ruling: 1.7 — device type names are new `workspace.switcher.type.*` strings (Meshtastic, MeshCore, MeshCore MQTT, Reticulum, MQTT broker, MQTT bridge) — why: en.json has no source-type keys (only inline fallbacks in UsersTab) — cost if wrong: none.
- **L64** Ruling: 1.7 — the phone header shows square, name ⌄ and "Connected · 12 online" and opens the switcher; it appears on device, device-settings and Overview routes, not on You / Preferences / Server; the bell / gear (c-home-e2) and quick squares (a-chat-D-phone) are Phase 2 — why: the two boards disagree on the right side and both belong to the home content — cost if wrong: one header slot.
- **L65** Ruling: 1.7 — Home tab target = device in the URL, else the last device opened this session (shell state, no preference key), else `/overview` — why: requester's resolution — cost if wrong: none.
- **L66** Ruling: 1.7 — DMs tab → today's DM view (Meshtastic `messages`, MeshCore/Reticulum `dms`) until Phase 2; Activity → `/source/:id/activity`; with no device both are shown disabled (`aria-disabled`, no link), not hidden, so the bar keeps four slots — cost if wrong: hide two elements.
- **L67** Ruling: 1.7 — DMs badge = the home device's DM unread (`/unread-by-source`); Activity has no badge until Phase 2 — why: no activity read state yet — cost if wrong: none.
- **L68** Ruling: 1.7 s1-you D9b — row labels use today's strings where the control exists: "API Token" (user_menu.api_token), "Global Settings" (globalSettingsNav, as the 1.6 gear), "Logout" (user_menu.logout), "Login" (auth.login), "Appearance", "Map", "Notifications", and the head line "Administrator · Local account"; new: Sign-in & security, Layout, Language & units, Help & about, Account — cost if wrong: string swaps.
- **L69** Ruling: 1.7 s1-you — the brief's "Profile" row is the account head (the board draws no Profile row and today has no profile edit, s11n3/s11n4) — cost if wrong: one row.
- **L70** Ruling: 1.7 s1-you — trailing values (2FA on, Workspace, English · km, Dark, Dark matter, This phone · 2 devices, Admin) are left to Phase 6; only Help & about shows the app version (package.json, as InfoTab) — cost if wrong: none.
- **L71** Ruling: 1.7 s1-you — Sign-in & security opens one sheet holding today's Change Password (row → ChangePasswordModal), MFAManagement and PasskeyManagement; hidden for non-local accounts as in the user menu. API Token opens a sheet with APITokenManagement — why: "opening the existing modal is fine"; one sheet keeps the row count of the board — cost if wrong: Phase 6 replaces it anyway.
- **L72** Ruling: 1.7 s1-you — Notifications → the home device's (else the first device's) today's Notifications page (Meshtastic `settings/notifications`, MeshCore `notifications`; none for Reticulum / MeshCore MQTT); Help & about → that device's Info tab (version, system info) — why: no install-wide equivalents today — cost if wrong: two links.
- **L73** Ruling: 1.7 s1-you — a guest sees a Login row (today's LoginModal) and Help & about; the guest tab bar with Sign in as a tab is i6 (Phase 6) — cost if wrong: none.
- **L74** Ruling: 1.7 — `/you/layout` is its own route still re-hosting the Overview, so Task 1.8 swaps one element — cost if wrong: none.
- **L75** Ruling: 1.7 — `Sheet` uses `useDialogA11y` (focus on open, Esc, Tab trap, restore) and portals to `<body>` at z-index 10000 — why: shared a11y contract; 1.6's stacking lesson — cost if wrong: none.
- **L76** Ruling: 1.7 — `TwoLineRow` gains `active` (`aria-current="page"`) beyond the brief's props — why: the switcher marks the current device — cost if wrong: none.
- **L77** Ruling: 1.7 — `TOOL_TABS`, `familyOf`, `statusLabel` moved from DeviceSidebar.tsx to `shell/deviceTabs.ts` — why: shared by four components; exporting them from a component file adds `react-refresh/only-export-components` hits to the ratchet — cost if wrong: none.
- **L78** Ruling: controller U — 1.8 in-place layout swap instead of reload (Try it / Layout page / menu item) — reviewer verified the gate unmounts the whole other tree incl. sockets and mm.layout is rewritten — cost if wrong: add location.reload().
- **L79** Ruling: controller V — 1.8 r4 "Default device for guests" → Option A: the control keeps defaultMeshtasticSourceId (the source used where a request names none) with today's label settings.default_source.title "Default Meshtastic source" and today's hint (D9b; code beats board on behaviour); r4 check json drops "Default device for guests" — why: the board copy describes defaultLandingPage, which may name non-source pages; binding to it would hide/overwrite those values — cost if wrong: rebind in 6.4.
- **L80** Ruling: controller W — 1.8 changing defaultLayout never moves the admin making the change: save without an optimistic cache write, and if the admin has no own `layout` pref, first save their current resolved layout as their pref — why: otherwise an admin on the install default is thrown into Classic with no way back during preview — cost: one extra PUT.
- **L81** Ruling: controller X — carry to 6.1: r2-you-layout's You sidebar strings belong to YouSidebar; add r2 to 6.1's boards — cost: none.
- **L82** Ruling: controller Y — 1.8 implementer rulings below adopted (its "Default device for guests" board-label ruling is superseded by V).
- **L83** Ruling: 1.8 r2-you-layout — the board test asserts the page's must strings only (Only you · on every browser you sign in from, Both layouts show the same data and settings, Messages as, Hops, SNR and route, Rows) and the absent string; the You sidebar strings belong to Task 6.1's YouSidebar, which should own the full expectBoard — why: the desktop You sidebar is a 6.1 file; 1.8 builds the page — cost if wrong: 6.1's list gains r2.
- **L84** Ruling: 1.8 r4-server-general — the board test asserts the Layout/Sources cards' strings only; the Server sidebar header and list are 6.4's (it owns r4's acceptance) — why: plan splits r4 across 1.8 and 6.4 — cost if wrong: none.
- **L85** Ruling: 1.8 r2/r4 board checks — dropped the CSS-uppercased "ACCOUNT", "PREFERENCES", "IN WORKSPACE" (r2) and "LAYOUT", "SOURCES" (r4); r2's "API token" swapped to today's "API Token" (user_menu.api_token, D9b) — why: textContent cannot see text-transform (Ruling Q precedent); D9b — cost if wrong: string edits.
- **L86** Ruling: 1.8 r3-classic-banner — no Playwright screenshot; the board is checked by Vitest with WORKSPACE_ENTRY_ENABLED mocked true, asserting the banner strings only (the tab names are Classic chrome guarded by the 1.4 snapshot; "Classic layout, unchanged" is a board caption) — why: the flag ships false and a true flag cannot be mocked in the built bundle without shipping it — cost if wrong: one screenshot in 9.3.
- **L87** Ruling: 1.8 — Try it, the menu item and LayoutPage's radio cards save `layout` first and then invalidate the preferences query; LayoutGate shares that query, re-resolves and swaps layouts in place (its effect rewrites `mm.layout`), with no page reload — why: the gate already re-resolves from the shared cache; save-then-swap means a failed write never swaps the page away and back — cost if wrong: add `window.location.reload()` after the save.
- **L88** Ruling: 1.8 r3 — the banner's close × does what Not now does (layout=classic + bannerDismissed), labelled "Dismiss" (common.dismiss) — why: the board draws both and D18 gives only Not now's semantics; a session-only close would bring it back next load — cost if wrong: one handler.
- **L89** Ruling: 1.8 r3 — the banner also renders nothing inside the Workspace shell (`useShellEmbedded()`), since App is re-hosted there — why: a Workspace user with no stored choice would otherwise be offered the layout they are in — cost if wrong: none.
- **L90** Ruling: 1.8 — an unset `offerWorkspaceBanner` reads as off — why: the server stores exact 'true'/'false' and the flag is a nag; conservative default — cost if wrong: admins toggle it on once.
- **L91** Ruling: 1.8 s3-layout — the "In Workspace" rows also show on the phone, below the caption (s3 does not draw them) — why: the preferences apply on every device and phone-only users would otherwise have no way to set them; brief lists the rows as part of LayoutPage — cost if wrong: hide one block on phone.
- **L92** Ruling: 1.8 r4 — the Saved tick stays until that control changes again (no fade timer) — why: no new timers — cost if wrong: none.
- **L93** Ruling: 1.8 — the General cards are drawn through `GlobalSettingsRehost`'s new `above` prop on the single `/server/*` route, not a separate `/server/general` route — why: a separate route remounted today's settings page when moving General → another Server category (caught by the existing stays-mounted test) — cost if wrong: none.
- **L94** Ruling: 1.8 — `useLayout` and the banner/card share `installSettingsQuery` (key `['settings','install']`, was `['settings','defaultLayout']`) — why: one /api/settings fetch and one invalidation point — cost if wrong: none.
- **L95** Ruling: 1.8 — extra file `src/components/WorkspaceBanner/TryWorkspaceMenuItem.tsx` beyond the brief's list — why: UserMenu must not call react-query hooks while the flag is off (its Classic tests render it with no QueryClient) — cost if wrong: none.
- **L96** Ruling: 1.8 — Athens fixture serves empty `/api/embed-profiles`, `/api/channel-database`, `/api/scripts/inventory` — why: the re-hosted General page toasts on 404 and the toasts covered r4's cards in the screenshot — cost if wrong: none.
- **L97** Ruling: 1.8 — r4 drops 'Default device for guests' (Ruling V, D9b); the row reads today's "Default Meshtastic source" / "Source used when none is chosen".
- **L98** Ruling: 1.8 r4 — every General card control saves before it updates the cache (none optimistic), and the default-layout select waits for the admin's preferences to load (Ruling W) — why: the gate shares the settings cache; one save path is simpler than a per-key rollback — cost if wrong: a short wait before a toggle flips.

#### Phase 1 summary (gate)

- **L106** Ruling: controller Z — 2.1 new workspace.state.loading "Loading…" (today's ellipsis copy has no shared key: RouteLoading hardcodes it, common.loading_indicator uses three dots); SendsLine uses UiIcon radioSignal (no antenna icon) — cost: key/icon swap.
- **L107** Ruling: controller AA — ConfirmSheet catches a rejected onConfirm, stays open with an inline error (Error message, else errors.generic) and allows retry — why: async actions must not fail silently — cost: none.
- **L108** Ruling: controller AB — 2.1 implementer rulings below adopted.
- **L109** Ruling: controller AC — 2.2 restart: implementer lost to a container restart; a fresh implementer verified the uncommitted draft per function against BASE and finished it — cost: none.
- **L110** Ruling: controller AD — the Workspace chat owns these hook instances only on screens where the re-hosted App is not mounted (one owner per screen) — why: two instances split the spinner dedupe and pending-ack map — cost: a route-level guard in 2.3+.
- **L111** Ruling: controller AE — 2.2 implementer rulings below adopted.
- **L112** Ruling: 2.2 — Both hooks take one options object (message hook: baseUrl, authFetch, refetchPoll, setMessages, setChannelMessages, pendingMessagesRef, the two container refs, localNodeIdRef, homoglyphEnabledRef; node hook: baseUrl, authFetch, refetchPoll, optional csrfFetch) instead of no arguments — why: these are App-local (App's authFetch with CSRF retry and timeout, usePoll gated on showRebootModal, useMessagingView state and refs), and useSourceView already takes the same three — cost if wrong: the Workspace has to supply these values; small.
- **L113** Ruling: 2.2 — `deleteMessage(id, channel?)` and `sendBell({channel?, nodeId?, text?})` add an optional parameter to the brief's signature — why: Classic's delete removes the message from its channel's list, and Classic's bell prepends the compose text; without a channel, delete removes the message from every channel list — cost if wrong: none for Classic; the Workspace can ignore them.
- **L114** Ruling: 2.2 — `requestTelemetry` types `type` as `'device'|'environment'|'airQuality'|'power'` instead of `string`, and ignores `channel` — why: the brief's `string` would need a cast; today's request sends no channel (the server picks it, #3573) — cost if wrong: one type change.
- **L115** Ruling: 2.2 — The public node methods take nodeNum and convert it with `nodeIdFromNum`; Classic keeps id-keyed access through `nodeActions.byNodeId` and `nodeActions.loading` — why: Classic's spinners and props are keyed by `!xxxxxxxx` id — cost if wrong: the Workspace must key spinners by id.
- **L116** Ruling: 2.2 — `scanForAdmin` and `markAircraft` copy what MessagesTab / AircraftMarkMenuItems send (the same csrfFetch request; the same POST body and cache patch). The components are unchanged, and their toasts and busy state stay with the caller — why: Rule X, ambiguity resolution 2 — cost if wrong: two copies of each request to keep in sync until Classic is retired.
- **L117** Ruling: 2.2 — The node hook reads auth with `useContext(AuthContext)` and takes csrfFetch as an option instead of calling `useAuth()`/`useCsrfFetch()` — why: it runs inside useSourceView, whose unedited tests have no Auth or Csrf provider — cost if wrong: none at runtime.
- **L118** Ruling: controller AF — a-chat-D-phone content strings are added to Task 2.6's board list; 10-05 "Organise"/"Data" re-add moves to Task 2.4 — why: the plan left these 2.3 deferrals unowned — cost if wrong: two boards checked one phase late.
- **L119** Ruling: controller AG — 2.3 implementer rulings below adopted (csrfFetch sends, shell connected flag, MQTT mirror note, D9b check edits); the sidebar-DM-placeholder ruling is superseded by fix round 1 (DMs live) — cost if wrong: a stalled send has no 10 s timeout; composer visible while configuring.
- **L120** Ruling: 2.3 — `channel/<n>[/beacons]` on a Meshtastic-family source renders ChannelThread with its own SourceProvider / socket / Settings / Data / UI / Messaging providers and a nested `<Routes location>` giving UIProvider Classic's `/channels` location; App is not mounted there; `/source/:id/channels` stays the re-host — why: Ruling AD; useMessagingView's effects are gated on `activeTab === 'channels'` — cost if wrong: one route branch.
- **L121** Ruling: 2.3 — the chat screen's `connectionStatus` is the shell's per-source connected flag, not App's /api/connection state machine — why: no new timer; the shell already polls status — cost if wrong: configuring / node-offline states show the composer; sends fail with today's toast.
- **L122** Ruling: 2.3 — the message hook's `authFetch` is `csrfFetch` — why: App's authFetch is App-local; a shared one belongs with 2.4's DM screen — cost if wrong: a stale CSRF token fails one send with an error toast instead of retrying.
- **L123** Ruling: 2.3 — both MQTT types are "MQTT mirror": no composer, today's `tx_disabled.no_local_radio_tooltip`, "Open on <first enabled Meshtastic TCP device>" to its channel 0 (slots differ per radio) — why: ds7 / s10n3; today a broker shows a disabled composer with the same tooltip — cost if wrong: one predicate and one link target.
- **L124** Ruling: 2.3 D9b — check edits: 10-03 / 10-12 "Channel info" → "Channel Information", "Purge all messages" → "Purge All Messages", "Mark all as read" → "Mark all as Read", "Show MQTT messages" → "Show MQTT/Bridge Messages"; 10-05 / 10-14 "Sign in" → "Login" (auth.login, as Ruling 1.6); a-chat-D-desktop drops "200 left" (today's byte counter "0/200" labels that control) and "delivered" → "Delivered" (10-06's ack word, the one 2.4's ack states use) — why: D9b / Ruling I — cost if wrong: string edits.
- **L125** Ruling: 2.3 — 10-04 drops "Search node, channel or message": it is the search input's placeholder / aria-label, which textContent cannot see — why: Ruling Q's reason — cost if wrong: re-add with an attribute-aware matcher.
- **L126** Ruling: 2.3 — 10-05 drops "Organise" and "Data": they are the DM header's node menus (s10n0, 2.4's NodeActionMenus); 2.4 re-adds them when it renders the DM read-only state — cost if wrong: 2.4 edits the json.
- **L127** Ruling: 2.3 — 10-05 / 10-14 are checked over the three read-only states rendered separately and joined (the boards compare them side by side, s10n3); the Playwright shots show the MQTT mirror on a channel — why: boards.spec has no per-board fixtures — cost if wrong: add per-board fixture overrides.
- **L128** Ruling: 2.3 — a-chat-D-phone content (Jump to, tiles, Channels and DM lists, quick squares) is the phone device Home, which 2.6 builds (`PhoneHome`, `/source/:id`, c-home-e1); 2.6 owns its full expectBoard; 2.3 leaves 1.7's frame test — cost if wrong: until 2.6 a phone reaches a thread only by URL.
- **L129** Ruling: 2.3 — MessageRowD wires Reply only; react, resend, translate, details, copy and delete come with 2.5's hover bar / sheet (`onAction` already takes those kinds); reaction chips are display-only, since a tap sends a tapback that needs its Sends line — cost if wrong: until 2.5 the Workspace channel screen cannot delete, resend or react.
- **L130** Ruling: 2.3 — the signal line has no "Traceroute" link (it transmits; Ask the node is 2.4's) and no encryption in the header subtitle ("AES-256" is not known from the API) — cost if wrong: one link / one label.
- **L131** Ruling: 2.3 — the composer shows one Sends line ("Sends 1 message on # X · hop limit N"), covering Send and Bell (1 message each); Send position states its cost in its tooltip ("Sends 1 position on # X") — why: the board draws one Sends line — cost if wrong: a second line.
- **L132** Ruling: 2.3 — "hop limit N" comes from the poll's `deviceConfig.lora.hopLimit` and is omitted when absent; "N nodes heard today" counts nodes whose lastHeard is after local midnight — cost if wrong: one helper.
- **L133** Ruling: 2.3 — Purge confirm: title "Purge All Messages", body today's `window.confirm` sentence as new key `workspace.chat.purge_confirm` (today's is hardcoded English in App), confirm "Purge", danger, no typed word; the board's message count and bullets are not drawn — cost if wrong: copy.
- **L134** Ruling: 2.3 — Mark all as Read passes the channel's unread count so MarkAllReadButton asks above its threshold (s10n4); in practice the count is zeroed on entry, as today — cost: none.
- **L135** Ruling: 2.3 Rule X — `BeaconsList` (search, filters, table) extracted from `BeaconsModal`, which renders it unchanged; the join step is a Sheet with slot radios using today's strings (`beacons.slot_free` / `slot_in_use`, "N — empty") instead of today's select — cost if wrong: swap to the select.
- **L136** Ruling: 2.3 — opening a channel waits (latched) for the first-unread read before selecting it, so the "New" line is pinned on a direct load — cost if wrong: none.
- **L137** Ruling: 2.3 — PhoneShell hides the device header on a Meshtastic channel URL; the thread's header has Back to the device Home — why: 10-06 / 10-14 draw no device header — cost if wrong: one condition.
- **L138** Ruling: 2.3 — the homoglyph flag is read through the `['settings','translation']` query (same `/api/settings` fetch as useTranslationSettings) — cost if wrong: a second settings read.
- **L139** Ruling: 2.3 — fixture message ids now use today's `${sourceId}_${nodeNum}_${packetId}` form (reply ids parse from it); the MQTT source serves the same poll as Station G2 — cost: none.
- **L140** Ruling: 2.3 r1 — the sidebar's DM rows link to `/source/:id/dm/:nodeId` with `state.focusDmNodeId`. App, re-hosted there until 2.4, opens that conversation once per mount. A second DM row clicked while App stays mounted changes only the URL (recorded as a `shortcut:` in DmList.tsx). Why: App's focus effect runs once per mount, and App is not edited. Cost if wrong: until 2.4, a user clicks the conversation in Classic's list.
- **L141** Ruling: 2.3 r1 — DM rows have no presence dot (the board draws one). Why: no shared online threshold is defined for the sidebar yet. Cost if wrong: one dot per row.
- **L142** Ruling: 2.3 r1 — Channel Database entries are read through `useChannelDatabaseEntries`, a react-query that is enabled only when a 100+ channel is heard or open. Why: Classic's gate needs the entry list, which only App fetches today. Cost if wrong: one GET per 5 minutes on installs with server-decrypted channels.
- **L143** Ruling: controller AH — Exchange NodeInfo / position / Request telemetry gate on messages:write, not the plan's traceroute:write — why: server meshRequestGate('messages') and Classic gate them so; the plan's Gates line was wrong for those three — cost if wrong: none.
- **L144** Ruling: controller AI — Organise gated on nodes:write (spec s10n0, server gate) though Classic's DM menu shows it on messages:write — cost if wrong: messages-only users see Organise disabled instead of an error toast.
- **L145** Ruling: controller AJ — no "Center on map" in the DM header until the Workspace map takes a focus target (Phase 3) — cost: one board element until then.
- **L146** Ruling: controller AK — MeshCore asks listed, disabled with a reason until Phase 7 — why: their only hook starts its own polling timer — cost: none before Phase 7.
- **L147** Ruling: controller AL — traceroute participation picker stays today's select (D9b) — cost: one control swap.
- **L148** Ruling: controller AM — 2.4 implementer rulings below adopted (the withdrawn "banner stays" ruling excluded).
- **L149** Ruling: 2.4 — `dm/<nodeId>` on a Meshtastic-family source renders DmConversation under `ChatProviders` (the provider stack ChannelThreadRoute had, moved to its own file and shared) with Classic's `/messages` location; App is not mounted; `useChannelRuntime` moved unchanged to `useChatRuntime.ts` — why: Ruling AD; useMessagingView's DM effects are gated on `activeTab === 'messages'` — cost if wrong: one route branch.
- **L150** Ruling: 2.4 — Exchange Node Info, Exchange Position and Request Telemetry are gated on messages:write, not the brief's traceroute:write — why: today's gate on both sides (`meshRequestGate('messages')`, MessagesTab); traceroute:write gates Traceroute and Request Neighbors — cost if wrong: one resource per item.
- **L151** Ruling: 2.4 — Organise items are gated on nodes:write (the server's gate), where Classic's DM menu shows favourite / lock / ignore on messages:write — why: a messages-only user's click fails server-side today — cost if wrong: a messages-only user loses three items they cannot use anyway.
- **L152** Ruling: 2.4 — Exchange Node Info / Position always send the node's channel explicitly (picker preselected to it); Traceroute's picker has "Server's choice" (sends no channel, today's main button) — why: the server's default for NodeInfo/Position is the node's stored channel, so the packet is unchanged and the key-repair rule is visible; the traceroute default is a server heuristic (`resolveBroadcastChannel`) the client cannot name — cost if wrong: one option label.
- **L153** Ruling: 2.4 D9b — menu labels are today's: Exchange Node Info, Exchange Position, Request Telemetry, Request Neighbors, Scan for Admin, Add to favorites / Set Favorite Lock / Ignore Node / Hide from Map, Override Position, Copy NodeInfo, Merge history…, Purge Data; MeshCore Ping (0 hop), Trace Path, Discover Path — cost if wrong: string swaps.
- **L154** Ruling: 2.4 D9b — check edits: 10-01 "Key mismatch" → "public key has changed" (today's KeyMismatchWarning headline), "Purge data for Kifisia Rooftop" → "Purge Data for Kifisia Rooftop", "All messages" → "Purge All Messages", "Position history" → "Purge Position History", "local database only" → "Local Database Only", "device and database" → "Device AND Database" (purgeModal.*); 10-07 "Key mismatch" → "public key has changed", "Exchange NodeInfo" → "Exchange Node Info", "Request telemetry" → "Request Telemetry", "Scan for admin" → "Scan for Admin"; 10-05 re-adds "Organise" and "Data" (Ruling AF) — cost if wrong: string edits.
- **L155** Ruling: 2.4 — "Not in the device database" is a new bold title (`workspace.chat.not_in_device_db`) before today's sentence (the key-known or the will-fail one) — why: no today string titles that banner; the board's body text differs from today's, so today's sentence stays — cost if wrong: one string.
- **L156** Ruling: 2.4 — the ack words keep 2.3's `workspace.chat.ack.*` (Pending / Delivered / Confirmed / Failed / Timed out) with today's `message_status.*` tooltip — why: no today string labels a message row's ack state in words (today's row shows an icon; `delivery_details.*` label the Message Details modal, a different control); the words are identical — cost if wrong: key swaps.
- **L157** Ruling: 2.4 — DM row and header presence dot = heard in the last 2 hours (`isHeardRecently`, `ONLINE_WINDOW_S = 7200`), the window of the server's `getActiveNodeCount`, which feeds the shell's "N online" — why: brief asked to reuse an existing threshold; this is the one the sidebar already shows — cost if wrong: one constant. (Supersedes 2.3 r1's "no presence dot".)
- **L158** Ruling: 2.4 — no "Center on map" pin in the DM header — why: today it hands the node to App's own MapContext and Nodes tab; the re-hosted App cannot be told to centre without a Classic change; Phase 3's Workspace map gets it — cost if wrong: one button.
- **L159** Ruling: 2.4 — the node name links to `/source/:id/node/:nodeId` with `state.focusDmNodeId` (today's re-hosted Messages tab opens on that node with Node Details) — why: no Workspace node page until section 15 — cost if wrong: one link.
- **L160** Ruling: 2.4 — MeshCore asks (Ping, Trace Path, Discover Path) and the MeshCore / Reticulum Organise and Data items are listed, disabled, with "Comes with MeshCore chat in the Workspace" — why: the actions exist only on `useMeshCore`, which starts its own status poll and needs a contact public key; mounting it here would add a timer — cost if wrong: Phase 7 wires them.
- **L161** Ruling: 2.4 — Purge Data is one plain ConfirmSheet with today's four purges as checkboxes and Keep / Delete Node (Local Database Only) / Purge from Device AND Database as radios, nothing preselected, confirm "Purge" off until a choice; it runs the picked purges then the delete, then leaves the deleted node's DM for the device — why: s10n2; today's per-button `window.confirm` texts are replaced by the sheet's title, warning and tracked-asset line; no item counts (no count API) — cost if wrong: copy and a count fetch.
- **L162** Ruling: 2.4 — Purge All Messages and the two deletes call `csrfFetch` with App's / useSourceView's request and toasts (the 2.2 hook has only traceroutes / telemetry / position-history purges, and those two Classic handlers embed `window.confirm`) — why: Rule X would need an edit to useSourceView for no behaviour gain — cost if wrong: two copies of three requests until Classic retires.
- **L163** Ruling: 2.4 — `NodeActionMenus` takes an extra optional `onMessagesPurged` (the DM drops the purged rows locally, as App does) — cost if wrong: none.
- **L164** Ruling: 2.4 — Aircraft marks go through the hook's `markAircraft` with today's per-mode toasts; with "Apply to all sources" the toast does not list the applied / skipped sources (the hook returns void, Ruling 2.2) — cost if wrong: return the response from the hook.
- **L165** Ruling: 2.4 — `ConfirmSheet` gains `confirmDisabled` — why: a plain confirm whose body holds the choice — cost if wrong: none.
- **L166** Ruling: 2.4 — the strip uses today's participation picker (a select whose placeholder reads "Latest" and whose first option is "Statistical (N routes)") instead of a Latest | Statistical toggle, and today's three copy links instead of "Copy ▾" — cost if wrong: a toggle and a menu.
- **L167** Ruling: 2.4 — 10-05 / 10-14 Playwright shots and the 10-05 Vitest frame now show the DM on Athens MQTT (the boards' frame); the MQTT-mirror-on-a-channel behaviour test stays — cost: none.
- **L168** Ruling: 2.4 — fixture: Kifisia Rooftop is now a router (role 2), unmessageable, key mismatch, tracked asset, 2 hops; poll traceroutes carry no ids and the stored list is the older two, so the strip opens on "Latest" — cost: none.
- **L169** Ruling: 2.4 r1 — the DM read-only state comes from today's `computeMessagesReadOnlyState` with `mqttReadOnly` true for both MQTT types (Ruling AG's "MQTT mirror"); so an unmessageable node on a mirror shows today's banner, and Message anyway there hides only the banner — cost if wrong: one condition.
- **L170** Ruling: controller AN — per-message Translate follows Classic's canWrite gate even though it sends nothing on the mesh — cost if wrong: read-only users lose a harmless translate.
- **L171** Ruling: controller AO — 2.5 implementer rulings below adopted (the withdrawn Translate ruling excluded).
- **L172** Ruling: 2.5 — reply / react / resend / delete gates are Classic's: channel_N:write on a channel, messages:write on a DM; delete on a DM is messages:write — why: the brief's "server's requireMessagesWrite" is not on `DELETE /api/messages/:id`; that handler checks `channel !== 0` → channel_N:write, else messages:write, and DMs are stored with channel -1, so today a non-admin can never delete a DM and a channel 0 delete needs messages:write (a server bug, reported, not fixed here) — cost if wrong: a DM delete by a non-admin fails server-side with today's error toast until the server check is fixed.
- **L173** Ruling: 2.5 — Reply only on theirs and Resend only on ours, as Classic; 10-08 is checked over the ours sheet and the theirs sheet joined — why: D9d, the board draws Reply on our own message — cost if wrong: offer Reply on ours.
- **L174** Ruling: 2.5 — React and Resend are off with today's TX-disabled tooltip on channels too (Classic disables them only in DMs; channel resend stays live) — why: s10n3 "TX disabled keeps controls visible but off" — cost if wrong: one condition.
- **L175** Ruling: 2.5 — React, Resend and the chips are also off with "Disconnected" while the device is down, as 2.4's asks — cost if wrong: one condition (today the hook shows "not connected" on the click).
- **L176** Ruling: 2.5 — visible labels are the board's (Reply, React, Translate, Resend, Details = `common.details`, Copy text, Delete…), with today's button tooltips as titles (`*.reply_button_title`, `emoji_button_title`, `messages.translate`, `resend_button_title`, `delete_button_title`); the bar's Translate keeps today's accessible name "Translate message" — why: today's controls are icon-only, their strings are tooltips (2.3's Reply precedent); the composer has a "Translate" chip — cost if wrong: key swaps.
- **L177** Ruling: 2.5 — the phone's quick emoji are the first five of the picker's set (today's defaults: 👍 👎 ❤️ 😂 😢), not the board's 👍 ❤️ 😂 😮 👋 — why: no "quick set" exists today; the saved set replaces the defaults, so a user who saves five gets exactly the board — cost if wrong: a fixed list.
- **L178** Ruling: 2.5 — the desktop hover bar draws no "React sends 1 tapback" line; React opens the picker, whose Sends line covers the pick, and the ⋯ menu carries Resend's — why: the bar button sends nothing itself, and a line per row would repeat on every message — cost if wrong: one line in the bar.
- **L179** Ruling: 2.5 — no inline "Resend" links on failed / timed-out rows; Resend is in ⋯ (desktop) and the sheet (phone) — why: today's resend is in the row's action bar, not by the ack — cost if wrong: one link per failed row.
- **L180** Ruling: 2.5 — reaction chips carry one shared line "A tap on a reaction sends 1 tapback" under them (new `workspace.chat.sends_chip`); chips are plain text when React is off — why: s10n1 asks a Sends line for chip taps; today's chips stay clickable even without write (the server then refuses) — cost if wrong: copy.
- **L181** Ruling: 2.5 — the emoji picker is a Sheet (right-docked on desktop, bottom on phone) instead of the board's floating dialog — why: the spec's Sheet is the one overlay pattern — cost if wrong: a centred variant of Sheet.
- **L182** Ruling: 2.5 — the picker's grid keeps today's rule (saved set replaces defaults; no `isEmojiAllowed` filter for Meshtastic, as App) in `messageActions.ts` (`tapbackSet`), not a helper exported from EmojiPickerModal — why: exporting a function there trips `react-refresh/only-export-components` — cost if wrong: two copies of a one-line rule.
- **L183** Ruling: 2.5 Rule X — `MessageDetailsBody` extracted from MessageDetailsModal; `useOutgoingTranslation` extracted from TranslateModal (re-exports `LORA_PACKET_MAX_BYTES`); `toRelayCandidateNodes` (`src/components/diagnostics/relayCandidateNodes.ts`) extracted from ChannelsTab / MessagesTab `mappedNodes` and used there and in MessageDetailsPanel (fix round 1) — DOM unchanged, Classic tests unedited — cost if wrong: none.
- **L184** Ruling: 2.5 D9b — details title is today's "Delivery Details" (ours) / "Message Details" (theirs), subtitle "time · Meshtastic" (today's header shows "— Meshtastic"); 10-02 / 10-10 check "Message details" → "Delivery Details", "Heard by" dropped — why: D9b; today shows Propagation (Heard By) only for our channel sends, not a DM — cost if wrong: string swaps.
- **L185** Ruling: 2.5 — 10-02 drops "Packet", "Route", "Scope", "Signal", "Attempt 1"; 10-10 drops "Route", "Signal", "Attempt 1" — why: today's details for a sent message show Status, Identity, Transport (+ meaning, timeline); Route / Signal / Packet show for received messages (a behaviour test covers them); Meshtastic has no Scope; the timeline labels only retry events ("Attempt 2"), and the first attempt has none — cost if wrong: render all sections for sent messages (a change to today's honest gating, #4816).
- **L186** Ruling: 2.5 — 10-02 drops "9 of 12", "No response received", "No return path data" (confirmed in fix round 1) — why: the 10-02 frame does render 2.4's TracerouteStripD, but for the fixture the strip shows the latest run with both directions, so neither note renders; "No response received" renders only when the shown run has no route, "No return path data" only for a forward-only run, and the board draws both in a separate legend box beside the live strip; today's statistical view shows per-node counts only in a hover tooltip ("Seen in N of M routes", `messages.traceroute_stat_seen_in`), never as strip text like "9 of 12" — cost if wrong: render the legend, or a visible count per node.
- **L187** Ruling: 2.5 D9b — 10-09 check edits: "From" → "Source Language", "To" → "Target Language", "Preview" → "Translated Text", "LoRa payload" → "LoRa Packet Payload Warning", "Replace in draft" → "Replace in Draft"; "Swap" dropped (today's swap is icon-only with aria-label "Swap languages"; Ruling Q) — cost if wrong: string edits.
- **L188** Ruling: 2.5 — 18-05 / 18-06 drop "Type or paste emoji..." (the input's placeholder; Ruling Q) — cost if wrong: re-add with an attribute-aware matcher.
- **L189** Ruling: 2.5 — the translate sheet's note "Replaces the draft only; nothing is sent until you tap Send." is new (`workspace.chat.translate_note`); the composer's TranslateModal is replaced by the sheet on desktop too — cost if wrong: copy.
- **L190** Ruling: 2.5 — Copy text has no Classic counterpart; it uses `navigator.clipboard.writeText` and today's `toast.copied_clipboard`, with `errors.generic` as the failure toast (no manual-copy fallback modal, unlike TracerouteCopyLinks) — cost if wrong: a fallback modal on insecure origins.
- **L191** Ruling: 2.5 — the delete confirm is a plain ConfirmSheet: title "Delete this message" (today's button title), body today's `messages.confirm_delete`, confirm "Delete" — cost if wrong: copy.
- **L192** Ruling: 2.5 — phone rows suppress text selection and the touch callout (long-press opens the sheet); Copy text replaces selecting — cost if wrong: users who select part of a message lose that on the phone.
- **L193** Ruling: 2.5 — the phone long-press opens the sheet on release (pointerup after 500 ms, or after Android's `contextmenu`; a right-click opens at once), and a capture-phase click guard on the row swallows the release's click, so nothing under the finger sends; each row also has a "Message actions" button visible only on keyboard focus (fix round 1) — cost if wrong: none.
- **L194** Ruling: 2.5 — Playwright 18-06 serves the saved set by re-routing `/api/settings` in `setup` and reloading (boards.spec has no per-board fixtures) — cost: none.
- **L195** Ruling: 2.5 — fixture: Kifisia's 👍 tapback on "Running one now" and that message's stored timeline (timeout, retry attempt 2, confirmed); default fixture routes for message events, heard-by, direct-neighbors and translate — cost: none.
- **L196** Ruling: controller AP — 2.6 restart: implementer lost to a container restart; a fresh implementer verified the uncommitted draft per file against BASE and finished it (as AC) — cost: none.
- **L197** Ruling: controller AQ — Mark All Read sends sourceId (Classic marks the primary's DMs from a non-primary device) and asks above today's threshold (2.3 precedent, s10n4); DM search results labelled and opened by peer (fixes Classic's own-node mislabel); the inbox shows conversations + pins until the filter is typed (board); ⌘K captured on window for one owner — cost if wrong: copy/behaviour swaps.
- **L198** Ruling: controller AR — 2.6 implementer rulings below adopted (the withdrawn "no scroll to result" ruling excluded).
- **L199** Ruling: 2.6 — the DM inbox is in phone mode only below 768 px (`useIsPhone`); its filter select and Mark All Read are 44 px on the phone, 36 px on desktop — why: common.md target sizes; desktop `/dms` is a desktop page — cost if wrong: CSS.
- **L200** Ruling: 2.6 — the sidebar hint reads "⌘K" / "Ctrl+K" from new `workspace.search.shortcut_*` strings; ⌘ is a key name the board draws, not an icon stand-in — why: D9b (board copy; no existing string) — cost if wrong: two strings.
- **L201** Ruling: 2.6 — the phone `/source/:id` (Meshtastic family, no `#hash`) renders PhoneHome with App not mounted; the desktop `/source/:id` keeps the re-hosted App; `/source/:id/dms` renders DmInbox on every viewport — why: Ruling AD; the brief keeps the desktop bare URL — cost if wrong: one branch per route.
- **L202** Ruling: 2.6 — Home and the inbox run the source's poll themselves (ChatProviders + useChatRuntime(-1), Classic `/messages` location with no DM selected, so nothing is marked read) — why: App is not mounted there, and the lists read the poll cache — cost if wrong: none (same request App made).
- **L203** Ruling: 2.6 D9b — check edits: c-home-e1 / a-chat-D-phone "Automations" → "Automation" (nav.automation, as Ruling 1.6); 10-11 "All conversations" → "All Conversations", "Unread only" → "Unread Only", "Recent (24 h)" → "Recent (24h)", "By hops" → "By Hops", "Favourites" → "Favorites", "With position" → "With Position", "No infrastructure" → "Exclude Infrastructure", "Mark all read" → "Mark All Read"; 10-15 / 10-16 "Search messages" → "Search Messages", "Case sensitive" → "Case Sensitive", "All messages" → "All Messages", "Channels only" → "Channels Only", "Direct messages only" → "Direct Messages Only", "Load more" → "Load More", "# LongFast" → "Channel LongFast" (search.channel_label); "All channels" and "Anyone" dropped (today both selects' first option is "All Messages", search.scope_all) — cost if wrong: string edits.
- **L204** Ruling: 2.6 Ruling Q — dropped: c-home-e1 "CHANNELS", "DIRECT MESSAGES" (section labels; Home draws them in sentence case, "Channels" / "Direct messages", as a-chat-D-phone); c-home-e3 "Search DMs" and 10-11 "Search direct messages" (the filter field's placeholder / aria-label, today's `messages.filter_placeholder`) — cost if wrong: re-add with an attribute-aware matcher.
- **L205** Ruling: 2.6 — the Home pill reads "Jump to…" (new `workspace.home.jump_to`), and its accessible name adds today's "Search Messages" (sr-only), because it opens message search, not a channel or node jump — why: the board's "channel, DM or node…" would promise a jump that search does not do — cost if wrong: copy.
- **L206** Ruling: 2.6 — the sidebar field reads today's "Search Messages" (search.title, the title of what it opens) with the platform's hint (`⌘K` on Mac / iOS, `Ctrl+K` elsewhere, new `workspace.search.shortcut_*`) — cost if wrong: copy.
- **L207** Ruling: 2.6 — Tools tile label "Tools" (new `workspace.home.tools`; a-chat-D-phone draws "Tools" and forbids "More tools…"); Map / Nodes link to `nodes`, Automation to the re-hosted `automation`, Tools to the re-hosted Info tab (`info`), as the sidebar (Ruling 1.6) — why: no Workspace page yet; build no new pages — cost if wrong: four links.
- **L208** Ruling: 2.6 — up to two quick squares, the first other devices in rail order; the switcher holds the rest — why: the board draws two; Review Focus 1 (no sideways overflow) — cost if wrong: one constant.
- **L209** Ruling: 2.6 — Home lists the 5 most recent DM conversations (cs2) — cost if wrong: one constant.
- **L210** Ruling: 2.6 — the inbox lists conversations plus pinned nodes; with text in the filter field it searches every node (as today's list does), so a new DM can be started; the pencil ("Message a node") focuses that field — why: an inbox of all nodes is not an inbox; no new picker page — cost if wrong: a node picker.
- **L211** Ruling: 2.6 — the DM filter is today's DmFilterSelect (a select), not the board's sheet; Mark All Read sits beside it — why: requester's resolution (reuse today's component and options) — cost if wrong: a sheet.
- **L212** Ruling: 2.6 — Pin is a visible pin toggle per row (title today's `messages.pin_node` / `unpin_node`, `aria-pressed`), not a long-press; the board's "Long-press a conversation to Pin it" and "Pinned" chip are not drawn — why: today's pin is a click target; a long-press needs a timer and a keyboard fallback — cost if wrong: a long-press sheet.
- **L213** Ruling: 2.6 — Mark All Read sends `sourceId`, so it marks this device's DMs (today's Classic call names no source and the server marks the primary's) — why: per-source scoping — cost if wrong: none.
- **L214** Ruling: 2.6 — Mark All Read asks first above today's threshold (`unreadCount` + `workspace.chat.mark_read_confirm`, as 2.3's channel menu; s10n4), where Classic's DM button never asks — cost if wrong: one prop.
- **L215** Ruling: 2.6 — search: Scope and the filters are today's selects on both sizes (no segmented control, no toggle) — why: today's control; one component for both sizes — cost if wrong: two controls.
- **L216** Ruling: 2.6 — a DM result is labelled and opened by its peer (the other end: `to` for ours, `from` for theirs); today's modal labels `to` and opens `from`, which names / opens our own node for half the DMs — cost if wrong: one helper.
- **L217** Ruling: 2.6 — the desktop count line reads "Showing N of M results" without "on Station G2" (today's string); the hints "Pick one to open it in its conversation" / "tap one to open it" are new `workspace.search.*` strings — cost if wrong: copy.
- **L218** Ruling: 2.6 — ⌘K / Ctrl+K is caught by the shell on `window` (capture) with stopPropagation on a Meshtastic-family device, so the re-hosted App's handler does not open Classic's SearchModal as well; elsewhere the shell lets the key through — why: one owner; no Classic edit — cost if wrong: two search UIs at once.
- **L219** Ruling: 2.6 — any navigation (location key) closes search, so a tab tap under the phone page closes it too — cost if wrong: none.
- **L220** Ruling: 2.6 carry — `useDeviceTab('channels')` on a Meshtastic-family device follows Classic's `hasAnyChannelPermission`: any `channel_N:read` or a readable Channel Database entry; `messages:read` alone no longer shows Channels — why: App.tsx tab gate; the final-review carry item — cost if wrong: one predicate.
- **L221** Ruling: 2.6 — classicFallback maps `/source/:id/dms` to Classic's DM tab `/source/:id/messages` (was `/source/:id/`) — why: Review Focus 3 (Classic equivalent); MeshCore's Classic page ignores the path — cost if wrong: one rule.
- **L222** Ruling: 2.6 — fixture: `searchResults` (5 of 31 for "relay": two LongFast, a Kifisia DM, Athens Ops, gauntlet) and `GET /api/messages/search`; 10-16's Vitest serves 4 to match the board — cost: none.
- **L223** Ruling: 2.6 — the 10-15 Playwright setup sets `navigator.platform` to MacIntel before opening search (the sidebar reads it on render), not by reload: a reload after the first visit goes through the service worker, which page.route does not intercept — cost: none.
- **L224** Ruling: 2.6 — search state lives in a per-device `SearchMessages` that the shell keeps mounted (keyed by source) while the viewer can search; another device starts blank — why: today's always-mounted SearchModal (D9d) — cost if wrong: one key.
- **L225** Ruling: 2.6 — a picked result reaches its conversation as `location.state.focusMessageId`, dropped by a replace navigation once handled, the same as App clearing `focusMessageId` — why: no Classic state to share across the route boundary — cost if wrong: one hook.
- **L226** Ruling: 2.6 Rule X — `compareDmListEntries`, `matchesDmListSearch` and `useScrollToFocusedMessage` were moved out of MessagesTab and ChannelsTab, and `getMessageContentMatchNodeIds` was widened (types only), so Classic and the inbox share one rule set — cost if wrong: none (Classic tests unedited and green).
- **L227** Ruling: controller AS — accept millisecond-tie loss at an Activity page boundary (the plan's strict before + timestamp cursor kept) — why: a notification feed; ties need identical ms at a page edge; a tie-break cursor changes the API shape — cost if wrong: an occasional item missing from Activity (still in its conversation).
- **L228** Ruling: controller AT — on a capped 2,000-row scan, nextBefore is the oldest scanned row's timestamp, so a page can be empty with nextBefore set; clients page until nextBefore is null — cost: none if 2.8 follows it.
- **L229** Ruling: controller AU — "our own messages" excludes every MeshMonitor radio's local node (used only in NOT IN; nothing cross-source in the response) — cost if wrong: replies from a sibling radio missing from Activity.
- **L230** Ruling: controller AV — 2.7 implementer rulings below adopted.
- **L231** Ruling: 2.7 — a collapsed reaction item's `id` is `reaction:<targetMessageId>`, and its `fromId`/`fromName`/`conversation`/`timestamp` are those of the newest reaction. `text` is the target message's text (our message that was reacted to) — why: an id that can never equal a message id; the feed reads "X reacted to <your message>" — cost if wrong: Task 2.8 maps fields differently, a client-side change only.
- **L232** Ruling: 2.7 — reactions are collapsed over the whole 2,000-row scan, not only the returned page, and a page with `before` drops any target that has a reaction at or after `before`. So one target appears exactly once across pages, at its newest reaction — why: otherwise reactions that straddle a page boundary come back as a second item with the same id — cost if wrong: one extra small query per later page.
- **L233** Ruling: 2.7 — `nextBefore`: the timestamp of the last returned item when more items than `limit` were found; when the 2,000-row scan is capped and the items fit, the timestamp of the oldest scanned row; otherwise null — why: with no item to point at, a capped scan must still page on — cost if wrong: rows sharing the exact boundary millisecond can be skipped (ms resolution; very unlikely).
- **L234** Ruling: 2.7 — a source whose local node is unknown (not connected, MQTT bridge, `meshcore_mqtt` ingest, Reticulum) returns 200 with `{ items: [], nextBefore: null }`, not an error, once the read gate has passed — why: without an own node nothing can be "ours"; the feed fills once the device connects — cost if wrong: the UI cannot tell "not connected" from "no activity"; it already knows connection state.
- **L235** Ruling: 2.7 — time base: Meshtastic `timestamp` (server receipt ms); MeshCore `createdAt` (server arrival ms, as `listMessages` since #5973) — why: these are the server clock, comparable across rows; MeshCore `timestamp` is the remote clock — cost if wrong: ordering differs slightly from a view that sorts on the device clock.
- **L236** Ruling: 2.7 — a message that both replies to us and mentions us is one `reply` item (reply wins over mention) — why: one event, one row — cost if wrong: none.
- **L237** Ruling: 2.7 — messages from any of MeshMonitor's own nodes (`getOwnNodeNums()` / `getOwnPublicKeys()`, the sets behind `isOwnNodeNum`) are never items, not only the source's own node — why: a sibling radio's reply is our own traffic (#4593) — cost if wrong: a multi-radio install would not see its other radio's replies, which is arguably the point.
- **L238** Ruling: 2.7 — MeshCore DM / room conversation: `peerId` is whichever end is not our key (`toPublicKey` for a room post). `fromId` is the stored `fromPublicKey`, which is `channel-N` for received channel rows (the wire carries no sender key); `fromName` is the stored name, else the first 12 characters of the key — why: these are the identities the table has — cost if wrong: Task 2.8 cannot link a channel reactor to a contact (it never could).
- **L239** Ruling: 2.7 — the route uses `optionalAuth()` plus the source-scoped read resolution, with no `requirePermission` — why: the brief's access rule is the `/api/messages` rule, which is per channel; every check is scoped to `:id` — cost if wrong: none for isolation (tested: a grant on source B → 403 on A).
- **L240** Ruling: controller AW — useOptionalSocket() (additive, non-throwing export in Classic's WebSocketContext.tsx; no Classic caller, no behaviour change) is allowed as a Classic-file change, the minimum Ruling N needs to refetch where a socket is mounted — cost if wrong: a second D18 exception to revert into a Workspace-local lookup.
- **L241** Ruling: controller AX — 2.8 implementer rulings below adopted.
- **L242** Ruling: 2.8 — `/source/:id/activity` on a Meshtastic-family device (MQTT types included) renders the Workspace ActivityFeed under ChatProviders + `useChatRuntime(-1)` (Classic `/messages` location, no DM selected, so nothing is marked read); App is not mounted; MeshCore keeps today's page on that URL — why: Ruling AD; the page needs the poll for channel and node names and a socket for `message:new` — cost if wrong: one route branch.
- **L243** Ruling: 2.8 Ruling N — `useActivity` refetches on `message:new` from the nearest source socket (`useOptionalSocket`, a new non-throwing accessor in WebSocketContext, Rule X); with no socket (the shell's bell and tab bar) it refetches when the shell's already-polled **unread counts** for that device change, read from the cache with `skipToken` and never fetched; no `refetchInterval` and no timer; refetches share one in-flight request — why: there is no app-level socket above the source routes, and the unread counts are already polled every 10 s for the open device — cost if wrong: a tab or bell for a device that is not open (Home on `/you`) stays stale until the device is opened; a reaction that does not change an unread count is picked up on the next change or remount.
- **L244** Ruling: 2.8 Ruling AT — an empty page with `nextBefore` set shows Load More (`search.load_more`), even under the e5 empty copy; one `fetchMore` walks past up to 5 empty pages; there is no automatic fetch on load — why: one rule for every page; no unbounded walk of a large table on mount — cost if wrong: a device whose last 2,000 matching rows are all ours shows "Nothing about X yet" with a Load More under it.
- **L245** Ruling: 2.8 — `markSeen` runs only from "Mark all read" (desktop: the panel head and the desktop page header; phone: the ⋯ sheet); opening the tab or panel and scrolling to the top do not mark anything seen — why: both boards draw the unseen dots and the badge (e4: 3) while the feed is open, and e6 draws Mark all read; it is the smallest rule that matches — cost if wrong: the badge persists until the user taps Mark all read; a "mark on open" rule is one effect.
- **L246** Ruling: 2.8 — with no saved pref, every loaded item (at most the first 50, plus any pages loaded) counts as unseen — why: no pref means nothing has been seen — cost if wrong: a first-time viewer sees a badge of up to 50.
- **L247** Ruling: 2.8 — anonymous viewers: no preferences are fetched, no unseen dots or badge, and Mark all read writes nothing (the feed itself still shows if the anonymous user may read messages) — why: anonymous users have no preferences (the server answers 403) — cost if wrong: none.
- **L248** Ruling: 2.8 — Activity is Meshtastic-family only: the phone tab is disabled and the bell is absent on MeshCore, MeshCore MQTT and Reticulum devices (before this, the tab linked to `/activity`, which MeshCore's page redirected to Nodes) — why: "MeshCore chat is Phase 7"; 2.7 already serves MeshCore, so Phase 7 enables it — cost if wrong: one predicate.
- **L249** Ruling: 2.8 — the tab and bell need App's message gate (`messages:read` or any `channel_N:read`; `canReadMessages`, now shared with WorkspaceShell's search gate); without it the tab is disabled and the URL shows `common.permission_denied` — why: the 2.7 route uses the `/api/messages` rule — cost if wrong: a viewer whose only access is a Channel Database entry has no Activity, although the server would serve it.
- **L250** Ruling: 2.8 — the 2.7 reply item gains `targetText` (our replied-to message's text, already loaded by the repository), and the activity types move to `src/types/activity.ts`, re-exported by the repository — why: the boards' "to you: …" line on replies; one shared type — cost if wrong: an additive field.
- **L251** Ruling: 2.8 — "Mark all read" is a new string `workspace.activity.mark_all_read`, not today's "Mark All Read" (`messages.mark_all_read_button`) — why: D9b applies only to the same control; today's button marks messages read on the server, while this one only marks Activity seen — cost if wrong: a key swap.
- **L252** Ruling: 2.8 — e6 check edit: "CHANNELS" → "Channels", "DIRECT MESSAGES" → "Direct messages" (CSS-uppercased section labels, as 2.6's c-home-e1 edit) — cost if wrong: re-add with a style-aware matcher.
- **L253** Ruling: 2.8 — the phone's ⋯ opens a Sheet with one action, Mark all read; the device name under "Activity" opens the device switcher (PhoneShell's `openSwitcher` through ShellDevicesContext) — why: the board draws ⋯ and ⌄ without their contents — cost if wrong: one sheet.
- **L254** Ruling: 2.8 — the panel is a right Sheet (modal, with a backdrop), not a non-modal side panel; Sheet gains an `actions` head slot for Mark all read — why: Ruling 2.5, the Sheet is the one overlay pattern — cost if wrong: a non-modal variant.
- **L255** Ruling: 2.8 — a reply row shows the reply text above the "to you:" quote; a mention row shows only its text, as a quote line; reaction chips are read-only (no tap to react from Activity) — why: e4's first row; nothing in the feed sends — cost if wrong: layout only.
- **L256** Ruling: 2.8 — fixture: five Station G2 items (three between midnight and now, two yesterday, so the groups never flake near midnight), Station G2's last seen an hour before midnight (three unseen), and every other device empty — cost: none.
- **L257** Ruling: 2.8 — the board's sun (theme) button in the sidebar header is not built — why: no theme toggle exists in the Workspace yet (appearance is under Preferences) — cost if wrong: one button.
- **L258** Ruling: 2.8 — a failed Mark all read shows an error toast (`workspace.activity.mark_read_failed`) and keeps the badge — why: DmInbox precedent — cost if wrong: copy.
- **L259** Ruling: controller AY — 2.9 implementer rulings below adopted; the reply/mention push winning the shared dedup key over the templated message push stands (only users who opt in via Task 5.8 can see it; exactly one notification either way); multi-source arrival order may pick either framing — final review may swap the call order so today's templated push wins — cost if wrong: one call reordered.
- **L260** Ruling: controller AZ — one notifyOnMention toggle now carries two policies: MeshCore keeps its 5-minute per-sender cooldown and skips DMs; Meshtastic has no cooldown (D13, at most one push per message) and fires in DMs. Task 5.8's copy must not imply they behave the same — cost if wrong: a cooldown added later.
- **L261** Ruling: 2.9 — The push uses `broadcastToPreferenceUsers` (toggle-gated, `messages:read`, venue mute) and does not run the full `shouldFilterNotificationAsync` — why: the full filter applies `enabledChannels` (default `[]`) and keyword lists, which would silence nearly every reply push. "Readability, mutes" are the parts of that filter that apply here. — cost if wrong: replies on channels a user has disabled for message pushes still notify.
- **L262** Ruling: 2.9 — The venue read check is the `GET /api/messages` rule (`resolveMessageReadAccess.canReadChannel`, DM = -1), added as `muteVenue.meshtasticReadGate` — why: the feed and the push must agree on who may see the message (controller resolution 1), and the source-level `messages:read` alone would leak channel text. — cost if wrong: a user with only channel grants gets no reply/mention push.
- **L263** Ruling: 2.9 — The reply/mention push carries the packet's dedup key and runs before the message push — why: one notification per message per recipient, the same as the MeshCore mention pattern. — cost if wrong: a user with DMs on loses the templated DM push for a DM that is a reply to us and gets the reply push instead.
- **L264** Ruling: 2.9 — "Our message" for a reply means the target row `${sourceId}_${ownNodeNum}_${replyId}`, sent by this source's own node and not spoofed, using the helpers shared with the Activity feed. Senders from any own node (Ruling AU) are excluded — why: identical to the feed. — cost if wrong: a reply to a message sent by another MeshMonitor radio on a different source never pushes.
- **L265** Ruling: 2.9 — A source with no known own node (not yet connected, MQTT bridge/broker) sends no reply/mention push — why: the feed returns empty there too, and an MQTT source has no own node. — cost if wrong: reply/mention pushes are missed for MQTT-only setups.
- **L266** Ruling: 2.9 — Titles are "Reply in #channel · Source" or "Mention in #channel · Source" ("a direct message" for DMs), and the body is "Sender: text" capped at 240 characters — why: modelled on the MeshCore mention alert. Copy for the UI comes in Task 5.8. — cost if wrong: cosmetic.
- **L267** Ruling: 2.9 — A tapback is never a reply push or a mention push, using `isTapbackMessage` (`emoji === 1`, or emoji-only text with a `replyId`) — why: controller resolution 2 and the feed's rule. — cost if wrong: none expected.

#### Task 3.1 — device map, layers drawer, peeks

- **L278** Ruling: controller BA — Rule X carve-out for tests that read source as text: NodesTab.positionHistoryBound.test.ts and NodesTab.assetPlayback.test.ts may change only which file(s) they read (now the shared hooks), with every assertion verbatim; position history and asset playback are extracted into shared hooks (usePositionHistory, usePositionTrail, PositionHistoryHoursSlider) used by App, NodesTab and the Workspace device map — why: those tests pin code location, not behaviour (Ruling B: untouched = look and behaviour); deferring only moves the same problem to 3.4, and a copy would duplicate ~150 lines — cost if wrong: revert two path edits and keep a Workspace copy.
- **L279** Ruling: controller BB — the 3.1 implementer rulings below are adopted. The position-history deferral the implementer first proposed is superseded by BA: the device map draws the trail, the duration slider, the thinned hint and the playback bar. Map buttons are 44 px, as board Main draws them (Main.dc.html .fab 44×44), not the 36 px desktop-button default — why: the board wins over the general default for map buttons — cost if wrong: one CSS size.
- **L280** Ruling: 3.1 — The Workspace device map is `/source/:id/map` (Meshtastic family, not meshcore_mqtt); the sidebar's Map row leads there, Nodes stays `/source/:id/nodes` (today's tab until 3.3); Classic users are sent to `/nodes` (classicFallback) — why: Map and Nodes are separate tools (ds2) and `/nodes` keeps its meaning — cost if wrong: one route and one TOOL_TABS entry.
- **L281** Ruling: 3.1 — The phone Home's Map tile still opens today's Nodes tab until 3.2's phone map — why: brief/controller: do not build the phone map — cost if wrong: one line in PhoneHome (shortcut comment).
- **L282** Ruling: 3.1 Ruling AD — `/map` runs useChatRuntime(-1) and useSourceView under ChatProviders (Classic `/nodes` location) plus its own MapProvider; App is not mounted — why: one owner per screen; `/nodes` makes the quick age filter and sort apply as on Nodes — cost if wrong: one route branch.
- **L283** Ruling: 3.1 Ruling N — Neighbour links are fetched (`GET /api/sources/:id/neighbor-info`) only while Show Neighbor Info is on, with no refresh interval; App's 60 s refresh is not carried over; traceroutes come with the poll — why: no new timer — cost if wrong: a link goes stale until the layer is toggled or the page refocuses.
- **L284** Ruling: 3.1 Rule X — DeviceMapLayers takes NodesTab's contiguous markers → neighbour-links run only; aircraft trails, cross-source, traceroute-confirmed, packet flights, ducting and position history stay inline in NodesTab — why: five Classic wiring tests read those JSX blocks from NodesTab.tsx, and Rule X forbids test edits — cost if wrong: the Workspace map repeats five one-line layer mounts.
- **L285** Ruling: 3.1 — `computeNeighborLinkStyle` moved into DeviceMapLayers and NodesTab re-exports it — why: the Workspace must not import NodesTab (it pulls in the global nodes.css); NodesTab.test imports it from NodesTab — cost if wrong: none.
- **L286** Ruling: 3.1 controller AJ closed — NodeActionMenus › Organise lists today's "Center on Map" when the node has a position (no gate, as Classic's Actions menu); it navigates to `/source/:id/map` with `state.focusNodeId`, and the map opens and centres that node's peek and drops the state with a replace — why: controller decision 1; same mechanism as useSearchFocus — cost if wrong: one menu item.
- **L287** Ruling: 3.1 — A marker or link click opens the Workspace peek instead of Classic's Leaflet popup; closing the node peek clears the selection (it replaces "Dismiss Traceroute") — why: s15n4 "NodePopup is the map peek" — cost if wrong: none.
- **L288** Ruling: 3.1 — One right-hand panel slot is shared by the node peek, the neighbour peek and the Layers drawer; 15-09's peek is docked right, not top-left — why: one open thing at a time (D9c), simpler layout — cost if wrong: CSS position only.
- **L289** Ruling: 3.1 D9b — Layer toggles keep today's labels ("Show Route Segments", "Show Cross-Source Links", "Show Estimated Positions", "Show Accuracy Regions", "Show Position History", "Show Waypoints", "Map age filter", "Ducting", "Show RF/UDP/MQTT", …); new labels only for controls that had no en.json string (Tiles, View 2D / 3D terrain, Map style, Legend, Packet monitor, group names) — why: D9b — cost if wrong: string swaps.
- **L290** Ruling: 3.1 — Group placement: Base map = Tiles (replaces "Show Tile Selection"), View 2D/3D (only when DEM is available), Map style, more: Legend; Nodes = age filter, RF/UDP/MQTT (hidden on MQTT-only sources), Estimated positions, Accuracy regions, more: aircraft (incl. aged-out, trails); Links = Route segments, Cross-source (+ Traceroute-confirmed sub-toggle); Analysis = Show Traceroute, Show Neighbor Info; Overlays = Position history (+ Points only), Waypoints, each GeoJSON layer, Ducting, more: ATAK, Polar grid, Packet flights, Local markers, Spread nodes, Animations, Packet monitor (when readable and logging is on) — why: f2 board's groups with ds2's "nothing removed" — cost if wrong: moving rows.
- **L291** Ruling: 3.1 — Measure Distance and Fit all are map buttons (MapControls), not drawer rows; "+ Waypoint" / "+ Local marker" are left to 3.6's context menu — why: board Main draws them as map buttons; s15n3 puts creation in the right-click menu — cost if wrong: two buttons.
- **L292** Ruling: 3.1 — The MapContext table test excludes only `setShowMeshCoreNodes`, with its reason in the test — why: MeshCore nodes are drawn on the Overview map only; a no-op switch on a Meshtastic device map would mislead — cost if wrong: one switch in the drawer.
- **L293** Ruling: 3.1 — No "Cluster nearby nodes" row; f2 check drops it — why: clustering is today's Settings › Map preference (server-saved on Settings save), not a map control; a drawer toggle would only change local state that the next settings load overrides — cost if wrong: one row in Phase 6's map prefs or here.
- **L294** Ruling: 3.1 — No Reset in the drawer — why: MapContext exports no defaults and today has no reset; nothing new — cost if wrong: one button.
- **L295** Ruling: 3.1 — No Online / Favourites chips and no list sort button in 3.1 — why: no "online" filter exists today; Favourites and sort belong to 3.3's shared NodeFiltersSheet / table (shared via usePersistedNodeFilters and UIContext) — cost if wrong: two chips and one button in 3.3.
- **L296** Ruling: 3.1 D9b — The toolbar's age chip is today's NodeQuickAgeFilter, the search is today's list filter (`nodes.filter_placeholder` "Filter nodes...", shared with Nodes), More filters opens today's AdvancedNodeFilterPopup — why: D9b / reuse until 3.3 — cost if wrong: 3.3 replaces them.
- **L297** Ruling: 3.1 — Peek gates: Message needs messages:read (today's popup "More details" gate); the three menus need a signed-in viewer (as the DM header); Open node page is always shown — why: today's gates — cost if wrong: one condition each.
- **L298** Ruling: 3.1 — The peek's "last route" is today's TracerouteBody ("Last Traceroute", Forward/Return) — why: D9b and "NodeCard sections" in the brief — cost if wrong: restyle.
- **L299** Ruling: 3.1 — The neighbour peek's transport reads RF / UDP / MQTT (today's popup says "RF (LoRa)", hardcoded, not en.json) — why: board text wins where no en.json string exists — cost if wrong: one string.
- **L300** Ruling: 3.1 — Waypoints on the Workspace map are view-only in 3.1 (no edit/delete actions passed) — why: waypoint editing is 3.6 — cost if wrong: none after 3.6.
- **L301** Ruling: 3.1 Ruling Q — Main/f2 drop "Find a node on the map" (search placeholder/aria-label); f2 swaps CSS-uppercased headings for their DOM text ("Base map", "Links", "Overlays"; "ANALYSIS" dropped as "Analysis" covers it); 15-09 drops "↔" "→" (UiIcon arrows: no Unicode icons in JSX) — why: textContent cannot see them — cost if wrong: re-add with attribute/icon-aware matchers.
- **L302** Ruling: 3.1 D9b — f2 check swaps "Max age" → "Map age filter", "Estimated positions" → "Show Estimated Positions", "Route segments" → "Show Route Segments", "Heard by other devices" → "Show Cross-Source Links", "Position history" → "Show Position History", "Ducting forecast" → "Ducting" — why: today's strings label those controls — cost if wrong: string edits.
- **L303** Ruling: 3.1 — The Athens fixture turns the ducting overlay on (`ductingOverlayEnabled: 'true'`) so f2 can show Ducting — why: DuctingControl renders nothing until an admin enables it — cost if wrong: fixture-only.
- **L304** Ruling: 3.1 — Playwright blocks service workers (`serviceWorkers: 'block'`) — why: PWA SW requests skip page.route and reach vite preview (502), which made 15-09 flaky — cost if wrong: none for boards; an SW-specific test would need its own config.
- **L305** Ruling: 3.1 ⚠️-1 — map buttons are 44 px, the board's measured size, not the 36 px desktop button rule — why: board Main sets 44×44 on these map-surface buttons — cost if wrong: one CSS value.
- **L306** Ruling: 3.1 D9b — list rows and the peek use today's formatRelativeTime ("2 minutes ago"), not the board's "4m" / "4 min ago" — why: today's formatter labels last-heard everywhere — cost if wrong: a compact formatter.
- **L307** Ruling: 3.1 — the peek's Distance has no compass bearing ("12.4 km", not "12.4 km NE") — why: today's getDistanceToNode gives distance only; a bearing would be new — cost if wrong: one helper call.
- **L308** Ruling: 3.1 — no colour dash beside Route segments / Heard by other devices in the drawer — why: the line colours come from the overlay scheme and the legend already shows them — cost if wrong: two swatches.
- **L309** Ruling: 3.1 — the open link is not redrawn thick or green on the map — why: the shared NeighborLinksLayer has no selected state today — cost if wrong: one pathOptions override.

#### Task 3.2 — phone map

- **L312** Ruling: controller BC — the 3.2 implementer rulings below are adopted. The phone sheets (peek, Layers, list) stay modal: they cover the tab bar and dim the map, though g1/g2 draw a non-modal sheet. It is flagged for final-review triage — why: one Sheet primitive and focus model across the Workspace (2.8, 3.1); a non-modal sheet needs a new focus/inert model — cost if wrong: a non-modal Sheet variant.
- **L313** Ruling: 3.2 — PhoneMap is the phone layout inside DeviceMap (DeviceMap branches on useIsPhone and hands PhoneMap the groups, rows, map buttons and status lines), not a second route component — why: resolution 1 (no duplicate data wiring); the map, layers and hooks are one copy — cost if wrong: lift DeviceMap's body into a hook and give PhoneMap its own map.
- **L314** Ruling: 3.2 — `/source/:id/map` has no phone device header (PhoneShell ownHeader), the tab bar stays with Home active — why: g1 draws a full-screen map with its own Back — cost if wrong: one matchPath.
- **L315** Ruling: 3.2 — Back goes to the phone Home `/source/:id` with today's "Back" label — why: board's "Back to Home"; `common.back` is today's string on the channel/DM headers — cost if wrong: one string.
- **L316** Ruling: 3.2 D9b/Q — the search pill is today's node filter ("Filter nodes..." / "Filter nodes"); g1 check drops "Find a node" — why: resolution 4; placeholder is not textContent — cost if wrong: re-add with an attribute matcher.
- **L317** Ruling: 3.2 — Node list is a map button opening a bottom sheet with the desktop list's rows (`MapNodeRows`: "On the map · N", Open in Nodes) — why: the board's "Node list" button; one rows component for both layouts; gives the phone a way to a node besides tapping a pin — cost if wrong: link to Nodes instead.
- **L318** Ruling: 3.2 — no "Live packets" map button on phone; Packet monitor stays in Layers › Overlays › more (when readable and logging is on) — why: 3.1's group placement; PacketMonitorPanel is a desktop panel — cost if wrong: one button that toggles the same flag.
- **L319** Ruling: 3.2 — no More filters / quick age chip on the phone map; the age window is Layers › Map age filter, the full filters are on Nodes (3.3) — why: the board draws only the pill — cost if wrong: one chip.
- **L320** Ruling: 3.2 — the Layers sheet holds the same `useDeviceLayerGroups` groups as the drawer; g2 check swaps "Satellite"/"Topo" → "Base map"/"Tiles", "Max age" → "Map age filter", "Estimated positions" → "Show Estimated Positions", "LINKS"/"OVERLAYS" → "Links"/"Overlays", "Heard by other devices" → "Show Cross-Source Links", "Position history" → "Show Position History", "Ducting forecast" → "Ducting", and drops "Cluster nearby nodes" — why: resolution 2 and 3.1's D9b / cluster rulings — cost if wrong: string edits.
- **L321** Ruling: 3.2 — no Reset and no Done in the Layers sheet; the Sheet's × closes it — why: 3.1 (no reset today); Done would duplicate Close — cost if wrong: one button in Sheet `actions`.
- **L322** Ruling: 3.2 — the phone peek shows Message and Ask the node / Organise / Data as four tiles, each opening the existing Node actions sheet on its tab (new NodeActionMenus `buttons` variant) — why: s15n5 — cost if wrong: one variant.
- **L323** Ruling: 3.2 — the phone peek has no last-route section (TracerouteBody); it is on the node page — why: board g1 draws none and its check is `absent: Trace` — cost if wrong: one block.
- **L324** Ruling: 3.2 — the g1 board test and Playwright shot first turn Show Traceroute off (today defaults it on, with its "Traceroute mode" banner, which contains "Trace") — why: D9d keeps today's default and banner; the board shows the off state — cost if wrong: hide the banner on phone.
- **L325** Ruling: 3.2 — the phone peek keeps today's six stats (two rows of four) and "Distance", not the board's four and "Away" — why: 3.1's set; D9b — cost if wrong: drop two stats.
- **L326** Ruling: 3.2 — swipe up = `Sheet.onSwipeUp` (opt-in, bottom sheets): pointerdown on the sheet, pointerup on the layer, ≥ 64 px upward; no timer, no velocity, no dependency; Open node page stays as the keyboard / screen-reader path; a press in a sheet opened from the peek does not count — why: resolution 3 — cost if wrong: threshold tweak.
- **L327** Ruling: 3.2 — on phone, centring on a node puts it in the top quarter of the map (half a map lower than MapCenterController's target), so the peek sheet does not cover it; desktop is unchanged — why: g1 shows the node above the sheet; MapCenterController is shared Classic code and stays as is — cost if wrong: drop the helper.
- **L328** Ruling: 3.2 — the neighbour peek is a bottom Sheet on phone, eyebrow + names in its title; 15-21 check drops "↔"/"→" — why: 15-21; Ruling Q as 15-09 — cost if wrong: none.
- **L329** Ruling: 3.2 — the phone sheets (peek, Layers, list) are the modal `Sheet` primitive over the tab bar, with its backdrop — why: one sheet primitive (focus trap, Esc, restore focus), as 3.1's phone peek — cost if wrong: a non-modal, tab-bar-aware sheet variant.
- **L330** Ruling: 3.2 — a swipe-up sheet takes vertical touch drags everywhere, its scrolling body included (`touch-action: pan-x` on the sheet and its `.body`). The cost is that a swipe sheet's content does not scroll by touch, so its content must stay short; the phone peek is about 450 px at 390×844 — why: the board's hint invites a swipe anywhere on the peek, and a handle-only start would leave a target about 60 px tall — cost if wrong: limit the swipe start to the handle and head (one `contains` check) and drop the body rule.

#### Task 3.3 — nodes table, list, filters, add from URL

- **L333** Ruling: controller BD — the 3.3 implementer rulings below are adopted. Its proposed 'no list virtualisation' is rejected: the table and list are virtualised like Classic NodesTab, which measured the jank of drawing every row. The tests were written after the code; that is recorded, not redone. The fix round's tests were written failing-first — cost if wrong: weaker RED evidence for the column-persistence, drag and Alt+Arrow tests.
- **L334** Ruling: 3.3 — `/source/:id/nodes` (Meshtastic family, not meshcore_mqtt) is the Workspace's NodesPage under ChatProviders (`nodes`) + MapProvider, with useChatRuntime(-1) and useSourceView; App not mounted; phone draws its own header — why: brief and Ruling AD, as `/map` — cost if wrong: one route branch.
- **L335** Ruling: 3.3 — the map's More filters opens NodeFiltersSheet (AdvancedNodeFilterPopup stays Classic's only) — why: ds2 "shared filters", one filter UI; same state (`nodeFilters` + UIContext securityFilter); 3.1/3.2 tests unedited — cost if wrong: restore one element in DeviceMap.
- **L336** Ruling: 3.3 D9b/D9d — NodeFiltersSheet uses the popup's i18n keys and behaviour: changes apply at once, Apply closes, Reset All resets; checks swap "All nodes"→"All Nodes", "Flagged only"→"Flagged Only", "Hide flagged"→"Hide Flagged", "Public key crypto"→"Public Key Crypto", "Remote admin"→"Remote Admin", "Favourites"→"Favorites", "Favourite locked"→"Favorite locked", "Hops away"→"Hops Away", "Device role"→"Device Role", "Power source"→"Power Source", "Reset all"→"Reset All" (15-10, 15-14) — why: D9b, Ruling I — cost if wrong: string swaps.
- **L337** Ruling: 3.3 — Channel stays today's per-channel checkbox list (desktop list, phone disclosure), not a single select — why: D9d, today's filter is multi-select — cost if wrong: a select limited to one channel.
- **L338** Ruling: 3.3 — More filters is a right-docked Sheet on desktop, a bottom Sheet on phone (Device Role and Channel behind `<details>` there) — why: one Sheet primitive (3.1/3.2); s15n5 "opens as lists" — cost if wrong: a dropdown panel variant.
- **L339** Ruling: 3.3 — quick chips: desktop All / Online / Favorites with counts, phone Online / Favorites / Direct (a second tap returns to all); a local view scope, not persisted, applied after the shared filters. Online = `isHeardRecently` (the shell's "N online" 2-hour window); Direct = 0 hops — why: 3.1 handed Online/Favourites to 3.3; no online filter exists to share — cost if wrong: move the scope into usePersistedNodeFilters.
- **L340** Ruling: 3.3 — no Role ▾ chip — why: Device Role is in More filters; a second roles UI duplicates it — cost if wrong: one popover reusing the sheet's role checks.
- **L341** Ruling: 3.3 D9b — sort is today's NodeSortControls (options "Sort: Name"… "Sort: Updated"), plus sortable table headers on the same UIContext sort; g3 check swaps "Last heard"→"Sort: Updated" — why: D9b — cost if wrong: a sort button labelled by column.
- **L342** Ruling: 3.3 Ruling Q — f3 and g3 drop "Search nodes" (placeholder), 15-15 drops "https://meshtastic.org/v/#" (placeholder/textarea value); the search is today's list filter "Filter nodes..." (3.1/3.2) — cost if wrong: re-add with attribute matchers.
- **L343** Ruling: 3.3 Ruling Q/D9b — f3 swaps CSS-uppercased headers for DOM text and today's labels: "BATTERY"→"Battery", "LAST HEARD ▾"→"Last Heard" (nodes.last_heard; the ▾ is a UiIcon), "DISTANCE"→"Distance", "HARDWARE"→"Hardware", "COLUMNS · DRAG TO REORDER"→"Columns · drag to reorder", "Show on map"→"Show on Map" (node_popup.show_on_map), "Public key"→"Public Key" (node_details.public_key) — cost if wrong: string edits.
- **L344** Ruling: 3.3 — column labels reuse today's strings (nodes.hops, node_popup.snr, workspace.map.rssi, nodes.battery, nodes.last_heard, nodes.hardware, node_details.firmware, nodes.uptime, workspace.map.ch_util, nodes.air_util_tx "Air Util TX", node_details.position, node_details.public_key, node_details.via_mqtt); only "Distance" is new — why: D9b — cost if wrong: string swaps.
- **L345** Ruling: 3.3 — SNR and RSSI cells show only for direct nodes ("—" otherwise) — why: today's Nodes list rule (they describe the last relay further out) — cost if wrong: drop one condition.
- **L346** Ruling: 3.3 — `workspace.nodes.columns` stores the ordered list of visible column ids via useUserPreferences.setPref; unknown ids are dropped on read; guests keep a page-only choice; no server change (the key matches the existing `workspace.*` allow-list pattern) — why: Task 2.8's pattern — cost if wrong: none.
- **L347** Ruling: 3.3 — Columns reorder by drag and by Alt+Up/Alt+Down on a column's checkbox (hint in the heading's title) — why: board "drag to reorder", with a keyboard path — cost if wrong: up/down buttons.
- **L348** Ruling: 3.3 — the table's star is a mark, not a toggle; Favourite stays in the node's Organise menu — why: toggling favourite sends an admin command to the device; this task sends nothing — cost if wrong: one button calling view.toggleFavorite with today's gate.
- **L349** Ruling: 3.3 — rows open `${base}/node/:nodeId` with NodePeek's `focusDmNodeId` state (desktop: the name is the link; phone: the whole row) — why: controller brief; 3.4 builds the page — cost if wrong: none.
- **L350** Ruling: 3.3 — Add node from URL is a + in the Nodes header on desktop and phone (not a ⋯ menu), today's ImportContactUrlModal with a new optional `note` prop carrying the SendsLine; disabled with "Needs nodes:write" without nodes:write on the source — why: a one-item ⋯ menu adds nothing; Classic DOM unchanged without `note` (Rule X) — cost if wrong: a ⋯ menu; a bottom-sheet wrapper for phone.
- **L351** Ruling: 3.3 — Export is today's icon ExportMenuButton (desktop only), exporting the rows shown — why: reuse; phone board has no Export — cost if wrong: a labelled button.
- **L352** Ruling: 3.3 — today's quick age window (NodeQuickAgeFilter) sits beside the count (desktop subtitle, phone count line), as Classic's Nodes header — why: board draws none; today's placement; keeps the toolbar narrower — cost if wrong: a chip in the toolbar.
- **L353** Ruling: 3.3 — no presence dot on phone avatars; never-heard rows are dimmed on desktop — why: not today's list; minor — cost if wrong: one span.
- **L354** Ruling: 3.3 Rule X — extracted `toggleInSelection` (popup role/channel toggle) and `filterNodeList` (NodesTab's list filters) into utils/nodeAdvancedFilter.ts, moved `MESHTASTIC_SORT_OPTIONS` to utils/nodeSort.ts; Classic DOM and tests unchanged — why: one copy of each rule — cost if wrong: inline copies.
- **L355** Ruling: 3.3 — `themeColors` moved from DeviceMap to workspace/map/themeColors.ts, used by NodesPage too — why: useSourceView builds traceroute paths that read them — cost if wrong: none.
- **L356** Ruling: 3.3 — the Athens fixture gains "Penteli Hiker" (importedAt set, never heard) — why: the Imported row of f3/15-15; no other test changed — cost if wrong: fixture-only.
- **L357** Ruling: 3.3 — WorkspaceApp.test: `/nodes` routes now expect the `nodes` stub; the socket and stays-mounted cases that used `/nodes` as an App route use `/settings` and `/channels` — why: `/nodes` is no longer App — cost if wrong: none.

#### Task 3.4 — node page

- **L360** Ruling: controller BE — the node page's Admin tab is shown to every reader of the node. Each part keeps Classic's own gate: Notes and Channel are read by all and edited with nodes:write; Asset tracking needs settings:write. Only the remote-admin link needs isAdmin, set in RemoteAdminLink's enabled — why: ds4 'shows to those allowed' is per item; Classic gates only the remote-admin link (MessagesTab.tsx:2635-2643). This replaces controller resolution 4 (admin-only tab) — cost if wrong: re-gate one tab.
- **L361** Ruling: controller BF — the 3.4 implementer rulings below are adopted, except the admin-only tab and the TelemetryGraphs-only Telemetry tab, which the fix round superseded. Classic components embedded unchanged keep their own react-query refetch (useTelemetry 30 s, useSmartHops 60 s). Ruling N forbids new intervals that Workspace code adds; it does not forbid the existing behaviour of reused components. These are server reads only and send nothing over the radio — cost if wrong: wrap the components to disable refetch.
- **L362** Ruling: controller BG — Temperature, Next hop, Rebroadcast and sparklines stay off the Overview — why: Classic has none of them (no new features) — cost if wrong: new data plumbing.
- **L363** Ruling: 3.4 — `/source/:id/node/:nodeId[/telemetry|links|position|admin]` (Meshtastic family, not meshcore_mqtt) is the Workspace NodePage under ChatProviders (`nodes`) + MapProvider, with useChatRuntime(-1) and useSourceView; App not mounted; phone draws its own header — why: brief, Ruling AD as `/map` and `/nodes` — cost if wrong: one route branch.
- **L364** Ruling: 3.4 Rule X — `TracerouteHistoryList` (the modal's content), `useNodeNotesDraft` and `nodePositionSource` extracted; Classic DOM and tests unchanged — why: one copy of each — cost if wrong: inline copies.
- **L365** Ruling: 3.4 — The page's node is the map's selection (MapContext `selectedNodeId`), so `usePositionHistory` loads its trail and NodeMap highlights it; the history switches are MapContext's (server-saved map preferences), so the trail shows on both maps (s15n0) — why: reuse 3.1, one fetch — cost if wrong: none.
- **L366** Ruling: 3.4 — Links shows today's strip (TracerouteStripD, history button off via `showHistory={false}`) above today's history inline; g5's "History · 14" is not built — why: the strip carries Ruling 3.2's "last route on the node page", the inline history makes the button redundant — cost if wrong: one button.
- **L367** Ruling: 3.4 — no "Run traceroute" button on Links; Traceroute stays in Ask the node — why: resolution 6 (sends only from today's controls through NodeActionMenus), no duplicate transmitting control — cost if wrong: one button calling the same action with its Sends line.
- **L368** Ruling: 3.4 — Neighbours: the node's own NeighborInfo rows (`nodeNum === node`) from `GET /api/sources/:id/neighbor-info` (the device map's query key, read once, no timer), today's Purge request with no UI gate and today's confirm words in a ConfirmSheet; hidden when empty, as today — why: resolution 3, s15n4, Ruling N — cost if wrong: a stale list until revisit.
- **L369** Ruling: 3.4 — Overview: one stat set on both widths (Hops, SNR · RSSI, Battery, Ch. util), no sparklines, no Temperature / Next hop / Rebroadcast / Encryption / "Verified" — why: only data the node row carries today; sparklines are a new chart fetch — cost if wrong: a telemetry query per card.
- **L370** Ruling: 3.4 — Position's override card is a pointer ("Data › Override Position"); the dialog stays NodeActionMenus' — why: one Override position entry (s15n0) — cost if wrong: one button.
- **L371** Ruling: 3.4 — Accuracy row always shown ("—" when the device never reported precision; "Exact" / radius as today) — why: the board shows the row; today's unknown case renders nothing in NodeDetailsBlock — cost if wrong: hide the row.
- **L372** Ruling: 3.4 — Admin's key warnings are DmBanners with a new `showDeviceDb={false}` (no device-database banner off the DM), plus Classic's security-issue text for low-entropy / shared keys; no "Security" link — why: today's parts; the device-db banner is about sending — cost if wrong: one prop.
- **L373** Ruling: 3.4 — the phone header collapses with an IntersectionObserver (rootMargin = bar height) on the full header; the bar and the tabs are page-level sticky siblings — why: resolution 5, no timer or scroll listener — cost if wrong: none.
- **L374** Ruling: 3.4 — focusDmNodeId removed from DmHeader, NodePeek, NodesTable, NodesList and useMessageActions — why: every such link now reaches NodePage — cost if wrong: re-add the state (Classic fallback unaffected).
- **L375** Ruling: 3.4 Ruling Q / D9b — check swaps:
- **L376** Ruling: 3.4 — Athens fixture: Rover is a mobile tracked asset on 2.8.0 with stale telemetry and a 16-fix track; Kifisia gains its node-details fields and a NeighborInfo row; the history adds a failed run; the renumbering detection is test-only — why: the boards' states; a default detection would flip NodeActionMenus' merge test — cost if wrong: fixture-only.
- **L377** Ruling: 3.4 — 3.1's positionHistory test sets `asset: undefined` on its Rover override — why: it covers the paged (non-asset) history and Rover is now an asset by default — cost if wrong: none.
- **L378** Ruling: 3.4 BE — the tab stays "Admin" for every reader — why: the board's label; no new label invented — cost if wrong: a string.
- **L379** Ruling: 3.4 BE — Admin tab for every reader of the node; parts keep Classic's gates; the remote-admin link needs isAdmin (RemoteAdminLink `enabled`) — why: controller Ruling BE — cost if wrong: one filter.
- **L380** Ruling: 3.4 — the node's packet-type distribution is read once (no 60 s interval) and scoped to this device's sourceId — why: Ruling N; per-source scoping (Classic omits sourceId) — cost if wrong: the chart goes stale until revisit / an unscoped count.
- **L381** Ruling: 3.4 — Signal trend and Show coverage sit under Radio; Status and the remote-admin metadata rows in Identity & security; GNSS sky view on Position — why: where each fits the board's cards — cost if wrong: moving a line.
- **L382** Ruling: 3.4 — an unknown `node/<id>/<seg>` shows the Overview and replaces the URL — why: no App fall-through on a Workspace path — cost if wrong: none.

#### Task 3.5 — node dialogs as sheets

- **L385** Ruling: controller BH — the 3.5 implementer rulings below are adopted. ConfirmSheet's Enter-to-submit form also covers the Copy NodeInfo, Position Override and Merge sheets. That stands for now: Enter in a confirm form is an explicit confirm gesture, canConfirm (busy plus the merge check box) still gates it, and implicit submission fires from text fields, not checkboxes. Flagged for the final review, because with Push ticked an Enter in the sheet sends one NodeInfo request with no click on Confirm — cost if wrong: a submitOnEnter={false} option on ConfirmSheet for the sending sheets.
- **L386** Ruling: 3.5 D9d — Request Telemetry sends on a tap of a type (TelemetryRequestModal), no radio + Request / Cancel as 15-05 / 15-25 draw — why: today's behaviour; the board note does not override it — cost if wrong: a radio group and a Request button.
- **L387** Ruling: 3.5 — the Request Telemetry sheet's Sends line is the board's "Sends 1 telemetry request" (today's modal shows none); the menu item keeps 2.4's "…for the type you pick"; 2.4's NodeActionMenus test string updated — why: controller resolution 2 — cost if wrong: one string.
- **L388** Ruling: 3.5 Rule X — CopyNodeInfoModal, NodeIdentityMergeDialog and PositionOverrideModal render from `useCopyNodeInfo`, `useNodeIdentityMerge` (+ `mergeActionLabel`, `isMergeDropAction`) and `usePositionOverrideForm`; NodeIdentityChangeNotice gains an optional `mergeDialog` (default the Classic dialog) so the Admin tab opens the sheet; no Classic test edited — why: one copy of each flow — cost if wrong: inline copies in the sheets.
- **L389** Ruling: 3.5 — Copy NodeInfo, Position Override, Purge Data and Merge history are ConfirmSheets (Copy / Override not danger); Request Telemetry is a plain Sheet — why: the shared footer, busy state and focus model; one sheet primitive — cost if wrong: a footer per sheet.
- **L390** Ruling: 3.5 D9d — Copy NodeInfo closes on success with no message, as today's callers do — cost if wrong: a toast.
- **L391** Ruling: 3.5 D9b — Copy's confirm reads today's "Confirm", not "Copy 3 fields"; the donor picker is today's select text; check boxes, not switches, for Push to NodeDB, Use this custom position and Private Position — cost if wrong: label and control swaps.
- **L392** Ruling: 3.5 — Push to NodeDB's Sends line "Sends 1 NodeInfo request on the node's channel" is shown always beside the box (off or on), after today's help line — why: brief copy; the box is the transmitting control — cost if wrong: show it only when ticked.
- **L393** Ruling: 3.5 — Position Override shows "Sends nothing on the mesh" and Merge "Sends nothing on the mesh; MeshMonitor's database only" (board copy) — cost if wrong: two strings.
- **L394** Ruling: 3.5 D9d — Merge keeps today's order (unverified warning above the totals, the server's warnings under "Before you confirm", then the no-undo warning and box), not the board's two warnings under one heading; Retire / Keep show labels and ids, not "until / since" dates (the preview has none) — cost if wrong: block reorder.
- **L395** Ruling: 3.5 — the merge table drops the Column column on phone (15-19), keeps it on desktop (15-06) — cost if wrong: one condition.
- **L396** Ruling: 3.5 — Purge Data moved verbatim into PurgeDataSheet (Ruling 2.4's requests, toasts, no counts, confirm "Purge"); 15-18 check drops "Purge 60 items"; the title gains the board's alert icon — cost if wrong: none.
- **L397** Ruling: 3.5 — Data items carry the board's one-line descriptions (new `workspace.node_menu.*_hint`); Organise items stay without descriptions and switches — why: no today's copy describes them, and their behaviour (favourite sends an admin command to the device) is not the board's "nothing goes on the mesh" — cost if wrong: four strings and a switch look.
- **L398** Ruling: 3.5 — "Who can use these" sits at the foot of the desktop Data menu (Meshtastic, not on MQTT mirrors) and states today's gates: traceroute:write · Traceroute, Request Neighbors; messages:write · Exchange Node Info, Exchange Position, Request Telemetry, Purge Data; settings:write · Scan for Admin; nodes:write · Organise items, Override Position; Copy NodeInfo with nodes:read on its source; admins only + nodes:write · Merge history… — why: the board's "traceroute:write · every ask except Scan" is not today's gate (Ruling 2.4) — cost if wrong: copy edits.
- **L399** Ruling: 3.5 D9b — check swaps: 15-01 / 15-11 / 15-22 "Exchange NodeInfo"→"Exchange Node Info", "Exchange position"→"Exchange Position", "Request telemetry"→"Request Telemetry", "Request neighbour info"→"Request Neighbors", "Scan for admin"→"Scan for Admin", "Favourite"→"Add to favorites", "Favourite lock"→"Set Favorite Lock", "Hide from map"→"Hide from Map", "Clear override"→"Clear aircraft override", "Override position"→"Override Position", "Merge identity"→"Merge history…", "Purge data"→"Purge Data"; 15-05 / 15-25 "Request telemetry"→"Request Telemetry", "Air quality"→"Air Quality", "Position override"→"Position Override", "Private position"→"Private Position", "Purge data for Kifisia Rooftop"→"Purge Data for Kifisia Rooftop"; 15-18 the same title, "All messages"→"Purge All Messages", "Position history"→"Purge Position History", "Delete node"→"Delete Node", "Purge from device and database"→"Purge from Device AND Database" — cost if wrong: string edits.
- **L400** Ruling: 3.5 D9d — 15-01 / 15-11 drop "Not aircraft": today offers Mark as aircraft or Mark as not aircraft, never both (`aircraftMarkActions`), so the segmented control is not built — cost if wrong: a three-way control.
- **L401** Ruling: 3.5 D9b — 15-18 drops "Purge 60 items" (no count API; confirm reads "Purge", Ruling 2.4) — cost if wrong: a count fetch.
- **L402** Ruling: 3.5 — fixtures: Kifisia Rooftop has `likelyAircraft: false`, `aircraftManualMark: 'not_aircraft'` (Organise shows Mark as aircraft and Clear aircraft override); defaults serve copy-candidates (Athens MQTT donor), the saved position override, and a manual, non-undoable merge preview with one warning — cost: fixture-only.
- **L403** Ruling: 3.5 — Copy NodeInfo's Data reason stays one line ("Needs nodes:write" / "Needs nodes:read"), not the board's "Needs nodes:read on that source and nodes:write here"; the donor's read right is checked by the server per donor — cost if wrong: one string.

#### Task 3.6 — map context menu, waypoints, local markers

- **L406** Ruling: controller BI — i18nLanguageCoverage.test.ts leaves `workspace.*` keys out of the coverage count while the opt-in Workspace layout (#6365) is in preview; KNOWN_PARTIAL is unchanged — why: the threshold decides which languages the picker offers every user, and preview-only strings would otherwise drop zh_Hans (49.87%) for Classic users. Every later phase adds more workspace.* keys — cost if wrong: one filter line. FINAL REPORT ITEM: remove the exclusion before Workspace leaves preview.
- **L407** Ruling: controller BJ — the 3.6 implementer rulings below are adopted. The send-capable-source gate stays: Classic's Map Analysis applies the same rule, while the Classic Nodes map offers waypoint editing on MQTT sources, where a save is stored but never sent. It is flagged for final-review triage — why: the Workspace save says 'Sends 1 waypoint on <channel>', which would be false there — cost if wrong: MQTT-mirror users lose waypoint editing in the Workspace.
- **L408** Ruling: controller BK — FINAL REPORT ITEM, today's server (unchanged, since the task allows no backend changes): a new waypoint with a rebroadcast interval is sent again by the scheduler within ~60 s, because the first send is not recorded as its last broadcast. Waypoint routes also have no HTTP rate limiter. A save does not reset the rebroadcast timer.
- **L409** Ruling: 3.6 — supersedes 3.1's "waypoints view-only": the device map edits and deletes waypoints and local markers under today's gate (waypoints:write on the source); without it the popups have no actions and the menu offers Measure only — why: brief, s15n3 — cost if wrong: drop the actions props.
- **L410** Ruling: 3.6 — waypoint entries (Add waypoint here, popup Edit / Delete…, the hint chip) need a source that can send (`canSourceSendWaypoints`: meshtastic_tcp, enabled), Map Analysis's rule; an MQTT mirror offers local markers and Measure only — why: a save there is stored but never sent, so its Sends line would be false; NodesTab has no such check today — cost if wrong: one condition.
- **L411** Ruling: 3.6 — long-press is Leaflet's map `contextmenu` (touch browsers fire it on a hold: Android natively, mobile Safari via Leaflet TapHold 600 ms / 15 px); no pointer timer of ours, so nothing to clear or leak — why: no new timer (Ruling N), no conflict with Leaflet touch or the peek swipe — cost if wrong: a pointerdown/up/move/cancel hold with a cleared setTimeout for a browser that fires neither.
- **L412** Ruling: 3.6 — the keyboard path is a map button "Map actions" (target icon, first of the map buttons) that opens the same menu at the map centre with the first item focused; Arrow keys move, Esc closes — why: visible, works for touch and screen readers, no hidden shortcut — cost if wrong: one button.
- **L413** Ruling: 3.6 D9d — no "Pick on map…" and no click-to-place mode ("Click the map to place the waypoint" chip); 15-07 / 15-13 checks drop "Click the map to place the waypoint" and "Pick on map" — why: no caller passes `onPickLocation` today, so no surface offers Pick on map; the menu's spot replaces 3.1's "+ Waypoint" placement (s15n3) — cost if wrong: a placement mode that keeps the sheet's draft.
- **L414** Ruling: 3.6 Ruling Q — 15-20 check drops "37.9715, 23.7470" (the pressed spot's coordinates are fake data); a behaviour test asserts the "lat, lon" four-decimal format — cost if wrong: a fixed spot in the test.
- **L415** Ruling: 3.6 D9b — 15-24 check swaps "Both" → "Circle and rectangle" and "Each receiving node alerts its own user" → "Every node that receives this waypoint alerts its user"; 15-26 "Create" → "Save" (today's `common.save` on the marker editor) — cost if wrong: string edits.
- **L416** Ruling: 3.6 D9d — the editors keep today's controls: Shape is a select ("Circle and rectangle" only for a stored both), the marker's Icon and Colour are selects, Expires is a datetime field, Position is two fields, no byte counter — cost if wrong: segmented control, tiles, swatches.
- **L417** Ruling: 3.6 — GeofencePage is part of the waypoint editor, not a route: inline on desktop (15-07), a step inside the same sheet on phone (15-24) with Back, Done and today's summary row — why: the boards draw it inside the editor and its state is the editor's draft — cost if wrong: a route that would need to carry the draft.
- **L418** Ruling: 3.6 — the waypoint editor, both delete confirms and the marker editor are ConfirmSheets (D9c one at a time, shared busy and error state); the phone Geofence step keeps the sheet footer (Cancel / Create) beside its Done — cost if wrong: a footer override.
- **L419** Ruling: 3.6 Ruling BH — ConfirmSheet gains opt-in `submitOnEnter={false}`; the waypoint save and delete sheets use it, so Enter in a field sends nothing; the marker sheet keeps Enter (sends nothing; today's form submits on Enter) — cost if wrong: one prop.
- **L420** Ruling: 3.6 Rule X — WaypointEditorModal and LocalMarkerEditorModal render from `useWaypointEditorForm` / `useLocalMarkerForm` (state, validation, save moved verbatim; `catch (err: any)` typed as `unknown`); the protocol emoji presets carry one `#6365` disable in the hook file; no Classic test edited — cost if wrong: copies in the sheets.
- **L421** Ruling: 3.6 Rule X — `WaypointPopupActions` gains optional `renderActions(wp, locked)`; the Workspace map uses it to show the lock reason as text (today's `mapPins.lockedToOther`) with Edit / Delete… disabled; Classic callers pass nothing and draw today's buttons — why: the board and brief show the text, and today shows it only as a tooltip — cost if wrong: tooltip-only lock text.
- **L422** Ruling: 3.6 D9b — the delete confirm uses today's words split into title "Delete waypoint “{label}”?" and body "This will be broadcast to the mesh. Sending source: {source}", plus the board's bullet and a Sends line; a virtual waypoint shows only "Sends nothing on the mesh"; errors show inline instead of `window.alert`; the local marker delete uses today's "Delete local marker "{label}"?" in a ConfirmSheet instead of `window.confirm` — cost if wrong: copy edits.
- **L423** Ruling: 3.6 — Sends lines: "Sends 1 waypoint on {channel}" (the picker's channel name, no "#"), then ", hop limit N" when pinned and ", then again every N min" when a rebroadcast is set; delete: "Sends 1 waypoint delete on {channel}" + hop limit; markers and Virtual: "Sends nothing on the mesh" — cost if wrong: strings.
- **L424** Ruling: 3.6 — the hint chip shows only to those who may add waypoints on that source (writers on a sending source); not in 3D — cost if wrong: one condition.
- **L425** Ruling: 3.6 — no ring at the pressed spot (15-08 / 15-20) — cost if wrong: one CircleMarker.
- **L426** Ruling: 3.6 — the Athens fixture adds Station G2's Trailhead (own, LongFast, hop 3, 30 min, circle+box geofence) and Lycabettus summit (locked to !a1b2c307); positionHistory.test serves no waypoints so its overlay-path count is unchanged — cost: fixture-only.
- **L427** Ruling: 3.6 — Leaflet's zoom control on the device map moves from bottom 120 px to 172 px to clear the third map button — cost if wrong: one CSS value.
- **L428** Ruling: 3.6 fix — the phone waypoint sheet cannot change step while a number field is rejected (Geofence row, Back and Done off); the save error shows on both steps — why: #5649, a field that unmounts reports valid — cost if wrong: keep both steps mounted and hidden.
- **L429** Ruling: 3.6 fix (controller ruling) — MeasureDistanceController gains optional `startAt`; "Measure from here" seeds anchor A at the node nearest the spot, the Measure Distance button starts fresh; hint "Click a second point; snaps to nodes" — cost if wrong: drop the prop.

#### Task 4.1 — Overview nav, phone home, all-devices map

- **L447** Ruling: controller CA — 5-08-overview-map's full board check belongs to Task 4.3, and plan line 823 now lists it. Task 4.1 accepted only 5-08's frame (Back, search pill, map, tab bar), as 1.6 did for a-chat-D-desktop. Layers, Tools, Time, Traceroutes, the inspector hint and "Find a node" stay open for 4.3. The Layers inconsistency (dropped from f6 because today's toggle is icon-only, kept in 5-08) is 4.3's to settle — why: a board missing from the owning task's list is never accepted — cost if wrong: none.
- **L448** Ruling: controller CB — `.page :global(.leaflet-top.leaflet-left)` in OverviewMap.module.css is accepted, following DeviceMap.module.css:25 (3.1). It is scoped under the module's class and targets Leaflet's own control container, not a Classic class — why: Leaflet's DOM cannot take CSS-module classes — cost if wrong: none.
- **L449** Ruling: controller CC — "All-devices map" (a new string) and the new overview icons supersede Ruling 1.6's "Map via mapNav" in the Overview sidebar only — why: board f6 names the row and the Overview now owns a distinct all-devices map — cost if wrong: one label.
- **L450** Ruling: controller CD — the 4.1 implementer rulings below are adopted. /, /overview and /overview/map share one route element, so the all-devices map stays mounted between them, and the phone gets OverviewHome at /overview (fix round 1).
- **L451** Ruling: 4.1 — `/` and `/overview/map` render OverviewMap (DashboardMap as is, inside its own MapProvider; Unified with 2+ devices, else the first enabled device, as DashboardPage). `/overview` is OverviewHome on phone and OverviewMap on desktop. `/overview/dashboard`, `/overview/audit` and other `overview/*` paths keep the re-host. App and DashboardPage are not mounted — why: brief; Ruling AD; the desktop sidebar already holds the tools — cost if wrong: one route element.
- **L452** Ruling: 4.1 Rule X — DashboardPage's default-landing effect moved verbatim into `hooks/useDefaultLandingRedirect.ts`, called by DashboardPage and by OverviewMap with `skip: !landing`, so only `/` jumps. No Classic test edited — why: one copy of the landing rules — cost if wrong: inline the effect back.
- **L453** Ruling: 4.1 D9b — Overview labels follow 1.6: "Unified Messages", "Unified Telemetry", "Unified Packets", "Map Analysis", "Analysis & Reports", "Automation Engine", "Users", "Audit Log", "Dashboard". New strings: "All-devices map" and "This MeshMonitor". Check swaps: f6 and 5-07 "Automations" → "Automation Engine", "Audit log" → "Audit Log" — cost if wrong: string swaps in overviewTools.ts.
- **L454** Ruling: 4.1 Ruling Q — f6 swaps "THIS MESHMONITOR" → "This MeshMonitor" and "DEVICES" → "Devices" (CSS-uppercased); f6 and 5-08 drop "Find a node" (placeholder); f6 drops "Layers" (today's controls toggle is icon-only, aria "Show Map controls") — cost if wrong: re-add with attribute matchers.
- **L455** Ruling: 4.1 D9d — f6 drops "heard here" (today a cross-source link has no on-map label; its popup says "X heard by Y") and "Pins take the colour of the device that hears them." (no legend card: pins are hop-coloured by default, and Colour nodes by source draws DashboardMap's own legend) — cost if wrong: one card and one label.
- **L456** Ruling: 4.1 — the search pill is today's node-filter wording ("Filter nodes...", aria "Filter nodes", as 3.1/3.2). It narrows the pins passed to DashboardMap by long name, short name or id, and does not move the map: DashboardMap takes no focus target, and its Zoom to fit re-frames on the matches — cost if wrong: a focus prop on DashboardMap (Rule X).
- **L457** Ruling: 4.1 — a popup's "seen by" row opens the Workspace node page (`/source/:id/node/:nodeId`) for a Meshtastic node, or the device for MeshCore. This replaces Classic's `/source/:id/#messages` + `focusDmNodeId` — why: the node page is today's Node Details in the Workspace (3.4) — cost if wrong: one navigate.
- **L458** Ruling: 4.1 — the Devices list shows readable, enabled devices; its state is "N online" when connected, "Receive-only" for receive-only types, else today's status word. "N of M connected" counts the enabled devices the viewer can read — why: ds6 (disabled drop out), Review Focus 2 — cost if wrong: one filter.
- **L459** Ruling: 4.1 — phone tile subtitles: "N nodes" (today's Unified status), "Mesh health", "Live, every device", "Map, Analysis on", "Admins" (Users). No subtitle for Messages, Telemetry, Reports, Automations or Audit Log: their board figures need data the Home does not load (cross-device unread per channel, starred charts, mesh-issues status, rule count), and audit:read is not admin-only — cost if wrong: one fetch per subtitle.
- **L460** Ruling: 4.1 — 5-08 is built as a frame (Back to `/overview`, the search pill, the map, no device header); Tools, Time, the Traceroutes / Neighbours chips, the inspector hint and "Layers 2" are 4.2 / 4.3's, which should own its full expectBoard. No fullscreen button (none today) — cost if wrong: 5-08 checked one task late.
- **L461** Ruling: 4.1 — the 5-07 note reads "Tap Overview at the top to go back to a device" (no ▾ glyph in copy) — cost if wrong: one string.
- **L462** Ruling: 4.1 fix 1 — `/`, `/overview` and `/overview/map` share one route element (`OverviewIndex`, with `landing` only on `/`), so moving between them keeps the one map mounted; the phone's `/overview` is the Overview Home — why: I2 (the rail square and the map row point at different URLs) — cost if wrong: one route element.

#### Task 4.2 — Analysis on the Overview map (desktop)

- **L465** Ruling: controller CE — the Overview map keeps every control the Classic dashboard map offers. The age cut (ageWindow plus the per-node and MeshCore-infra gates) is restored. Colour by source/gateway, the map age filter, Zoom to fit and the positionless-advert hide are restored in the Overview's Layers drawer or map buttons, through Rule X props on the MapAnalysis pieces. Show Route Segments and Show Traceroute must each be either reachable or proven equivalent to an Analysis layer — why: spec anti-goal "a power user cannot find a control they use today"; /overview/dashboard (their only other Workspace path) is replaced in 8.2 — cost if wrong: a few extra drawer rows.
- **L466** Ruling: controller CF — forward constraint for Task 8.2: if the Overview Dashboard drops its map, every DashboardMap control must already be reachable on the Overview map (CE) — why: same anti-goal — cost if wrong: none.
- **L467** Ruling: controller CG — the 4.2 implementer rulings below are adopted, except the first round's 'ruled out on the Overview' list and its 'seen by → #messages' ruling, both superseded by the fix round under CE. The Overview's base map is Map Analysis's canvas. Overview-only behaviour reaches it through two contexts whose defaults leave Classic Map Analysis unchanged (reviewed). The first round and the fix round both wrote code before tests; RED was taken afterwards by stashing — cost if wrong: weaker RED evidence.
- **L468** Ruling: 4.2 A1 — the Overview map's surface is today's MapAnalysisCanvas (Rule X: one optional `workspace` prop for extra 2D layers and the Workspace pin flow; Classic passes nothing). DashboardMap is no longer drawn on `/`, `/overview`, `/overview/map`, `/analysis` or `/overview/analysis`. Its all-devices overlays are re-mounted inside the canvas: GeoJSON, cross-source and traceroute-confirmed links, packet flights, ducting, aircraft trails, and the one fit to the nodes — why: the boards' node inspector, hop shading and the filters acting on pins exist only in Map Analysis; two marker sets on one map is not a merge — cost if wrong: a DashboardMap marker/panel prop set plus selection wiring.
- **L469** Ruling: 4.2 Rule X — MapAnalysisToolbar's layer lists, lookbacks, 3D gate, 2D-only rule, polar-grid gate and Tools moved verbatim to `analysisControls.tsx` (`useAnalysisControls`); the toolbar DOM is unchanged; MapAnalysisToolbar.test and the Classic chrome snapshot are unedited and green — cost if wrong: inline them back.
- **L470** Ruling: 4.2 Rule X — DashboardMap exports `MapBoundsUpdater` (unchanged), so the Overview still opens fitted to the nodes when no Default Map Center is set, as 4.1 did — cost if wrong: none.
- **L471** Ruling: 4.2 — `/analysis` and `/overview/analysis` render `OverviewIndex`, the same element as `/`, `/overview` and `/overview/map`, so the map stays mounted between them. They open with the Layers drawer open (s5n1). `AnalysisRehost` is deleted — cost if wrong: one route element.
- **L472** Ruling: 4.2 s5n1 — "Analysis group expanded" is the drawer open with Analysis as its first group. The groups stay open lists, as in 3.1's drawer (no collapse with summaries) — cost if wrong: a collapsible LayerGroup.
- **L473** Ruling: 4.2 Ruling 3.1 — one right-hand slot holds the Layers drawer or, while something is selected, today's inspector. A new selection closes the drawer. The slot steps left of today's Site Planner / GNSS DOP column while either is open — cost if wrong: CSS.
- **L474** Ruling: 4.2 D9b — the controls keep today's labels from the toolbar's lists: "Neighbors", "SNR Overlay", "Hop Shading", "Accuracy Regions", "Local Markers", "ATAK Contacts", "Polar Grid", "Link Profile", "Site Planner", "Add Waypoint", "Add Local Marker", "Time Slider", "3D View", and lookbacks "24h" / "Last". New strings: Tools, the tool descriptions, "Lookback", "2D only", "Open node page", "Analysis layers on", "Turn off {{label}}", "Layers, {{count}} on" — cost if wrong: string swaps in one module.
- **L475** Ruling: 4.2 D9b/Q check edits:
- **L476** Ruling: 4.2 — the node filter pill (4.1's, "Filter nodes...") is Map Analysis's node search (`nodeFilter`), on desktop and phone. It replaces NodeSearchControl on the Overview — cost if wrong: one component swap.
- **L477** Ruling: 4.2 — Tools › Add Waypoint / Add Local Marker keep today's placement (`usePinAuthoring`: exclusive with the other tools, turns its layer on, Esc cancels, today's source preselect). They open 3.6's sheets, which gain an optional device picker (`sourceChoice` / `storingSource`, today's PinSourcePicker). Popup Edit/Delete use 3.6's footer and confirm sheets in place of `window.confirm`/`alert` — cost if wrong: the Classic modals.
- **L478** Ruling: 4.2 — the Layers count is the number of analysis (timed) layers on, as the board's "Layers 2" — cost if wrong: one sum.
- **L479** Ruling: 4.2 — the fixture's `/api/unified/dashboard` serves stored-row nodes (flat names, position, metrics, `sourceId`), the server's shape; the nested poll fields are kept beside them — cost if wrong: fixture only.
- **L480** Ruling: 4.2 fix I1 — the Overview asks for the Dashboard's age window and gates each node as DashboardMap does: the map age filter over the widest device window, MeshCore infrastructure by its own window (0 = never), favourites and aged-out aircraft exempt, ignored nodes dropped. This supersedes 4.2's "map age filter ruled out" line, which wrongly said the Settings window applied — cost if wrong: none.
- **L481** Ruling: 4.2 fix (CE) — the Map Analysis components take Overview-only behaviour through two contexts with Classic defaults: `DashboardDataOptionsContext` (the age window) and `AnalysisSurfaceContext` (age gate, positionless hide, colour ring, source-row handler). The canvas's `workspace` prop is unchanged — why: about ten Map Analysis data calls and `useAnalysisNodes` run both inside and outside the canvas; one seam keeps the markers, picker, measure and links on the same node set — cost if wrong: thread props through the canvas and layers.
- **L482** Ruling: 4.2 fix Rule X — DashboardMap's age gate, link builders and fit controllers moved verbatim to `dashboardMapLinks.tsx` and `mapFitControllers.tsx`. DashboardMap calls them, its tests are unedited and green — cost if wrong: inline them back.
- **L483** Ruling: 4.2 fix (CE) — the Overview drawer holds today's Dashboard controls: the map age filter, Colour nodes by (Unified only), Hide nodes without a current position advert (with MeshCore nodes), Show Route Segments, Show Traceroute, and Show Neighbor Info (D9b label). Zoom to fit is a bar button. Measure, 3D, RF/UDP/MQTT, waypoints, local markers, ATAK, accuracy regions, polar grid, tiles and legend map to their Map Analysis equivalents, listed in the coverage test — cost if wrong: one row each.
- **L484** Ruling: 4.2 fix I3 — supersedes 4.2's popup ruling: a pin popup's "seen by" row opens the Workspace node page (4.1's handler) — cost if wrong: none.
- **L485** Ruling: 4.2 fix I4 Q/D9d — 5-04 keeps "Line of sight" out (no visible text for it while idle) and moves "500 km" / "Loading terrain" (the board's footnote) to a behaviour test or out. 5-01 keeps "ROLE BADGES" out, because today's legend never shows it beside Hop Shading — cost if wrong: a legend change.
- **L486** Ruling: 4.2 fix — 5-08's phone `/` test waits up to 5 s, since the map chunk now carries the Map Analysis canvas — cost if wrong: a lazy canvas, which needs the jsdom popup issue understood first.

#### Task 4.3 — Analysis on phone

- **L489** Ruling: controller CH — on phone, the inspector, Link Profile and Site Planner/GNSS DOP are non-modal bottom docks (boards 5-10/5-11/5-13 draw them unscrimmed with a live map; tools need map taps). That is an exception to BC for these panels only; Tools and Layers stay modal Sheets — why: board-drawn, and the tools cannot work behind a scrim — cost if wrong: switch to modal and lose map taps.
- **L490** Ruling: controller CI — the f6 'Layers' drop's original Q reason (4.1: "today's toggle is icon-only") is stale since 4.2's desktop bar says "Layers". The drop stands only because desktop tests already assert /^Layers/ — cost if wrong: one check string.
- **L491** Ruling: controller CJ — the 4.3 implementer rulings below are adopted. On the phone, one bottom column owns the stacked Link Profile, Site Planner, GNSS DOP and the docked Time Slider. The column scrolls as one, caps at 60% of the map, and keeps the slider sticky at its foot (fix round 1). TimeSliderControl gains an opt-in docked prop (Rule X).
- **L492** Ruling: 4.3 — the phone Overview map is a column: the map (Back, the node filter, the chips, the pin hint over it), then the inspect hint or today's inspector, then the bar "Map tools" (Tools, Time, Layers N, Zoom to fit). The bar is docked below the map instead of floating over it — why: today's time slider and Link Profile drawer sit at the canvas's bottom edge, and a floating bar would cover them — cost if wrong: CSS plus hiding the bar while a panel is open.
- **L493** Ruling: 4.3 — the board's fullscreen button is Zoom to fit (today's, #4898, DashboardMap's label and title) — why: no fullscreen exists today (4.1), and CE needs Zoom to fit reachable on the phone — cost if wrong: one button.
- **L494** Ruling: 4.3 — Tools and Time open one Tools sheet (5-09 "Tools and Time sheet"): the desktop menu's rows as a radiogroup (`ToolItems`, shared with the desktop menu, same gates and Sends line), then Time › Time Slider (today's switch). Picking a tool closes the sheet. "Time" is a new label on the phone bar because its control opens the sheet; the toggle keeps today's "Time Slider" — cost if wrong: one string.
- **L495** Ruling: 4.3 D9d — 5-09's Start / End / Live controls and "2D only" badge are not built in the sheet. Today's TimeSliderControl on the map holds the window ("Window: … (live)", two ranges), and today's switch is not gated in 3D — cost if wrong: a second slider instance (and its 10 s tick) in the sheet.
- **L496** Ruling: 4.3 (BC exception) — the inspector, the Link Profile drawer and the Site Planner / GNSS DOP column are non-modal docked panels on the phone, not the modal Sheet — why: Link Profile and the planner need taps on the map behind them, and the inspector follows so the next tap inspects the next thing (5-10 shows the live map above). Tools and Layers stay modal Sheets — cost if wrong: a modal inspector Sheet (3.2-style), with the tools kept docked.
- **L497** Ruling: 4.3 Rule X — `AnalysisInspectorPanel` gains optional `onClose` and `footer`; `LinkProfileDrawer` gains optional `stacked` (its own module class, selectors doubled with the global class as AnalysisInspectorPanel.module.css does); `MapAnalysisCanvas`'s `workspace` gains `stackedPanels`, which adds `MapToolPanels.module.css` `.bottomColumn`. Classic passes nothing; DOM and tests unchanged — cost if wrong: the panels' cramped phone forms (side-by-side drawer, top-right column).
- **L498** Ruling: 4.3 — one at a time on the phone: while a tool is on or a tool's panel (Link Profile, Site Planner, GNSS DOP) holds the bottom, neither the inspector nor the hint shows. The inspector's Close clears the selection — cost if wrong: one condition.
- **L499** Ruling: 4.3 (CE) — the phone Layers sheet adds Filters (today's device, node-type, transport and node-picker controls from the desktop bar), after Analysis, and Base map › Legend (today's "Show Legend" browser setting `meshmonitor-showLegend`, shared with the Dashboard map, default off), which draws today's Map Analysis legend on the map. The colour-by key draws on the phone map too. A phone twin of the coverage test asserts every LayerKey, every toolbar control and every DashboardMap control is reachable on the phone, derived from the same sources plus a two-table phone move list — cost if wrong: one group or row.
- **L500** Ruling: 4.3 — `/analysis` and `/overview/analysis` open the Layers sheet on the phone (the desktop's drawer state) — cost if wrong: one initial state.
- **L501** Ruling: 4.3 — 5-08's "Layers" is settled as visible text on both layouts: the phone bar's Layers button carries the word (5-08 keeps it), and since 4.2 so does the desktop bar's. f6's check keeps 4.1's drop, because f6's test reads the sidebar before the lazy map chunk loads and re-adding the word would mean editing 4.1's test. The labelled button is asserted by 5-08 (phone) and the 5-0x desktop tests (`/^Layers/`) — cost if wrong: re-add "Layers" to f6 with a wait in its test.
- **L502** Ruling: 4.3 D9b/Q/D9d check edits:
- **L503** Ruling: 4.3 — the Workspace test `matchMedia` treats a comma list as OR, so phone tests see today's phone forms of Map Analysis panels (MOBILE_LAYOUT_MEDIA_QUERY) — cost if wrong: revert one function; then the phone inspector tests need a mock.
- **L504** Ruling: 4.3 fix I1 — the phone map's bottom has one owner: with `stackedPanels`, the canvas renders the stacked Link Profile drawer, the Site Planner and GNSS DOP panels and the Time Slider (docked, sticky, last) inside the one bottom column, which scrolls as one. This supersedes "two separate bottom docks". Rule X: `TimeSliderControl({ docked })` is opt-in, and Classic renders both components where it did — cost if wrong: arbitrate to one panel at a time instead.
- **L505** Ruling: 4.3 fix I1 — the inspector is held by `heldBy`: a tool, the Link Profile drawer or Site Planner hides it and the hint; GNSS DOP keeps the hint, worded "Close GNSS DOP to inspect a node, route segment, neighbour link or trail" (new `workspace.overview.inspect_dop`) — cost if wrong: one string, or let the inspector share the dock.

#### Task 4.4 — Reports list, Mesh issues, Coverage

- **L508** Ruling: controller CK — the Reports list loading Mesh issues' /summary (same query key as the page, no interval) is accepted under BF — why: it warms the page's cache, and a status-only query would duplicate the forbidden-state logic — cost if wrong: one GET per list open.
- **L509** Ruling: controller CL — the 4.4 implementer rulings below are adopted, except the first round's '6-09 phone findings use today's IssueTable as is', which fix round 1 superseded. On phone, By issue shows 52 px finding rows plus a detail sheet (MeshIssuesPhoneSections). By node and the reused filter and Coverage controls are sized to 44/52 px by element selectors under Workspace module classes, with no :global and no Classic change. The four 4.5 reports open the re-hosted Classic report until 4.5.
- **L510** Ruling: 4.4 — the report registry moves out of AnalysisTab into `analysisReports.ts` (Rule X), with a `slug` per report for the Workspace URL; AnalysisTab maps it to the same cards in the same order, and ReportsList reads the same list; a test asserts every registry report has a row and link under both prefixes — why: no hand-kept list (spec §2 anti-goal) — cost if wrong: one file.
- **L511** Ruling: 4.4 — MeshIssuesReport's data and actions move verbatim into `useMeshIssuesReport`, and CoverageReport's into `useCoverageReport` plus `CoverageSetupGuidance` (Rule X); Classic JSX, DOM and tests unchanged (767 Classic Analysis/pages tests green, unedited) — why: one data wiring for both layouts and both Workspace breakpoints — cost if wrong: revert three files.
- **L512** Ruling: 4.4 — until Task 4.5, Traceroute Explorer, Solar, ok_to_mqtt and NodeInfo Enrichment open today's report component (lazy, same chunks) under ReportFrame at `/reports/<slug>`; `ReportsRehost` is deleted — why: AnalysisTab keeps its selection in local state, so the Classic page cannot open at a report — cost if wrong: 4.5 replaces four map entries.
- **L513** Ruling: 4.4 6-01/6-08 D9b — report titles and descriptions are today's (`Mesh Issues`, `Traceroute Explorer`, `ok_to_mqtt Violations`, `NodeInfo Enrichment`, `Coverage Report`, `Solar Monitoring Analysis`); the list title is "Analysis & Reports" with today's subtitle; checks swap the four titles and drop "Run now" (today's control reads "Run analysis now", which still contains "Run analysis" and "Run") — cost if wrong: string edits.
- **L514** Ruling: 4.4 6-01 — rows keep registry (Classic grid) order, not the board's — why: reordering the registry changes Classic's grid — cost if wrong: a sort in ReportsList.
- **L515** Ruling: 4.4 6-01 — Solar and ok_to_mqtt show "—", Not run yet, "Reads stored data when you run it" and Open; their run is component state and is not stored — why: no last-run API (brief) — cost if wrong: a stored-run endpoint later.
- **L516** Ruling: 4.4 6-01 — Live reports show "On open", Live and "Reads stored data when opened", without the board's per-report counts — why: counts would need each report's queries on the list — cost if wrong: per-row fetches.
- **L517** Ruling: 4.4 6-01 — the Mesh row result counts `findingCount` as "found", not "open" — why: that is what the run returns — cost if wrong: one word.
- **L518** Ruling: 4.4 — the list's Mesh Issues row uses `useMeshIssuesReport` (Run shown once `/status` answers, hidden after a 401/403, "Running…" while in progress), so the list also loads `/summary` — why: identical gates, no duplicated wiring — cost if wrong: a slimmer status-only hook.
- **L519** Ruling: 4.4 6-02/6-09 — the page subtitle is "Last run {time} · from storage · took {n} s" (s6n0) followed by today's "(from the last completed run before restart)" when `lastRunResultFromStorage` — why: s6n0 asks for the line; D9d keeps today's note — cost if wrong: drop one fragment.
- **L520** Ruling: 4.4 6-02 D9b/Q — check drops: "Run now" (today "Run analysis now"), "Traceroute funnel" (today "Traceroute corpus: …" in the evidence preface), "Reopened" (today "1 reopened", lower case), "Search" (today the search box has only the placeholder "Node name…" and an aria-label, Q), "Recommendation" (today FindingDetail shows the recommendation with an icon and no label, Q) — cost if wrong: string edits.
- **L521** Ruling: 4.4 6-02 D9d — no row checkboxes or "N selected" bar: today's per-section bulk menu (Dismiss all N / Restore all N dismissed / Mute this rule, with today's confirm) and per-row icon Dismiss / Restore stay — cost if wrong: a selection model across sections.
- **L522** Ruling: 4.4 6-02 D9c — the board test opens the B1 Mute dialog and the C2 bulk menu together to read their strings; the Playwright shot shows neither, as the board does — cost if wrong: none.
- **L523** Ruling: 4.4 6-09 D9b — check swaps "Mesh issues" → "Mesh Issues" and drops "Run now", "Reopened", "Recommendation" (as 6-02); "Dismiss" is read from the bulk menu's "Dismiss all" — cost if wrong: string edits.
- **L524** Ruling: 4.4 6-09 — the phone status chips are today's SummaryTiles (All, per type with new / reopened / Muted) — why: D9d; the board's All/New/Reopened/Muted chips are a state filter today does not have — cost if wrong: a new filter dimension.
- **L525** Ruling: 4.4 6-09/6-15 — "Filters · N" counts filter dimensions in use (severity, tier, source, search, show closed, show dismissed); the tile selection is not counted (FilterBar's Clear keeps it) — cost if wrong: one function.
- **L526** Ruling: 4.4 6-15 D9b/Q — check drops "Search subject" (placeholder only, Q) and "High", "Medium", "Low" (today's severities Critical / Warning / Info) — cost if wrong: string edits.
- **L527** Ruling: 4.4 6-03 D9b/Q — check drops "Range" (today "Time range"), "Elapsed" (today "Live — 18m elapsed"), "None" (today "Select none"), "MQTT recording" (today's status row reads "Athens MQTT · Off · Turn on in source settings"), "Via" (map popup, Q) — cost if wrong: string edits.
- **L528** Ruling: 4.4 6-03 — CoverageSummaryPanel (tiles and receivers table in one part) sits under the receivers-and-map row, not above it — why: reuse as is — cost if wrong: split the panel.
- **L529** Ruling: 4.4 6-03/6-10 — range, colour and view are drawn as segmented buttons bound to today's state (today: buttons for range, a select for colour, buttons for view); labels are today's ("Time range", "3 days", "7 days", "Colour by", "View", "Cell size") — cost if wrong: two selects.
- **L530** Ruling: 4.4 6-10 D9b/Q — check drops "Range", "Surveys" (today "Survey"), "Search" (placeholder, Q), "MQTT recording", "All / None" (today "Select all" / "Select none") — cost if wrong: string edits.
- **L531** Ruling: 4.4 6-10 D9d — Receivers is today's CoverageReceiverFilter inline in the panel (its own "All receivers" toggle opens search, Select all / none and the groups; the MQTT status shows above it), not a row that opens a sheet — why: today's part already opens its own list — cost if wrong: one Sheet.
- **L532** Ruling: 4.4 6-10 — the Coverage title, Refresh and Export sit in the frame header on the phone, not in the panel — why: one frame for both breakpoints — cost if wrong: move two controls.
- **L533** Ruling: 4.4 — on the phone, report routes draw their own header (ReportFrame) and PhoneShell hides the device header on `/reports*` and `/overview/reports*`; the list goes back to Overview, a report to the list ("Back to reports", today's string, D9b) — cost if wrong: one regex.
- **L534** Ruling: 4.4 — the Overview sidebar marks Reports current on `/reports/…` as well as `/overview/reports/…` — cost if wrong: one replace.
- **L535** Ruling: 4.4 — Classic users at `/reports/<x>` land on `/reports` (classicFallback); the deep-link query is dropped there as for every fallback — cost if wrong: one rule.
- **L536** Ruling: 4.4 — CoverageMap is mocked in the Coverage Vitest files (Leaflet's canvas renderer has no 2D context in jsdom and threw unhandled errors); the Playwright shots draw the real map — cost if wrong: a canvas stub in setup.
- **L537** Ruling: 4.4 — the rehost smoke spec now checks `/overview/reports/solar` (still re-hosted) instead of `/overview/reports` — cost if wrong: none.
- **L538** Ruling: 4.4 fix 1 6-09: on the phone, By issue is the Workspace's MeshIssuesPhoneSections.
- **L539** Ruling: 4.4 fix 1: reused Classic controls on phone surfaces get 44 px through element selectors under a Workspace module class (`.sheetBody`, `.phoneBar`, `.panel`, the finding sheet). There is no `:global` and no Classic change, and a 390×844 Playwright spec asserts it.
- **L540** Ruling: 4.4 fix 1: "Show N issues" shows no count while `/summary` is fetching or missing ("Show issues").
- **L541** Ruling: 4.4 fix 1: Reports status chips are a tinted surface with a tone border and body-colour text, so the text keeps contrast in Latte.
- **L542** Ruling: 4.4 fix 1: the Run footnote no longer claims Mesh Issues always runs on a schedule.
- **L543** Ruling: 4.4 fix 2: on the phone, today's By node view (ByNodeView/NodeGroupSection, as is) sits in a Workspace `.byNodePhone` container. Element selectors under it make every button ≥44×44 px. Structural selectors make each group header and finding header ≥52 px. There is no `:global` and no Classic change. reportsPhone.spec.ts checks this for an admin and for a viewer without canAct, including no sideways scroll at 390 px. The rows rule depends on NodeGroupSection's DOM shape (header first, body second, finding header first), so if that part's structure changes the spec fails. Cost if wrong: a selector edit.

#### Task 4.5 — Traceroute Explorer, Solar, MQTT violations, NodeInfo Enrichment

- **L547** Ruling: controller CM — Enrichment in Workspace keeps today's send exactly: same request and no new pacing or cap (spec §8 "No new limits are proposed"; Workspace adds no traffic beyond Classic). The confirm follows the board: if 6-07/6-14 draw a confirm or preview step before sending, build it as a ConfirmSheet with submitOnEnter={false}; if not, none (D9d). The gate stays today's (the server answers 403, and the UI surfaces the error, as Classic does), with no new client gate (D9d). The Sends line (s6n1) is shown next to Fix / Fix all whenever push is on — why: §8 forbids new limits and parks only boards that add traffic; this one adds none — cost if wrong: one ConfirmSheet or a client gate added later.
- **L548** Ruling: CN 4.5 6-04 — the explorer pair detail goes in the board's right column on desktop. The Workspace page owns a two-column grid [work area | ExplorerDetail]. Classic's internal grid is left unchanged; this is composition, not a Classic CSS override — why: "exactly as drawn", and nothing in Classic must change — cost if wrong: one wrapper grid.
- **L549** Ruling: CO 4.5 6-11 — the phone explorer must reach today's Every run (flat) view, via today's Group by pair / Every run toggle placed in the Filters sheet. The flat runs render as ≥52 px rows, or as today's table in a horizontal scroller if rows would duplicate logic — why: §2 anti-goal "a power user cannot find a control they use today" — cost if wrong: one toggle.
- **L550** Ruling: CP 4.5 6-11/6-13 — the proposed one Filters · N button in place of the board's chips is accepted (s6n3 puts range/transport/window in the Filters sheet; it matches earlier phone pages). The count must include a non-default range/window — cost if wrong: chips.
- **L551** Ruling: CQ 4.5 6-13 — the packet sheet title shows "Packets · N" as drawn when today's drill response carries a total; if it does not, D9d with a ledger note — cost if wrong: one count.
- **L552** Ruling: CR 4.5 Concern 3 — Pair history on phone must be exercised in Playwright at 390×844. Escape and the close button must close only the topmost layer (the modal), leaving the Pair sheet open. If they close both, fix it in the Workspace layer, not Classic Modal — why: D9c one layer at a time — cost if wrong: one test.
- **L553** Ruling: CS 4.5 — the implementer's proposed 4.5 rulings (report "Proposed rulings") are adopted, except 6-04 detail placement (superseded by CN) and 6-11 chips (amended by CP).
- **L554** Ruling: CT 4.5 — choosing Every run on the phone writes the same saved explorer view preference that desktop and Classic read, as today's desktop toggle does. This is D9d, today's behaviour, not a new shared state — cost if wrong: a phone-local state.
- **L555** Ruling: 4.5 6-07/6-14 — Fix and Fix All send today's `POST /api/nodes/enrichment/apply` on one click with no confirm. The boards draw no confirm on them (6-07 "Fix all · 14", 6-14 "Fix all · 14" and the row "Fix"), so D9d applies under Ruling CM. The one preview step the boards draw (6-07 "COPY PREVIEW … Cancel · Copy 3 fields", 6-14 "TAP FOR THE COPY PREVIEW") is today's copy dialog built as CopyNodeInfoSheet, a ConfirmSheet with `submitOnEnter={false}` — why: CM (follow the boards) — cost if wrong: one ConfirmSheet on Fix All.
- **L556** Ruling: 4.5 6-07 — the Sends line reads "Sends 1 NodeInfo request per row from the target device, on that node's channel · Fix all now ≈ N packets, more with hops". It shows while push is on, in the push card beside Fix All. The "…" is filled as the board does; "that node's" follows s6n1 and the brief, where the board reads "the node's" — cost if wrong: one word.
- **L557** Ruling: 4.5 6-07 — no client gate on Fix / Fix All. The server answers 403 and the toast shows today's message (Ruling CM, D9d) — cost if wrong: a `hasPermission('nodes','write',{sourceId})` check per row.
- **L558** Ruling: 4.5 6-07 — the copy preview is a right-docked Sheet over the page, not an inline column beside the table — why: D9c and the existing CopyNodeInfoSheet — cost if wrong: a page column.
- **L559** Ruling: 4.5 — CopyNodeInfoSheet takes `submitOnEnter={false}` everywhere it opens, including the node menus (15-05), because Push to NodeDB transmits (Ruling BH) — cost if wrong: none; Enter in a select or checkbox does not submit.
- **L560** Ruling: 4.5 6-11 — the phone has one Filters · N button (with range, transport and the rest in the Sheet, s6n3) plus Show map, in place of the board's 24 h / "RF, MQTT" / Filters chips. Rows show the newest run's time and today's "% answered" — cost if wrong: two chips.
- **L561** Ruling: 4.5 6-11 — the map stays reachable on the phone behind Show map (today's ExplorerMap), so a power user can still find it — cost if wrong: one toggle.
- **L562** Ruling: 4.5 6-05/6-12 — Solar keeps today's Lookback (days) NumberInput (1–90, default 7), not the board's "Lookback 30 d" menu; no "Last run … from storage" line, since there is no stored run (D9d, as 4.4) — cost if wrong: a select.
- **L563** Ruling: 4.5 6-12 — on the phone, ForecastResults draws day tiles (`renderDays`) and SolarNodeCard draws a "Recent daily patterns" row that opens a Sheet (`renderPatterns`). These are optional slots that Classic does not pass, under Rule X — cost if wrong: remove two props.
- **L564** Ruling: 4.5 6-06 — Run report and Export CSV stay in today's controls row on desktop, not the header. The packet drill-down stays inline in the table (D9d), not the board's separate panel — cost if wrong: move two buttons and a panel.
- **L565** Ruling: 4.5 6-13 — the phone has Run report in the header and one Filters · N for the window and toggles (s6n3), in place of the board's window chips — cost if wrong: four chips.
- **L566** Ruling: 4.5 — the four Task 4.5 pages share `reportParts.module.css` (buttons, tiles, rows, sheet padding, `.targets` 44 px element selectors); each page also has its own module — cost if wrong: copy the rules into each module.
- **L567** Ruling: 4.5 — each of the four pages is its own lazy chunk in `ReportsRoute` (`PAGES`), so recharts and Leaflet stay out of the Reports list chunk — cost if wrong: none.
- **L568** Ruling: 4.5 fix 1 CN — in its narrow column, today's ExplorerDetail stacks its strip and paths through `.detailColumn [data-testid='traceroute-explorer-detail'] { grid-template-columns: minmax(0, 1fr) }`. This is an attribute selector under a Workspace module class, with no `:global` and no Classic CSS change — cost if wrong: one selector if the testid moves.
- **L569** Ruling: 4.5 fix 1 CO — the phone Rows toggle writes today's persisted `prefs.group` (localStorage `meshmonitor.tracerouteExplorer.prefs`), so Every run chosen on the phone also applies on desktop and in Classic, as the desktop toggle does today — cost if wrong: phone-local state.
- **L570** Ruling: 4.5 fix 1 CR — while a dialog is open inside it, the Pair sheet ignores its own close (Escape, backdrop, Close). The nested modal covers the sheet, so only Escape could reach it anyway. The fix lives in the explorer page, not in Sheet, `useDialogA11y` or Classic Modal — cost if wrong: a general "topmost dialog only" rule in Sheet.

#### Task 4.6 — Overview messages and export

- **L574** Ruling: CU 4.6 7-02 — the desktop export dialog is portaled to body, so its overlay also dims the sidebar the board leaves lit. Accepted: common/Modal does not portal itself, and the fixed page's stacking context would otherwise put the dialog under the sidebar — cost if wrong: a scoped overlay.
- **L575** Ruling: CV 4.6 — no per-channel message counts (D9d): today's channel API has none, and adding them would be a backend change no board note requires — cost if wrong: one API field.
- **L576** Ruling: 4.6 7-01/7-06 — Overview › Messages reuses `MessageRowD` in a new `readOnly` mode (no hover bar, no long-press sheet, chips are spans) with `headExtra`/`footer` slots for the channel tag, the clock offset, device tags with hops and "heard by N" — why: one row component for both feeds, and s7n1 says the feed is read-only — cost if wrong: a dedicated unified row.
- **L577** Ruling: 4.6 7-01 — a row writes hops as today's words ("direct", "2 hops") after each device tag, not as HopBadge's numeric pill; the receptions table's Hops column shows a number or "direct" (the board's values) — why: the board writes words and the hop logic is HopBadge's own `unifiedHops` — cost if wrong: swap in `<HopBadge>`.
- **L578** Ruling: 4.6 7-01 — "heard by N" shows for every message, including N = 1 (Classic shows it only above 1), and is the keyboard way into the receptions panel; a click anywhere on the row opens it too — why: the board draws "heard by 1" — cost if wrong: one condition.
- **L579** Ruling: 4.6 7-01 — today's tapbacks stay one chip each, not grouped "👋 3"; the board's per-channel message counts are not built (D9d: no data today) — cost if wrong: a grouping helper; a count query.
- **L580** Ruling: 4.6 7-01/7-06 — the title is today's "Unified Messages", the subtitle today's, Request ID in today's decimal, SNR and RSSI with today's units (D9b/D9d) — cost if wrong: string edits.
- **L581** Ruling: 4.6 7-06 — MeshCore's clock offset reads "clock N s/min/h ahead|behind" (s7n2 overrides today's "(+2m)"); offset = receipt − sender, so negative is ahead; today's 5 s threshold and ±24 h plausibility apply — cost if wrong: one formatter.
- **L582** Ruling: 4.6 7-02 — the desktop export is today's `common/Modal` (centred, as drawn) portaled to `<body>`, holding the Workspace form with device tags; the overlay dims the sidebar too — why: inside the fixed page layer the sidebar covered the dialog — cost if wrong: a Workspace dialog primitive.
- **L583** Ruling: 4.6 7-09 — the phone export is the route `/overview/messages/export`; the header's Export link carries the channel in view as link state (a reload starts with All channels); Classic users at that URL land on `/unified/messages` — cost if wrong: a query parameter.
- **L584** Ruling: 4.6 7-09 — the sources keep their names beside the tags (the board shows tags only), and the time zone stays today's free-text field (the board draws a select) — why: names give the chips their accessible names; D9d — cost if wrong: CSS / a zone list.
- **L585** Ruling: 4.6 Review Focus 2 — the client keeps only receptions, channel sources, filter entries, reply parents, tapbacks and export sources from devices in the shell's readable list, on top of the server's per-source scoping (proved by a real-SQL route test) — cost if wrong: none (defence in depth).
- **L586** Ruling: 4.6 — `/unified/messages` in the Workspace also renders OverviewMessages, and `UnifiedMessagesRehost` is deleted — why: one owner per screen (Ruling AD) — cost if wrong: one route line.
- **L587** Ruling: 4.6 7-06 check — "Source" dropped from the 7-06 check (the phone sheet draws no Source label; each card names its device); 7-01's "All channels" → "All Channels" (D9b) — cost if wrong: string edits.

#### Task 4.7 — Overview telemetry, packets, pop-out, MQTT receptions

- **L591** Ruling CW: 4.7 — the Workspace packet table draws no Last Hop column (board), but the raw packet panel's relay byte opens today's RelayNodeModal and the panel shows today's spoof / XEdDSA-signed / decrypted-by markers in today's words; the spoof alert stays in the Dir cell — why: spec §2 anti-goal (a power user finds every control they use today) outranks the board's omission — cost if wrong: a button, three rows
- **L592** Ruling CX: 4.7 — type badges map to role tokens (Text info, Telemetry warning, Traceroute accent-alt, NodeInfo accent, Position success, Routing/Admin caution, Encrypted/other muted) — why: board draws per-type colours; hex banned (#5594) — cost if wrong: token swaps
- **L593** Ruling CY: 4.7 — two reviewer Minors promoted into the fix loop: Escape over RelayNodeModal also closes the phone sheet (breaks Ruling CR) and the phone Charts sheet is empty when the shared showCharts key is false (a control that renders nothing) — why: both are broken behaviour, not polish — cost if wrong: one extra round of work
- **L594** Ruling: 4.7 7-03/7-04/7-07 — Overview › Telemetry keeps today's title "Unified Telemetry", subtitles and labels ("Battery Level (%)", "Ch Util", "Temp"), and today's legend text after the device tags — why: D9b — cost if wrong: string swaps.
- **L595** Ruling: 4.7 7-03 — `CombinedTelemetryChart` takes optional `tagFor` and `renderActions`; the Workspace draws Split by source plus a "Chart actions" menu (Split, Y-axis range…, Export CSV, Remove from favorites) with each of today's handlers; the board's item subtitles are not drawn — why: one chart component for both layouts (Rule X, as 4.2's MapAnalysisCanvas prop); the subtitles need data the card does not hold (the device the favorite lives on) — cost if wrong: four subtitle strings.
- **L596** Ruling: 4.7 7-04 — Jump to scrolls to a device's section with `scrollIntoView`; the active-chip highlight (today's IntersectionObserver) is not carried over — why: the page scrolls inside the shell, not the window — cost if wrong: one observer.
- **L597** Ruling: 4.7 7-05/7-08/18-01 (controller ruling 2) — type badges take the board's per-type colours as role tokens, keyed by today's client PortNum table (`PORTNUM_NAMES`, utils/packetFormat): Text `--color-info`, Telemetry `--color-warning`, Traceroute `--color-accent-alt`, NodeInfo `--color-accent`, Position `--color-success`, Routing/Admin `--color-caution`; encrypted, MeshCore payload types and other types stay muted — why: the board draws them; tokens keep every theme legible — cost if wrong: one CSS rule per family.
- **L598** Ruling: 4.7 7-05/7-08 — Transport is a segmented control with today's short transport names (LoRa, UDP, MQTT, API, INT) and today's option text as each button's tooltip; Payload uses today's "Encrypted Only" / "Decoded Only" with "All"; Source stays today's single select, not the board's multi-select chips (D9d); "Show N packets" shows the loaded, already-filtered count and closes the sheet (filters apply live, as today) — cost if wrong: one control each.
- **L599** Ruling: 4.7 7-05/18-01 — the raw packet panel shows today's fields, hops as today's "2/3" plus the relay byte, and today's full field list as a "Packet Details (Full JSON)" disclosure in place of the board's hex box; Copy JSON and Show sender are not built (D9d: not today's); the table's # is today's row index and Time is HH:MM (seconds and ms in the panel, s7n2) — cost if wrong: two buttons and a clipboard call.
- **L600** Ruling: 4.7 7-05 — Capture has no confirm (the board draws none; it is a settings write that sends nothing, s7n1) — cost if wrong: a ConfirmSheet.
- **L601** Ruling: 4.7 18-01/18-02 — `/packet-monitor` in the Workspace layout is a Workspace window built on `usePacketMonitor` with the shared packet table and raw packet panel, not `PacketMonitorPanel` mounted; titled today's "Mesh Traffic Monitor · <device long name>"; Clear all packets uses ConfirmSheet with today's words; `?sourceId=` of a MeshCore device keeps today's `PacketMonitorPage` — why: phone rows ≥52 px and the board's text buttons; one owner per screen — cost if wrong: mount the panel with a prop that hides Pop out.
- **L602** Ruling: 4.7 18-01/7-05 (controller ruling 1) — no Last Hop column (the board has none); today's relay estimate and markers live in the shared raw packet panel: "via 0x12" (or "via ?" for an estimate) is a button that opens today's RelayNodeModal with today's data (the device's nodes, `/api/direct-neighbors?hours=24` fetched on open); the panel lists today's spoof warning, XEdDSA signed and decrypted-by device/server in today's words; a spoofed row keeps today's alert cue in Dir with today's title — why: spec §2, a power user still finds today's controls — cost if wrong: none.
- **L603** Ruling: 4.7 18-03/18-04 — `/source/:id/packetmonitor` on an MQTT device (`mqtt_broker` / `mqtt_bridge`) is the Workspace MqttReceptions under the device's SourceProvider and socket, App not mounted; other devices keep today's until Task 8.5 — why: Ruling AD; the plan gives the other devices to 8.5 — cost if wrong: one route branch.
- **L604** Ruling: 4.7 18-03 — the table reorders today's columns to Time, From, Type, Gateways count (a button named "N Receptions"), then To, Channel, Size, Preview behind the cue; the gateway filter is chips with "N of M" instead of today's dropdown; the receptions table is the brief's Gateway, Rx time, Hops, SNR, RSSI, Outcome, ok_to_mqtt (today's server "Time" column dropped; Outcome added from the row the route already returns); the packet's hop range is not built (D9d) — cost if wrong: column edits.
- **L605** Ruling: 4.7 18-03 — ok_to_mqtt badges are a Workspace component with today's words and tooltips (MqttOkToMqttMarker's), and the packet's violation shows today's explanation as visible text — why: Classic's marker is styled by the global `MqttPacketMonitor.css` — cost if wrong: import that sheet.
- **L606** Ruling: 4.7 checks — D9b swaps and Ruling Q drops as listed under "Board check strings changed" — cost if wrong: string edits.
- **L607** Ruling: 4.7 fixtures — `/api/packets/stats` (capture on) is the `captureOn` override, not a default, and `Board` takes optional `fixtures` — why: a default changes Classic's chrome snapshot — cost if wrong: none.

#### Task 4.8 — Users, permission matrix, audit log

- **L611** Ruling CZ: 4.8 o4/q4 — "Copy <device> to all devices" is not built — why: Classic has no such action (spec: no new features), and channel grants are per slot, so a slot names a different channel on each device; copying would grant unintended channels — cost if wrong: one bulk action to add once its semantics are designed
- **L612** Ruling DA: 4.8 — the matrix sends today's whole-scope PUT, which omits remote_admin and so clears a remote_admin grant on any save, exactly as Classic does — why: Rule X and the mandatory same-request test; the root cause is shared (PERMISSION_KEYS / the PUT), and fixing it changes Classic — cost if wrong: remote_admin grants keep being wiped until the follow-up lands (fail-closed: removes a privilege, never adds one)
- **L613** Ruling DB: 4.8 o5/16-03 — the Workspace audit gate is hasPermission('audit','read'), which lets admins through as the server does; Classic's literal stored-grant check shows admins without an audit row "no permission" — why: the server is the authority; non-admin behaviour is identical — cost if wrong: one gate check
- **L614** Ruling DC: 4.8 — the q4 phone channel-DB card's sub-44 px targets (36 px Save, unsized checkbox labels) are promoted into the fix loop — why: phone ≥44 px is a global constraint, treated as Important in 4.5 — cost if wrong: one small round
- **L615** Ruling DD: 4.8 — a failed Deactivate/Delete keeps the ConfirmSheet open with today's error text instead of Classic's close + page error + toast — why: the Workspace ConfirmSheet pattern used on every page since Phase 2; the error is still shown and nothing is sent twice — cost if wrong: close the sheet and toast
- **L616** Ruling: 4.8 o4/13-13 — one user page with Account and Permissions tabs; Set Password lives on Account, so o4's header "Reset password" and ⋯ are not drawn — why: s13n0 (13-13 is the Account half of o4's page); D9b — cost if wrong: a header button.
- **L617** Ruling: 4.8 o4/q4 — matrix rows are today's per-device resources (per channel slot, Settings, Device Configuration, Can Control Connection, Private Positions, Waypoints); a pair a device lacks is an empty cell — why: ds13 "same permission model as today"; UsersTab's scope filter — cost if wrong: row grouping.
- **L618** Ruling: 4.8 o4 — row labels: today's en.json labels; the board's words where today's are hardcoded English (Nodes & map, Packet monitor, Channel database, Automations (all rules)) — why: D9b / ledger 3.1 precedent — cost if wrong: string swaps.
- **L619** Ruling: 4.8 o4/q4 — View on Map stays a separate toggle on channel cells and on Nodes & map for MeshCore devices — why: spec §2 anti-goal (every control today's power user has stays reachable); a three-state cell cannot carry it — cost if wrong: one button per cell.
- **L620** Ruling: 4.8 o4 — Packet monitor cycles None ↔ Read only — why: today has no write checkbox for it — cost if wrong: one option.
- **L621** Ruling: 4.8 o4/q4 — an install-wide change is sent as today with the scope's device set (desktop: the first device, today's default scope; phone: the selected chip) — why: exactly today's body (equivalence test) — cost if wrong: send `{ permissions: globals }` without a sourceId, which the server also accepts.
- **L622** Ruling: 4.8 o4/q4 — matrix cells save as you go, one write at a time, with no success toast; Virtual Channel Permissions keep today's explicit Save — why: board "Changes save as you go"; the virtual channel PUT is today's whole list — cost if wrong: a toast / a Save button.
- **L623** Ruling: 4.8 o4/q4 — "Copy <device> to all devices" not built — why: a new bulk write over per-slot channel grants that mean different channels per device (concern 1) — cost if wrong: one feature to add once the semantics are ruled.
- **L624** Ruling: 4.8 q4 — install-wide resources open inline under "Across this MeshMonitor · N rules" (a disclosure, not a separate page) — why: smallest working control; q4's check drops "Security" (install-wide today), covered by a test — cost if wrong: a sub-page.
- **L625** Ruling: 4.8 13-13/13-18 — Remove Admin gets a ConfirmSheet (title "Remove Admin", body "{{username}} will lose administrator privileges.", danger); Make Admin has none — why: controller decision 4; today removes without asking and has no words for it — cost if wrong: one confirm.
- **L626** Ruling: 4.8 13-13 — the list meta is today's `@username · PROVIDER · N passkeys` with the admin star; no roles, no 2FA, no "last seen" — why: D9d (no roles exist; today shows neither) — cost if wrong: meta fields.
- **L627** Ruling: 4.8 13-18 — Add User opens today's create form as a bottom Sheet, not a page — why: smallest change; s13n7's "as a page" is layout — cost if wrong: a route.
- **L628** Ruling: 4.8 13-18 — Search users filters the loaded list client-side — why: board control, no endpoint needed — cost if wrong: none.
- **L629** Ruling: 4.8 o5/16-03 — the audit gate is `hasPermission('audit','read')` (admins pass) — why: the server's gate; Classic's literal check denies admins without a stored row — cost if wrong: admins without the row see the denial.
- **L630** Ruling: 4.8 o5/16-03 — time presets (1 h, Last 24 h, 7 d) send `startDate = now − window` through an additive `sinceMs` filter in `useAuditLog` (Classic never sets it); the default stays today's "Any time"; Dates… shows today's Start / End Date — why: board control over today's parameter; D9d default — cost if wrong: drop the presets.
- **L631** Ruling: 4.8 o5/16-08 — today's columns (Timestamp, User, Action, Resource, IP Address, Details) and fields; no Device, From/origin, Client, field-change table or restart note — why: D9d: entries carry no device or origin, `user_agent` is stored null, `valueBefore`/`valueAfter` are never returned; today's Before / After blocks kept for entries that carry them — cost if wrong: server work to add those fields.
- **L632** Ruling: 4.8 o5/16-03 — "Repeater consoles" is today's "MeshCore CLI activity" view as a chip; "From" is today's "Source" (All Sources / UI Only / API Token Only) — why: D9b; s16n3 — cost if wrong: string swaps.
- **L633** Ruling: 4.8 o4/q4/13-13/13-18/o5/16-03/16-08 checks — D9b swaps and Ruling Q / D9d drops as listed under "Per-board check strings changed" — cost if wrong: string edits.

#### Task 5.1 — Extract device-config state and saves (Rule X)

- **L652** Ruling DE: 5.1 — reload() reports today's 31 tracked fields with today's English labels as `field`; it is not widened — why: today has a diff and the move keeps it; 5.3's Review builds from the save queue, not reload() — cost if wrong: a later "changed on the node" screen must widen the diff and add stable keys (forward constraint)
- **L653** Ruling DF: 5.1 — the widened signatures (sourceId: string | null, refreshTrigger?: number, optional onRebootDevice, mqtt(extra?)) are accepted — why: compatible supersets that keep Classic's nullable source and primary-source fallback — cost if wrong: none
- **L654** Ruling DG: forward constraints for 5.2+ — Workspace settings mount useDeviceConfigState ONCE per source (shared through the frame), never per category page (each instance reloads config + keys); read state.x rather than copying the destructure; 5.3's saveAll treats reboot() === false as "reconnect failed", not "reboot not sent"
- **L655** Ruling: 5.1 — `useDeviceConfigState` takes `sourceId: string | null, refreshTrigger?: number` — Classic's `useSource()` and prop are nullable/optional and the api already accepts null — cost if wrong: none; a stricter caller still compiles.
- **L656** Ruling: 5.1 — `useDeviceConfigSaves` opts gain optional `onRebootDevice` — Classic's reboot must keep going through the parent handler — cost if wrong: Workspace omits it and gets today's direct-api fallback.
- **L657** Ruling: 5.1 — `reboot()` never calls `onRebootExpected` — today's reboot is announced by the parent handler; a second signal would change Classic's reboot UI — cost if wrong: a Workspace reboot banner must hook `onRebootDevice` instead.
- **L658** Ruling: 5.1 — `ConfigSaveSection` is configRebootRules' union minus `bluetooth` — one name per section across the reboot rules and the saves; there is no Bluetooth save here — cost if wrong: a rename later touches both.
- **L659** Ruling: 5.1 — `reload()` returns today's tracked-field diff (31 fields), raw before/after, `field` = today's label — keeps Workspace and Classic agreeing on "what changed" with no new diff logic — cost if wrong: a later task widens the tracked set in one place.
- **L660** Ruling: 5.1 — `confirmAction`, the import/export modal flags and the `nodes` position effect stay in ConfigurationTab — they are Classic UI or depend on a prop the hook signature lacks — cost if wrong: Workspace re-implements the fixed-position prefill from nodes if it wants it.

#### Task 5.2 — settings frame, row kit, category routes

- **L664** Ruling: 5.2 DH — placeholder categories keep today's Save/SaveBar/RebootModal from the frame's one shared useDeviceConfigState instance — removing a working Save would hide a control (spec §2 anti-goal) and leave settings uneditable until 5.3; 0 mesh packets beyond today's saves — if wrong, 5.3 replaces it anyway.
- **L665** Ruling: 5.2 DI — each In MeshMonitor category shows today's whole source Settings page scrolled to its section (SettingsTab has no single-section mode; Rule X forbids changing Classic) — 5.8 owns the real split — if wrong, users see extra sections until 5.8.
- **L666** Ruling: 5.2 DJ — device/bluetooth deferred to 5.6 (today has no Bluetooth section or save); later-task board strings skipped via expectBoard `staged` option naming the owning task — each staged string must be un-staged by its task — if wrong, a board string goes uncovered; the Phase 5 gate checks no `staged` entries remain.
- **L667** Ruling: 5.2 DK — extra files ClassicCategories.tsx, sharedDeviceConfig.ts, useVisibleCategories.ts accepted as focused units.
- **L668** Ruling: 5.2 DL — Minors 1–3 promoted into the loop: DangerZone missing canWrite / TypedConfirmDialog missing busy (permission drift), "View only" badge using settings:write for pki-dm/mqtt-bridge/notifications (wrong gate shown), phone switch 40 px wide (<44 px global constraint) — each breaks a global constraint, not polish — if wrong, one small extra fix.
- **L669** Ruling: 5.2 DM — I1: Workspace settings read /api/poll once on open and again after their own writes (frame's DataProvider has the link down, so usePoll never arms an interval); today's App refreshed every 30 s. Accepted: fewer requests than today, no new timer (N); re-reviewer verifies the claim — if wrong (users need live channel refresh), the fix is to supply a connected link state, not a new interval. FINAL REPORT ITEM.
- **L670** Ruling: 5.2 all — Classic settings sections stay as category placeholders without App, saving through today's handlers, SaveBar and RebootModal from the frame's shared `useDeviceConfigSaves` — why: decision 1 ("today's section") and nothing lost; 0 mesh packets — cost if wrong: unwire 25 onSave props.
- **L671** Ruling: 5.2 all — `CategoryProps.target` comes from the frame (always `{ kind: 'local' }` now); 5.9 sets it from `?node=` in one place (`SettingsFrame` `LOCAL`) and moves `?node=` off the App branch — why: smallest seam — cost if wrong: one prop source.
- **L672** Ruling: 5.2 all — `/settings/<category>/<sub>`: `resolveSettingsPath` takes the longest category match; the rest is `sub`, which a category reads from the URL itself (CategoryProps unchanged) — why: brief's verbatim type — cost if wrong: add `sub` to CategoryProps.
- **L673** Ruling: 5.2 all — category label keys reuse today's en.json key where one exists, else `workspace.settings.label.*` with today's fallback text (configSections' fallback-only keys are not added to en.json, because GpioPinSummary renders two of them raw today) — why: D9b without a Classic DOM change — cost if wrong: key churn.
- **L674** Ruling: 5.2 all — `config-import-export` → maintenance/backup; `settings-reset-ui` / `settings-management` / `settings-danger` → data; any `#config-*`/`#settings-*` hash on either retired tab finds its category — why: exactly-one mapping — cost if wrong: one map entry each.
- **L675** Ruling: 5.2 all — pki-dm is gated on `configuration:read` alone (its routes' grant; today a viewer without Settings finds it in Configuration) — why: nothing lost — cost if wrong: one gate.
- **L676** Ruling: 5.2 b-set-d2 — superseded on desktop by 12-07 (Supported heading, folded row); "AVAILABLE" and "Why?" dropped from d2's check — why: two drawings of one page — cost if wrong: re-add a heading string.
- **L677** Ruling: 5.2 12-06/12-22/b-set-p1/b-set-d2/12-07 — strings of later tasks are staged via `expectBoard(…, { staged })`; 5.3/5.4/5.6 remove them from their staged lists — why: board built in stages (r4 precedent) — cost if wrong: none.
- **L678** Ruling: 5.2 12-07 — modules without an enable flag (TAK, Traffic Management) show no On/Off tag — why: D9d, no invented state — cost if wrong: a derived rule in `moduleOn`.
- **L679** Ruling: 5.2 all — a Classic settings URL redirects beside the mounted frame (frame takes `path` from WorkspaceSource), so following an old link keeps the config instance — why: Ruling DG — cost if wrong: one extra config load per old link.
- **L680** Ruling: 5.2 b-set-p1-list — device-config fixtures are passed per test/board, not added to fixtureApi defaults, because Classic's chrome snapshot reads the same endpoints — why: keep Classic tests untouched — cost if wrong: none.
- **L681** Ruling: 5.2 fix1 — Channels, Backup and Firmware read the device poll once on open and after their own writes, with no interval, because the frame's DataProvider has the link down while App is absent — why: no new timers, and fewer requests than today's 30 s — cost if wrong: Task 5.5 adds a live slot list (a socket plus status) if staleness matters.
- **L682** Ruling: 5.2 fix1 — "View only" in the list goes on the group when every row is read-only, else on each read-only row — why: grants differ per category (DL-2) — cost if wrong: one Section rule.

#### Task 5.3 — radio save bar, Review, leave guard

- **L686** Ruling: 5.3 DN — Security and MQTT keep today's own save bar (their Classic saves carry confirms and extra writes: Strict policy, private key, broker preset id, MQTT link) until 5.5 (Security) and 5.6/5.7 (MQTT) rebuild them and enqueue — skipping those checks would be worse than two save paths — if wrong, an edit left on those pages on category change stays unbarred until those tasks; those dispatches must convert them.
- **L687** Ruling: 5.3 DO — only one save bar shows at a time; the radio bar yields while today's bar holds an edit — two bars contradict D9c — temporary until 5.5–5.8 convert the last Classic sections — if wrong, queued radio edits are briefly out of sight (leave guard still covers them).
- **L688** Ruling: 5.3 DP — the leave guard covers in-app link clicks and device switch; browser Back and programmatic navigate leave without asking (the app uses a router with no blocker; changing the router is outside this redesign) — shortcut comment in LeaveGuard.tsx — FINAL REPORT ITEM — if wrong, a Back press drops queued edits as Classic does today.
- **L689** Ruling: 5.3 DQ — interface deviations accepted: queue derived from shared state (no enqueue), useRadioSaveQueue() reads the frame's queue, saveAll does not call reboot() (node restarts itself; RebootModal reports reconnect failure as today), failed sections' edits re-applied after the post-notice reload — all keep DG's one instance and today's save handlers — if wrong, an interface rename later.
- **L690** Ruling: 5.3 DR — change dots in the desktop settings sidebar not built (sidebar is drawn by the shell outside the frame that owns the queue) — deferred to 9.1 pattern sweep — FINAL REPORT ITEM — if wrong, a board indicator missing, no control lost.
- **L691** Ruling: 5.3 DS — Minor 1 (edit typed during a save marked saved, never written — data loss) and Minor 3 (tests asserting almost nothing / tautological "Channels → Save") promoted into the loop — data loss and assert-nothing tests are Important by calibration — if wrong, one small extra fix.
- **L692** Ruling: 5.3 all — the queue is derived (shared state vs the frame's per-section baseline); there is no `enqueue(entry)` — why: every radio category edits the shared instance (DG), so a derived queue cannot miss an edit and needs no Classic change; `useRadioSaveQueue()` reads the frame's one queue rather than taking `sourceId` (one queue per frame) — cost if wrong: a category with local-only edits (5.5 Channels) adds an explicit `enqueue` beside the derived entries.
- **L693** Ruling: 5.3 all — Security and MQTT are not queued: their pages keep today's section with its own SaveBar — why: their saves run checks and writes that live inside the Classic section (invalid admin keys, the private-key confirm, the Balanced / Strict policy typed confirm #5612, the saved-broker preset id and the staged MQTT link write), and saving them from the queue would skip those; 5.5 (Security) and 5.6/5.7 (MQTT) rebuild those pages — cost if wrong: until then, Security / MQTT edits left behind when changing category stay in shared state without a bar (5.2's behaviour).
- **L694** Ruling: 5.3 all — one bar at a time: RadioSaveBar hides while today's SaveBar has a dirty section — why: "never two save bars" — cost if wrong: queued radio edits are out of sight while a Security / MQTT / In MeshMonitor edit is pending.
- **L695** Ruling: 5.3 all — the leave guard catches link clicks (capture phase); browser Back and code that navigates without a link are not caught — why: the app uses BrowserRouter, not a data router, so `useBlocker` is unavailable, and moving routers is out of scope — cost if wrong: Back from settings drops queued edits without asking (marked `shortcut:` in LeaveGuard.tsx).
- **L696** Ruling: 5.3 all — `saveAll` never calls `reboot()`; the node restarts by itself after the save (configRebootRules), and RebootModal reports a failed reconnect as today ("Device reconnection timeout") — why: calling reboot() would send an extra admin packet; DG's "reboot() === false" therefore never arises in saveAll — cost if wrong: none.
- **L697** Ruling: 5.3 all — Review labels each value with today's en.json label for that field (`<section>_config.<field>`), or else the value's name in words; values show today's option names (LONG_FAST, LOCAL_ONLY, CLIENT) and On / Off — why: D9b; reload()'s 31 tracked labels cover too few fields (DE) — cost if wrong: a label table.
- **L698** Ruling: 5.3 b-set-d1/p2/p3 — LoRa rows use today's labels and descriptions (Region Code, Use Preset, Modem Preset, Hop Limit, TX Enabled, Transmit Power (dBm)) and today's preset names and descriptions (LONG_FAST, "Long Range - Fast (Default)"); "Radio" / "Transmit" headings, the preset note and "Current value on the radio" are new `workspace.*` strings — why: D9b — cost if wrong: string edits.
- **L699** Ruling: 5.3 board checks (D9b / CSS-uppercase, as Rulings I and 2.8):
- **L700** Ruling: 5.3 b-set-d1/d3 — "⌘," and "Search settings" stay staged for 5.4; 17-02's "Athens" stays staged (the channel frame is 5.5 / 9.1) — cost if wrong: none.
- **L701** Ruling: 5.3 b-set-d3 — Review is the spec's Sheet (right-docked on desktop, bottom on phone), not the board's centred modal — why: §5.7 pattern, one sheet at a time (D9c) — cost if wrong: CSS.
- **L702** Ruling: 5.3 b-set-d1 — no change dots in the settings sidebar — why: the desktop sidebar is drawn by the shell, outside the frame that owns the queue — cost if wrong: lift the queue context above the shell sidebar.
- **L703** Ruling: 5.3 b-set-d1 — the review card tag reads "Restarts" / "May restart" (today's workspace tags), not "restarts on 2.7.x" — cost if wrong: one string.
- **L704** Ruling: 5.3 b-set-d1 — the scope line's restart note keeps the board's words ("firmware 2.7.15: saving restarts the node"; "saving may restart the node" for a 'possible' section; none for 'never') — cost if wrong: string.
- **L705** Ruling: 5.3 all — the TX-off confirm is a ConfirmSheet with today's text split at its blank line (title "Disable transmit on this node?", body the rest, confirm "OK") where today uses window.confirm — why: global constraint (destructive control → ConfirmSheet, today's words) — cost if wrong: one dialog.
- **L706** Ruling: 5.3 all — the "This is the radio's own firmware switch … so it is on Device Configuration." note under TX Enabled is dropped on the Workspace page — why: it explains Classic's page split and names "Device Configuration", an absent string on d1 — cost if wrong: one line.
- **L707** Ruling: 5.3 all — the desktop Discard in the bar discards at once with no confirm, as today's SaveBar Dismiss does (D9d) — cost if wrong: a ConfirmSheet.
- **L708** Ruling: 5.3 all — a failed section's edits are carried across the reload that follows the reboot notice (otherwise today's refresh would replace them with the node's values) — cost if wrong: none.

#### Task 5.4 — settings search and pins

- **L712** Ruling: 5.4 DT — field-level results come only from mounted kit rows (LoRa today); other categories gain them as 5.5–5.8 rebuild them; section results cover the rest — nothing unreachable, section-level search is today's ConfigSearchPanel level — if wrong, thin search until 5.8.
- **L713** Ruling: 5.4 DU — MeshCore groups (Phase 7), Remote results (5.9), ☆ on group index headers / Modules rows not built (pins are category ids per brief) — owned elsewhere or outside the brief.
- **L714** Ruling: 5.4 DV — Firmware appears in search only once /api/health is cached this session (no new request; fails closed); Firmware stays in the list — if wrong, an admin finds Firmware via the list, not search.
- **L715** Ruling: 5.4 DW — ⌘, preventDefault on macOS matches Classic palette's choice.
- **L716** Ruling: 5.4 DX — b-set-d4-search.json edits (title case under CSS uppercase, "↑↓" dropped for UiIcons) confirmed per Ruling Q.
- **L717** Ruling: 5.4 DY — promoted into the loop: (a) the ⚠️ Playwright Mac stub set after render (sidebar may show Ctrl+, while dialog shows ⌘,) — use addInitScript and verify the PNG; (b) Minor 1 cap order — rank all results then cap, as Classic's ConfigSearchModal does (D9d today's behaviour) — both cheap, (a) could make a board screenshot wrong — if wrong, one small extra fix.
- **L718** Ruling: 5.4 DZ — ⌘, does nothing while message search (a modal) is open, instead of swapping it for settings search — follows I1/D9c (never open over a modal); one ⌘K/Escape then ⌘, — if wrong, one extra keystroke.
- **L719** Ruling: 5.4 b-set-d4 — the board check's "STATION G2" → "Station G2" and "PREFERENCES" → "Preferences"; "↑↓" dropped — why: CSS-uppercased headings (Ruling Q precedent; textContent cannot see text-transform), and the arrows are UiIcons (no Unicode icons in JSX; 3.1's 15-09 precedent) with sr-only "Up and down arrow keys" — cost if wrong: string edits / a style-aware matcher.
- **L720** Ruling: 5.4 b-set-d4 — field-level ("Setting") results only for the open device's mounted category (the row kit registry). Every other category is found at section level through today's catalogue — why: fields register on mount (5.2 design), and nothing else lists them statically. On today's Classic-backed categories (Node display and most others) no field rows exist yet. Each category rebuilt on the row kit in 5.5–5.8 gains field results automatically — cost if wrong: a static field index per category.
- **L721** Ruling: 5.4 b-set-d4 — MeshCore and Reticulum devices are not searched (no "HELTEC MESHCORE" group) — why: their settings are not in the Workspace settings frame (modeOf excludes them; Phase 7). Offering links into Classic-shaped pages from a Workspace palette would bypass the frame's gates — cost if wrong: add their surfaces when Phase 7 builds their categories.
- **L722** Ruling: 5.4 b-set-d4 — no "Remote: Hilltop Relay … read 2 days ago" results — why: the remote target is Task 5.9 — cost if wrong: 5.9 adds a remote group.
- **L723** Ruling: 5.4 b-set-d4 — the install-wide group is headed "Global Settings" (`nav.global_settings`, as the Server sidebar heads it), while the footer says "Server" (board copy) — why: D9b, an existing label for the same destination — cost if wrong: one string.
- **L724** Ruling: 5.4 all — device section results come from `buildConfigSurfaces` asked with every option on, then filtered by the device's `visibleCategories` — why: the frame's category gate is the one permission authority (a user never finds a category their grants hide; View only stays findable), and it already mirrors each section's option gate — cost if wrong: a section whose own gate is stricter than its category's would be offered (none today).
- **L725** Ruling: 5.4 all — the firmware OTA flag and database type come from the health cache only (`useHealth({ enabled: false })`). Before anything has fetched `/api/health` this session, an admin does not find Firmware or the DB-type-dependent section — why: dispatch "no new requests"; the gap fails closed — cost if wrong: one health fetch on open.
- **L726** Ruling: 5.4 all — the ⌘, listener toggles (as today's ConfigSearchHost) and lives in WorkspaceShell next to ⌘K, on window capture with stopPropagation. Opening either search closes the other and the drawer (D9c). ⌘K never opens settings search; ⌘, never opens message search — cost if wrong: none.
- **L727** Ruling: 5.4 all — picking a result closes search before the leave guard's sheet opens, and Enter clicks the chosen link — why: one guard path for pointer and keyboard (5.3's guard catches link clicks only), one sheet at a time — cost if wrong: none.
- **L728** Ruling: 5.4 all — the field anchor is the URL hash `#setting-<id>`, so the leave guard's Discard (which carries path + search + hash) still lands on the row and pulses it — cost if wrong: none.
- **L729** Ruling: 5.4 12-07 — no ☆ on group index headers (Device ›, Modules ›) and no per-row ☆ in the Modules index — why: pins are category ids (dispatch), and a ☆ button inside a row link would nest interactive controls. Each module's own header has its ☆ — cost if wrong: one button per row outside the link.
- **L730** Ruling: 5.4 all — the ☆ is hidden for anonymous viewers; a failed pin write rolls back through the optimistic cache with no toast (AdvancedCard's pattern) — cost if wrong: a toast.
- **L731** Ruling: 5.4 b-set-p1 — the phone list's field reads "Search settings" (today's `config_search.title`) with no shortcut hint; desktop reads "Search {{device}} settings" with ⌘, / Ctrl+, — why: board copy; a phone has no shortcut — cost if wrong: strings.
- **L732** Ruling: 5.4 all — the list field filters this device's visible categories by label and today's section keywords (`categoryIndex()`), and Enter does nothing special; "Search everywhere" carries the words into ⌘, search — cost if wrong: one key handler.
- **L733** Ruling: 5.4 all — reduced motion: the pulse holds the highlight with `steps(1)` and drops it, with no fade, so `animationend` still clears it — cost if wrong: CSS.
- **L734** Ruling: 5.4 all — new `UiIcon` `enterKey` (lucide CornerDownLeft) for the footer's Enter hint — why: no Enter glyph in the registry; no Unicode stand-ins — cost if wrong: one registry entry.
- **L735** Ruling: 5.4 all — ⌘, does nothing while any modal dialog is open, message search included (it used to swap message search for settings search) — why: D9c one layer at a time; Escape closes only the top layer (CR) — cost if wrong: one extra key press (close message search first).

#### Task 5.5 — Identity, Channels, Security

- **L739** Ruling: 5.5 EB — the board-drawn additions (Key size row, private-key Show behind a confirm, Move up/down buttons in reorder mode) are accepted: the canvas is spec and each one sets only what today's write already sends — cost if wrong: drop the rows/buttons.
- **L740** Ruling: 5.5 EC — a channel field found by search while a channel page is open links to the list, where that row isn't drawn; deferred minor (search covers only mounted kit rows, DT) — cost if wrong: one dead-end result.
- **L741** Ruling: 5.5 ED — leave guard still misses browser Back, now for channel drafts too; covered by DP, already a FINAL REPORT ITEM — cost if wrong: a lost channel draft on Back.
- **L742** Ruling: 5.5 EE — channels stay off the radio queue and keep their own per-slot save on the channel page (the implementer's candidate). DN allowed this, and the write depends on the draft the page opened with — cost if wrong: an explicit channel entry in the queue.
- **L743** Ruling: 5.5 EF — Security's confirms run before the first write of the whole batch, and invalid-key messages show as toasts instead of alert(), since Workspace has no alert() anywhere — cost if wrong: move the guard into the loop and add one notice.
- **L744** Ruling: 5.5 EG — promoted to the fix round: M1 (the guard test asserts the LoRa write and that Security is still queued), M2 (the media query moves to data-phone, a global constraint), M3 (SendsLine on channel delete and Import Selected, a mesh rule), M4 (a new channel's leave card shows no "0 changes"). Deferred: M5 (the policy body duplicates Classic's), M6 (fixture looseness), M7 (the paste field auto-closes), M8 (copy feedback) — cost if wrong: minor polish later.
- **L745** Ruling: 5.5 EH — I1 fixed by taking 1 byte out of Generate (today always generates 32 bytes); a 1-byte key can still be typed by hand, as today. The I2 test comment's "5 s poll" is wrong: the frame's DataProvider starts 'disconnected', so usePoll arms no interval (DM holds). Deferred minor: fix the comment — cost if wrong: none.
- **L746** Ruling: 5.5 12-02/12-15 — a channel keeps today's per-channel save on its page (its own dock: Discard, Review, Save to device), not the radio queue — why: channel drafts are not device-config state; today's write is one `updateChannel` per slot whose `psk` / `useAead` depend on the draft the card opened with (`pskForSave`, `aeadForSave`), sent at once on click; queuing it would change when it is written and batch it with config sections — cost if wrong: an explicit channel entry in the queue.
- **L747** Ruling: 5.5 all — the radio bar yields to a page's own dock (reorder mode, a dirty channel page) through `SettingsDockContext.claim()`; queued radio edits stay queued and show again on other pages — why: one dock (D9c) — cost if wrong: none.
- **L748** Ruling: 5.5 all — Security's confirms run before the first write of the whole save, not between sections — why: "before the write, after Save" as Classic; asking mid-batch could leave the confirm open while an earlier section's restart is under way — cost if wrong: move the guard call into the loop.
- **L749** Ruling: 5.5 all — a declined Security confirm is `cancelled` (still queued, no "Not saved" notice); invalid admin keys and an invalid private key toast today's message and count as declined (Classic `alert()`) — cost if wrong: one notice.
- **L750** Ruling: 5.5 12-04 — the private key's Show (new) and Copy ask first with a ConfirmSheet: Copy with today's `copy_private_key_confirm`, Show with today's `private_key_warning`; the titles are new `workspace.*` strings — why: the board's "Showing or copying asks first"; today has no Show — cost if wrong: drop Show.
- **L751** Ruling: 5.5 12-01/12-14 — reorder mode is entered with Reorder and drags with handles (dnd-kit, as today) or the Move up / Move down buttons; outside the mode a card is a link to its page — why: a card that opens on tap cannot also drag; the buttons give keyboard and phone users a way that does not depend on a drag — cost if wrong: drop the buttons.
- **L752** Ruling: 5.5 12-01 — the reorder controls are the bottom dock on desktop too (the board draws a banner above the toolbar) — why: "reorder mode takes the save dock" (brief, s12n5) — cost if wrong: CSS.
- **L753** Ruling: 5.5 12-01/12-14 — Apply Order and Import Selected have no ConfirmSheet; the dock / page text says what happens — why: today has none, and the boards draw none (D9d); BH's `submitOnEnter={false}` applies to the delete, the policy and the private-key confirms here — cost if wrong: two ConfirmSheets.
- **L754** Ruling: 5.5 12-01/12-14 — a "Share and import channels" button in the toolbar opens 12-03 (the board reaches it from ⋯ / the phone link icon); the card ⋯ is not built: Export / Import / Delete are on the channel's page — cost if wrong: a menu.
- **L755** Ruling: 5.5 12-02/12-15 — Export / Import are a "JSON" row with today's "Export" / "Import" labels (D9b), not header buttons labelled "Export JSON" / "Import JSON" — cost if wrong: strings / placement.
- **L756** Ruling: 5.5 12-02/12-15 — Key size and Role are selects (desktop native, phone sheet); Role lists Primary / Secondary / Disabled with the ones today does not offer disabled (never two primaries) — cost if wrong: a segmented control.
- **L757** Ruling: 5.5 12-02 — Key size (1 / 16 / 32 bytes) is new and only sets what Generate makes; default 32 (today's) or the current key's length — why: the board — cost if wrong: drop the row.
- **L758** Ruling: 5.5 12-03 — Import keeps today's behaviour: the decoded rows' ticks only gate Import Selected (today's server import applies the whole URL); the five steps are today's statuses, a skipped Rebooting / Syncing stays unticked — cost if wrong: none.
- **L759** Ruling: 5.5 12-03 — the MeshCore note shows only when the viewer has a MeshCore source, named by it — cost if wrong: one line.
- **L760** Ruling: 5.5 12-05 — no preview card ("How other nodes list you after the save") — why: not in today's section or the must list — cost if wrong: one card.
- **L761** Ruling: 5.5 12-04/12-17 — the four switches are one per row on desktop (the board pairs two per row) — cost if wrong: CSS.
- **L762** Ruling: 5.5 all — the desktop radio bar's sub line ends "Sends nothing on the mesh" (12-04, 12-05 draw it) — cost if wrong: none.
- **L763** Ruling: 5.5 board checks (D9b / board narrative):
- **L764** Ruling: 5.5 17-02 (DJ) — "Athens" un-staged: the channel test edits Athens Ops (name and uplink), leaves, and checks 17-02 with no staged string; the LoRa leave-guard test no longer checks that board — cost if wrong: none.
- **L765** Ruling: 5.5 I1 12-02 — 1 byte is left out of Generate's sizes. Why: today's editor always generates `generateChannelKey(PSK_GENERATE_BYTES = 32)`, and a 1-byte PSK is an index into the public default key (`AA==` turns encryption off), never a secret. Typing a 1-byte key by hand stays allowed, as today (`PSK_ALLOWED_BYTES`). Cost if wrong: a "Default key" option.

#### Task 5.6 — Device and module categories

- **L769** Ruling: 5.6 EA — Bluetooth category shows only what today exposes; no editor or save invented; if today exposes nothing, the category is left out with a Ruling line — no new features (spec) — if wrong, a Bluetooth editor is a follow-up feature.
- **L770** Ruling: 5.6 EL — MQTT keeps its own section and save bar (DN path), since a link-only staging has no field diff and the queue would not write it — accepted; FINAL REPORT ITEM (MQTT is the one radio category off the queue) — cost if wrong: an explicit MQTT queue entry.
- **L771** Ruling: 5.6 EM — Bluetooth left out per EA. "Bluetooth" must not stay `staged` in 12-06/12-22: the phase gate needs zero staged entries, so drop it from those checks as ruled out (EA) in the fix round — cost if wrong: one string check.
- **L772** Ruling: 5.6 EN — reused BroadcastTargetsEditor and the Traffic Management estimate panel are accepted (no new features, logic reuse); the visual gap is a deferred minor — cost if wrong: restyle later.
- **L773** Ruling: 5.6 EO — the Wi-Fi password masking in Review and "was …" is accepted (a secret should not show in clear text) — cost if wrong: none.
- **L774** Ruling: 5.6 EP — every minor is promoted, since each is small and in shared code: M1 select onChange, M2 unknown module returns early, M3 52 px rows via height, M4 scope the global selector (global constraint), M5 search id prefix plus "Pick on map" registered, M6 tests. Plus EM (drop the staged "Bluetooth") — cost if wrong: a slightly bigger fix round.
- **L775** Ruling: 5.6 EQ — an over-long MeshBeacon message holds Save on every page, the same as any other invalid queued field in the 5.3 queue. The user shortens it or discards MeshBeacon's edits. It is consistent with how the queue treats an invalid number, and it is visible — cost if wrong: per-section save exclusion.
- **L776** Ruling: 5.6 all — MQTT keeps today's MQTTConfigSection and its own save bar — why: its save writes the broker preset id (passed to `onSave`) and the staged MQTT link after the config, from state held inside the section (quick-configure selection, server-fill preset); a link-only change has no field diff, so the queue would not see it and would not write it, which changes what is written — cost if wrong: MQTT looks Classic until a follow-up lifts that state into the frame.
- **L777** Ruling: 5.6 12-06/12-22 — Bluetooth is left out — why: EA; today has no Bluetooth section, fields or save (only Power's "Bluetooth wait", which stays in Power); "Bluetooth" stays staged in both board checks — cost if wrong: one row short of the board.
- **L778** Ruling: 5.6 12-06/12-22 — summaries name only what today exposes: no "24 h clock" (Display) and no "Ethernet" (Network); rebroadcast shows today's option name ("ALL") — why: EA / D9b — cost if wrong: summaries shorter than the board.
- **L779** Ruling: 5.6 12-06/12-22 — Pins in use: no I²C row; "Set in" is the category (linked) rather than "Device › user button"; conflict uses today's `gpio_summary.conflict_warning`; the footnote is the board's text (no en.json string labels it) — why: EA (today tracks only these pins), D9b — cost if wrong: copy differs from the board.
- **L780** Ruling: 5.6 12-06 — no per-category icons in the Device index — why: the existing index has none and no board icon names map to UiIcon one to one — cost if wrong: visual gap against the board.
- **L781** Ruling: 5.6 all — a module the build leaves out, or the firmware is too old for, shows today's notice with its rows view only (Locked), as today's ModuleAvailabilityGate / isDisabled greyed them — cost if wrong: none expected.
- **L782** Ruling: 5.6 all — TAK on firmware < 2.8 is no longer folded under "not on this firmware"; it opens view only with `tak_config.unsupported` (D9d) — cost if wrong: TAK listed on old firmware.
- **L783** Ruling: 5.6 all — Status Message's "Re-apply after a reboot" keeps today's gate (module support only), not the category's configuration:write — why: D9d, it is a MeshMonitor setting saved on change — cost if wrong: a viewer without configuration:write can still flip it, as today.
- **L784** Ruling: 5.6 all — MeshBeacon's BroadcastTargetsEditor and Traffic Management's replay panel are today's components inside the page (kit field metrics applied to their inputs) — why: re-composing existing parts; rebuilding them is out of scope — cost if wrong: two blocks look closer to Classic than the rows around them.
- **L785** Ruling: 5.6 all — `formatValue` masks the Wi-Fi password in Review and "was …" — why: it showed in clear before (Classic placeholder) — cost if wrong: none.
- **L786** Ruling: 5.6 all — Ambient Lighting's colour sliders are number rows (0–255) with the preview swatch — why: the kit has no slider; same range and values — cost if wrong: less direct colour picking.
- **L787** Ruling: 5.6 all — an over-long MeshBeacon message holds the radio Save on every page through the frame's invalid-field scope, with today's invalid-fields words, only while MeshBeacon is queued on firmware that has it — why: today's section never saved it, and the device drops the whole config silently; no guard or confirm is used — cost if wrong: an unrelated section cannot be saved until the message is shortened or MeshBeacon's edits are discarded (Review lists MeshBeacon, and Discard reaches it).

#### Task 5.7 — Maintenance, Backup, Firmware, Danger zone

- **L791** Ruling: 5.7 ER — Firmware unrestyled (today's FirmwareUpdateSection inside the Workspace page) is provisionally accepted pending review — why: the brief's first constraint was "do not change what it downloads or flashes"; a redraw of a 1,500-line flash flow with half-flash recovery is a separate risk class — cost if wrong: 12-09/12-19 do not match the board until a dedicated restyle lands; FINAL REPORT ITEM if the review does not force it.
- **L792** Ruling: 5.7 ES — Shut down / DFU / Reset config / Full reset move into Danger zone, admin-only, typed short name for resets — accepted (s12n3, today's requireAdmin) — cost if wrong: non-admin configuration:write users see fewer rows.
- **L793** Ruling: 5.7 ET — remote target: only DFU and resets disabled; Reboot / Purge / Shut down routing is 5.9's (carried into the 5.9 dispatch addendum) — cost if wrong: 5.9 misses it; the shortcut: comment marks it.
- **L794** Ruling: 5.7 EU — board-check string edits to today's en.json wording and dropped annotations accepted (D9b / Ruling I) — cost if wrong: copy.
- **L795** Ruling: 5.7 EV — Workspace test edits (settingsFrame placeholder test removed, pollRate moved to Danger zone) accepted: Workspace code, not Classic — cost if wrong: none.
- **L796** Ruling: 5.7 EW — I1 accepted, ER withdrawn: Firmware is redrawn to 12-09/12-19 (segmented channel control, release cards, wizard in the shared docked Sheet) via a Rule X extraction of FirmwareUpdateSection's state into a hook; every request, flash step and safety rail (half-flash recovery, sibling-build warning, local-upload acknowledgement, unsupported card, admin+OTA gate) is preserved and tested in the Workspace view; Classic DOM and tests unchanged — why: the canvas is spec and the user asked for it exactly as drawn; the dispatch already allowed the extraction — cost if wrong: one extra fix round of work.
- **L797** Ruling: 5.7 EX — I2 accepted: Shut down reads canShutdown from the local cached metadata endpoint only if it sends no packet (verify in adminRoutes), with today's cannot_note; if it would transmit, keep the button live and record why.
- **L798** Ruling: 5.7 EY — promote M1, M2, M3, M4, M5, M6, M8 into round 1 (all small, M4 is a confirm-safety gap). M7 deferred (carried from 5.2, not a regression).
- **L799** Ruling: 5.7 EZ — M8 phone rules starting with `[data-phone]` (not a module class) accepted: SettingsPages.module.css already does the same (`[data-phone] .button`), and the attribute comes from CategoryPage's <main> — cost if wrong: a selector-convention test would need an exception.
- **L800** Ruling: 5.7 12-09/12-19 — Firmware is today's FirmwareUpdateSection inside the Workspace page (header "Maintenance ›", "Admins only · OTA updates are on for this server", SendsLine). It is not rebuilt as the board's segmented channel picker, release cards and docked wizard sheet. — why: the brief says to reuse the wizard as is. The 1,500-line section holds the channel / custom-URL / local-upload flows, the half-flash recovery, the sibling-build warning and the wizard steps. Re-drawing it would duplicate all of them and risk dropping a safety rail on a flash path. — cost if wrong: a follow-up restyle that extracts its state into a hook (Rule X) and draws the board's layout. The wizard stays a centred overlay until then.
- **L801** Ruling: 5.7 12-09/12-19 board checks — "Local .bin" → "Local File (Upload)", "Check now" → "Check Now", "Release notes" → "Release Notes", "Retry flash" → "Retry Flash" — why: D9b / Ruling I. — cost if wrong: string checks.
- **L802** Ruling: 5.7 12-09/12-19 — the board draws releases, the flash step, the stopped flash and another device's unsupported card at once. The test renders each state and joins the texts (Ruling 2.3's way). — cost if wrong: none.
- **L803** Ruling: 5.7 12-08/12-18 board checks — "3 changes detected" → "3 change(s) detected"; Old / New → Previous / Current; "Hop limit" → "Hop Limit"; "Create backup" → "Create Backup Now"; "Automatic backups" → "Enable Automatic Backups"; "Last backup" → "Last automatic backup"; "reboots" → "reboot"; "Purge node database" → "Purge Node Database" — why: D9b, today's labels for the same controls. — cost if wrong: string checks.
- **L804** Ruling: 5.7 12-08 — "identity" was dropped from the check — why: today's Meshtastic restore summary has no identity line (only MeshCore's does). Today's summary is reused as is. — cost if wrong: one line in the summary.
- **L805** Ruling: 5.7 12-27 — dropped "What changes", "private key is kept" and "Restore and reboot"; "slots 0–2" → "channel slots will be overwritten" — why: the brief says to reuse today's summary and words. Today's confirm label is "Restore", and its summary lists the slots one per line. — cost if wrong: copy.
- **L806** Ruling: 5.7 12-27/12-28 — "Maintenance page" was dropped — why: it is in the board's "↑ … are on the Maintenance page" line, a board annotation naming cards above the fold (s12n5), not UI. — cost if wrong: none.
- **L807** Ruling: 5.7 12-10 — "same docked sheet" and "no typed word" were dropped — why: the board's footnote is an annotation. The behaviour (Reboot opens the same sheet, plain, with today's words) is tested instead. — cost if wrong: none.
- **L808** Ruling: 5.7 12-10/12-28 — "Purge node database" → "Purge Node Database" (D9b). — cost if wrong: string check.
- **L809** Ruling: 5.7 all — Shut down, Reboot into DFU mode, Reset config and Full device reset moved into the Danger zone. They are shown to admins only (today's `/api/admin/commands` is `requireAdmin`, and Admin Commands is an admin page). Shut down asks plainly for the local node, as today. Both resets type the short name (node id when it has none, as DeviceActionsSection), and are off while that word is blank so they can never become plain. The "on Admin Commands" note is gone. — why: s12n3 "locally they move from Admin Commands into Maintenance › Danger zone". — cost if wrong: a non-admin with configuration:write sees fewer rows than the board.
- **L810** Ruling: 5.7 all — canShutdown is not checked: the local metadata is not in the poll, and asking the node for it would be new traffic. Shut down stays on, as Admin Commands does before its metadata loads. — cost if wrong: a node that cannot shut down ignores the packet.
- **L811** Ruling: 5.7 all — on a remote target only DFU and the resets are off, with today's `device_actions.local_only_note`. Reboot, Purge and Shut down still act on the local node, marked with a `shortcut:` comment for Task 5.9 to route them (today's remote reboot delay, remote shutdown typed confirm). — why: the brief names only the resets' remote state. — cost if wrong: 5.9 must flip three more actions, and its comment says so.
- **L812** Ruling: 5.7 all — Import / Export is a row linking to Channels › Share and import (Task 5.5's page of today's two dialogs), not today's centred modals. — why: no centred dialogs (s8n2); that page is the same requests. — cost if wrong: one extra tap.
- **L813** Ruling: 5.7 all — the backup list is read once on open and after a create or delete. Today read it only on "Show Saved Backups", into a modal. — why: the boards draw it inline. One GET, no timer. — cost if wrong: one GET per open.
- **L814** Ruling: 5.7 all — Delete asks in a ConfirmSheet with today's words (`backup_management.confirm_delete`) in place of `window.confirm`. — cost if wrong: none.
- **L815** Ruling: 5.7 all — Reload keeps today's gate: no write grant is needed, as Classic's button. It shows "Sends config requests to this node" (new string; today had no wording). — cost if wrong: a viewer without configuration:write can reload, as today.
- **L816** Ruling: 5.7 all — the Maintenance page is one page (firmware card, Backup, Danger zone). Each part shows under its own category's gate, and the child pages exist for 12-09 / 12-10 and search. On phone the danger rows keep the desktop grouping (Restart the radio, Node database, Firmware recovery, Factory reset), with buttons wrapping under each label. The board's one-row-per-action phone list is not drawn. — cost if wrong: CSS / layout.
- **L817** Ruling: 5.7 all — "View only" is shown on Backup and Danger zone (per grant), not on the Maintenance group page, whose header has no scope line (as Device and Modules). — cost if wrong: one badge.
- **L818** Ruling: 5.7 all — the firmware card shows "→ latest · Update Available" when the newest release on the saved channel is newer than the installed version (compareVersions on x.y.z). It uses the section's own releases query, with no extra request beyond it. — cost if wrong: copy.
- **L819** Ruling: 5.7 all — Rule X extractions with Classic DOM and tests unchanged: `useBackupManagement` (BackupManagementSection's state, requests and SaveBar registration; the caller asks before a delete) and `BackupRestoreSummary` (BackupRestoreConfirmDialog's preview, with the legacy tick held by the caller). — cost if wrong: none.
- **L820** Ruling: 5.7 DL minors — "purge busy prop untested": 12-10-danger holds the purge reply and asserts the spinner and that Cancel and the field are off. "Backup restyle untested": the Maintenance › Backup tests in 12-08-maintenance. — cost if wrong: none.
- **L821** Ruling: 5.7 pollRate — Backup no longer reads `/api/poll` (Export moved to Share and import). The poll-rate test now covers Danger zone, which reads it once for the node id. — cost if wrong: none.
- **L822** Ruling: 5.7 settingsFrame — the placeholder danger-zone test (testids, fieldset) was removed. 12-10-danger covers the read-only gate on the new DOM. — cost if wrong: none.
- **L823** Ruling: 5.7 12-19 — the phone bar titles the page "Firmware" (board) through `phoneTitle`, because "Firmware Updates" overlapped "‹ Maintenance". — cost if wrong: none.
- **L824** Ruling: 5.7 12-09/12-19 — the channel saves with Save, shown only while the picked channel or URL differs from the saved one (today's select also waited for Save). The board's segmented control has no Save. — why: D9d; Install from URL fetches what the server saved (#5011). — cost if wrong: one extra click.
- **L825** Ruling: 5.7 12-09/12-19 — the release list stays on the page while an update runs, with Install off. Today hid it behind the modal. — why: the board draws the list beside the docked wizard. — cost if wrong: none.
- **L826** Ruling: 5.7 12-09/12-19 — Escape, the backdrop and Close hide the wizard sheet; the update keeps running and "Show the update" (new string) reopens it. Today's modal had no close. — why: CR, and closing must never cancel a flash. — cost if wrong: one notice row.
- **L827** Ruling: 5.7 12-09/12-19 — the failed flash shows today's Dismiss and Retry Flash. The board's "Cancel" is today's Cancel Update in the awaiting and in-progress states. — why: D9d. — cost if wrong: copy.
- **L828** Ruling: 5.7 12-19 — the phone channel is the same segmented control, wrapping at 44 px, not the board's "Stable ›" row that opens a sheet. — cost if wrong: one sheet.
- **L829** Ruling: 5.7 all — the configuration-backup restore's confirm words were hard-coded English in Classic (`window.confirm`). They are now en.json `workspace.settings.maintenance.firmware_restore_*` with the same words. — cost if wrong: none.
- **L830** Ruling: 5.7 EX — canShutdown is read from `/api/admin/get-device-metadata` without `nodeNum` (local cache branch, no packet), once, admins only. This replaces the earlier "canShutdown is not checked" line. — cost if wrong: none.
- **L831** Ruling: 5.7 M8 — Maintenance's phone rules start with `[data-phone]` (CategoryPage's `<main>`), as SettingsPages.module.css does, not with a module class. The wizard, which portals, uses its own `.wizard[data-phone]`. — cost if wrong: CSS.

#### Task 5.8 — In MeshMonitor categories and Notifications

- **L835** Ruling: 5.8 FA — concerns 2 (inactive-node trio and LocalStats interval keep a Save: they reschedule / send on save) accepted as the checklist demands — cost if wrong: two rows less convenient.
- **L836** Ruling: 5.8 FB — concerns 1 (MQTT bridge unredrawn, 15 s useSourceStatuses inside it), 4 (Web Push requests duplicated), 5 (new /you/notifications route) left to the review on the merits; no provisional acceptance.
- **L837** Ruling: 5.8 FC — concern 3 (Reset to Defaults reloads at once; purges invalidate queries instead of a 1.5 s reload) provisionally accepted: no timer, same end state — cost if wrong: the success toast is not seen.
- **L838** Ruling: 5.8 FD — I1 accepted (FB withdrawn for MQTT): redraw MQTT bridge to 12-13/12-24 through a Rule X hook extraction of MqttBridgeConfigurationView's state, same as 5.7 EW; keep its own Save (not on the radio queue), claim the dock, and restore the 12-24 check string. Status polling: if the Workspace shell already keeps the same useSourceStatuses query live, reuse it (no extra requests); otherwise read once on open and after its own save (Ruling DM). — cost if wrong: one more fix round.
- **L839** Ruling: 5.8 FE — I2 accepted: extract the Web Push encoders and the #5493 subscribe / unsubscribe / status sequences from NotificationsTab under Rule X and use them from both; today's "subscribed" fallback on a failed /subscription-status applies to Workspace too.
- **L840** Ruling: 5.8 FF — promote M1–M8 and the Reliable PKI half of M9 (reuse 5.7's segmented control, moved to the kit if it lives in a Maintenance module). The altitude half of M9 stands under D9d.
- **L841** Ruling: 5.8 FG — FD's status-read correction accepted: the bridge page adds one status read on open (refetch of the shell's stale query) and no interval of its own; that is "read once on open" (DM). — cost if wrong: one GET per open.
- **L842** Ruling: 5.8 all — In MeshMonitor rows save as you go through `useAutosaveSetting`, with SettingsTab's split (`SETTINGS_TAB_PER_SOURCE_KEYS` scoped, else global). Reliable PKI and coverage recording pass `scoped`, as their sections did. No SettingsTab extraction was needed — why: the split constant already lives in `constants/nodeDisplayDefaults.ts` — cost if wrong: a key the server treats as per-source would be written globally; that is the same as Classic today.
- **L843** Ruling: 5.8 12-12 — the inactive-node trio and the LocalStats interval keep an inline Save. Saving them reschedules the inactive-node check, or restarts LocalStats and fires one request to the own node 30 s later — why: mesh checklist 3 (dispatch rule) — cost if wrong: one extra click on four rows.
- **L844** Ruling: 5.8 all — the read after our own write is a React Query invalidate (one GET per committed row), on top of a `setQueryData` patch so the row never flashes the old value — why: Ruling DM — cost if wrong: one extra GET per save.
- **L845** Ruling: 5.8 all — In MeshMonitor pages get their own number scope (an empty `NumberInputScopeContext`), so an invalid autosave number neither holds nor is held by the radio Save. It is simply not sent — why: dispatch addendum ("an invalid autosave value simply is not sent") — cost if wrong: an invalid field there would no longer block the radio bar's Save.
- **L846** Ruling: 5.8 all — board-check strings changed to today's en.json labels for the same controls (D9b, Ruling I for CSS uppercase):
- **L847** Ruling: 5.8 12-12 — the board draws six pages side by side; the test renders each page and joins their texts (Ruling 2.3's way). The Playwright shot is the Node Display page — cost if wrong: none.
- **L848** Ruling: 5.8 12-12 — Altitude is today's two number rows (AGL threshold, MSL fallback), not the board's MSL/AGL segmented control. Reliable PKI is today's select, not a segmented control. The pages have no scope-line icons — why: D9d; the kit has no segmented control — cost if wrong: visual difference.
- **L849** Ruling: 5.8 12-12 — Node display's Advanced holds LocalStats, hop source, TX target window, homoglyph, aircraft position requests and age-out (s12n4). Homoglyph moved here from Notifications & Security — why: s12n4 — cost if wrong: one row's place.
- **L850** Ruling: 5.8 12-12/12-23 — Data's confirms are ConfirmSheets with today's window.confirm words (title, "Impact:", items, "cannot be undone"), asking plainly. Purge messages keeps today's call, which purges every source; its note says so. After a purge every query is invalidated (today reloaded the page after 1.5 s). After Reset to Defaults the page reloads at once (SettingsContext reads its defaults only on load), so today's success toast is not seen — why: no new timers (N), and the context must re-read — cost if wrong: a missing toast on reset.
- **L851** Ruling: 5.8 12-23 — Data's scope line has no "saves as you go" (12-12 has none; Data has no autosave rows), and its note names which purges are per-source — cost if wrong: one phrase.
- **L852** Ruling: 5.8 12-13/12-24 — the MQTT bridge is today's MqttBridgeConfigurationView inside the Workspace page, with its own Save and today's SaveBar. The board's two-column grid and phone summary rows are not drawn; the page header carries "its own Save, because saving reconnects" and the phone title "MQTT bridge". The view keeps today's 15 s `useSourceStatuses` read (not new). No dock claim, because a bridge has no radio bar — why: dispatch ("keeps its own Save"); rebuilding a 1,000-line form duplicates its preset, masked-credential and geo logic — cost if wrong: a later restyle.
- **L853** Ruling: 5.8 b-set-d5 — "Web Push on this browser" is this browser's subscription for this source; turning it on also turns on the user's Web Push service (enableWebPush), which delivery needs. Today's browser-support table, iOS steps, HTTPS help and debug line are not drawn; the row's help gives today's not-supported, HTTPS-required or permission-denied text instead — why: board row; D9d for the words — cost if wrong: less setup help on the page.
- **L854** Ruling: 5.8 b-set-d5 — Replies and Mentions show on `meshtastic_tcp` only. An MQTT source has no own node, and the notifier never fires for it. The help strings are new: today's Mentions help describes MeshCore's `@[Name]` — cost if wrong: two rows hidden on MQTT sources.
- **L855** Ruling: 5.8 b-set-d5 — Apprise URLs and the VAPID contact email keep an inline Save (bs2: connection fields). The VAPID block stays here for admins until Server › Notification services (18-11) is built in Phase 6 — cost if wrong: it moves later.
- **L856** Ruling: 5.8 b-set-d5 — the message-format section (today's NotificationFormatSection) saves when focus leaves the section; a text-max commit saves at once; a rejected template shows the server's message — why: text saves on blur; the section is one form — cost if wrong: one write per section visit.
- **L857** Ruling: 5.8 b-set-d5 — the Audio row keeps today's Settings-tab gate (canOpenSourceSettings), as the 5.2 I2 fix did — cost if wrong: none.
- **L858** Ruling: 5.8 s2 — You › Notifications is a new route `/you/notifications`, and You's Notifications row opens it (s1-you test edited). Each device's switch is this browser's subscription for that device; turning it on also sets that device's enableWebPush. The summary reads DMs / mentions / replies from the device's preferences, read only while subscribed — why: ds15 "push per device for this browser" — cost if wrong: one route.
- **L859** Ruling: 5.8 s2 — TwoLineRow cuts "What each device sends" to "What each device" at 390 px beside "In its settings". The shared row was not changed — cost if wrong: a CSS change in TwoLineRow.
- **L860** Ruling: 5.8 all — Web Push requests repeat NotificationsTab's sequence in `webPush.ts`, and NotificationsTab is not refactored onto it — why: its subscribe flow interleaves debug-status UI, and Classic tests pin it — cost if wrong: two copies of ~60 lines to keep in step.
- **L861** Ruling: 5.8 settingsFrame — the two "today's gates inside the placeholders" tests were rewritten for the new Notifications page (Audio row present only with Settings). These are Workspace tests, as in 5.7 EV — cost if wrong: none.
- **L862** Ruling: 5.8 all — `ClassicCategories.tsx` stays, holding only Modules › MQTT (Ruling 5.6). Every In MeshMonitor placeholder, `classic()` and `firstSectionOf` are removed — cost if wrong: none.
- **L863** Ruling: 5.8 FD — the MQTT bridge page is the kit redraw over `useMqttBridgeConfig` and `useBrokerPresetChoice` (Rule X; Classic DOM and tests unchanged). The broker preset is a kit select (today's built-in and saved presets in one list) with Save as preset / Manage buttons that open today's dialogs. The uplink channels are chips (known channels unpressed, picked ones pressed with ×) — why: the board draws a select and chips; the dialogs are today's — cost if wrong: two centred dialogs stay for admins.
- **L864** Ruling: 5.8 FD — the geo box keeps today's map editor above North/South/West/East fields (new strings; today's labels are the raw keys minLat…), plus today's drop counts and sweep line — cost if wrong: strings.
- **L865** Ruling: 5.8 FD — kit `SettingRow` gains `stacked` (label above a full-width control on desktop), for form fields in half-width cards — cost if wrong: one kit prop.
- **L866** Ruling: 5.8 FD — the bridge status uses the shell's live `useSourceStatuses` query (same key). The page adds no request and no interval; the shell's existing 15 s read is not removed by this page — cost if wrong: none for this page.
- **L867** Ruling: 5.8 FD — the phone scope line reads "its own Save" (12-24); desktop keeps "its own Save, because saving reconnects" — cost if wrong: one string.
- **L868** Ruling: 5.8 FE — Web Push requests live in `services/webPushSubscription.ts`. NotificationsTab keeps its debug line through `subscribeSource`'s `onStep` — cost if wrong: none.
- **L869** Ruling: 5.8 FF M9 — `SettingSegmented` moved into the kit. Reliable PKI's segments keep today's option labels ("Use the global default (Off)", "Off", "As needed", "Avoid PKI"), so the first segment is longer than the board's "Inherit" (D9b) — cost if wrong: one label.

#### Task 5.9 — remote target in settings

- **L873** Ruling: 5.9 FH — implementer concerns (remote gaps: Bluetooth / URL share / channel JSON; "Acknowledged" wording vs server semantics; payload builders mirrored in remoteConfig.ts; unguarded target switch with unsent remote edits; dropped delayed channel re-read; board-check edits; console prefix row / confirm modal / unknown-status buttons) are left to the review on the merits; no provisional acceptance.
- **L874** Ruling: 5.9 GA — I2: Send to node results are 'sent' | 'noReply' (not 'acknowledged'). The UI says today's success wording for a completed send (or "Sent" if today has none) and never claims an ACK the server does not wait for; 'noReply' stays for PASSKEY_TIMEOUT. The channels sidebar status (M6) uses the same states. — why: honesty about mesh delivery beats the board's word; today's server awaits no routing ACK on config sets — cost if wrong: board copy differs from 12-25/b-set-d6.
- **L875** Ruling: 5.9 GB — I1, I3, I4, I5 accepted as found. I1: on a remote target, module support follows AdminCommandsTab (no "unsupported by firmware" lock unless today has one remotely); firmware version and identity come from what MeshMonitor already holds for that node (node list / last read), with no extra request; local-only rows (status-message re-apply) hide on remote. I5: match today's read semantics exactly and pin remoteCommand payloads to AdminCommandsTab's for all 13 commands in a test.
- **L876** Ruling: 5.9 GC — M8: remote channel Delete (role Disabled), channel JSON export/import and config-URL share/import are offered on a remote target where they reuse the existing Channels / Share pages with the remote values and the remote send path (one admin packet per changed slot, SendsLine honest). Bluetooth stays out (EA/EM); FINAL REPORT ITEM: remote Bluetooth is Classic-only. If one of these turns out not to fit the remote path cleanly, give a Ruling line and it becomes a FINAL REPORT ITEM.
- **L877** Ruling: 5.9 GD — promote M1, M2, M3, M4 (no /api/poll interval because a remote target is set: read once, DM), M5, M6, M7, M9, M10 (AEAD from what the node read returned, else shown unknown, not off).
- **L878** Ruling: 5.9 GE — remote config-URL export withheld is accepted as a FINAL REPORT ITEM — why: rebuilding the URL per tick would send a mesh read per ticked slot (mesh checklist) — cost if wrong: one Classic-only remote capability.
- **L879** Ruling: 5.9 GF — remote module lock seeding as supported follows today (D9d) — why: Admin Commands allows the same sends — cost if wrong: a 2.7.x node silently drops TM/MeshBeacon settings, as today. FINAL REPORT ITEM.
- **L880** Ruling: 5.9 GG — remote JSON export from the earlier read, and 12-25 copy change, go to the re-reviewer as concerns; not pre-accepted.
- **L881** Ruling: 5.9 GH — remote config-URL import is withheld on a remote target, like export (GE); FINAL REPORT ITEM: remote URL share/import is Classic-only and today's Classic import also drops sourceId — why: GC offered it only "where it fits the remote path", and the import API cannot target the selected source, so it could transmit from another radio — cost if wrong: one more remote capability stays in Classic. This also removes N2 and N3. N4 joins round 2.
- **L882** Ruling: 5.9 GG-a accepted (re-reviewer: acceptable): remote JSON export uses the earlier read and sends nothing; a stale file is possible. FINAL REPORT ITEM. GG-b (12-25 check string) is accepted.
- **L883** Ruling: 5.9 GI — pre-existing, out of scope, FINAL REPORT ITEMs:
  - (a) Browser Back can drop unsent remote edits; the leave guard covers link clicks only (same family as ED).
  - (b) Classic's remote config-URL import drops sourceId (api.ts importConfig), so on a multi-source install it transmits through the primary source.
  - (c) PRIVACY: channelLoadingUtils.ts:64 maps an elided positionPrecision to 32. A remote channel save then sends 32 (full-precision position) for a channel whose node has precision 0 (position off). This is the case in Classic Admin Commands today and is mirrored by the Workspace remote path. A follow-up task is suggested.
- **L887** Ruling: 5.9 all — the target is the URL's `?node=`. Links inside the settings drop the query, so the frame puts the picked node back while the settings stay open (a per-source store, cleared when the frame unmounts). An empty `?node=` means This radio and outranks the earlier node; it is also where `/admin` lands — why: one source of truth that survives reload, with no edit to every settings link — cost if wrong: an extra replace-navigation on each link click while remote.
- **L888** Ruling: 5.9 all — the remote values are a second `useDeviceConfigState(sourceId, 0, { load: false })` with its own queue (`rebase(section)` after a read), keyed by node. Switching node, or to This radio, drops what was read — why: Ruling DG, and it reuses every category page unchanged — cost if wrong: a re-read after switching back.
- **L889** Ruling: 5.9 b-set-d6 — a remote category's rows show only after a read in this session ("Not read from this node yet" first); the board's "read 2 days ago" would need a stored read — why: nothing is persisted, and firmware replaces the whole struct, so defaults must never be sendable — cost if wrong: one Read press per category per session.
- **L890** Ruling: 5.9 all — Send to node reports 'acknowledged' when the server reports the command done. Today's config sets wait for no routing ACK (`ACK_AWAITED_COMMANDS` only covers favorite and ignore). It reports 'noReply' when the ACK timed out or the passkey request timed out (`PASSKEY_TIMEOUT`, nothing applied, still queued). `sendCategory(id)` reads the queued values from the remote state instead of taking `values` — why: today's server signals — cost if wrong: "Acknowledged" over-claims for a config set the node dropped after the server sent it.
- **L891** Ruling: 5.9 all — the Attempts override applies to every remote command, as today's `executeCommand` does — why: parity — cost if wrong: none (blank sends nothing extra).
- **L892** Ruling: 5.9 all — remote categories are what today's Admin Commands reads and sends, plus the Danger zone and the two remote-only pages. Power, Display, the other modules, Backup and Firmware are hidden on remote. Bluetooth (today's remote section) has no Workspace category (5.2 DJ / 5.6), so it is not offered — why: parity with the pages that exist — cost if wrong: remote Bluetooth only in Classic.
- **L893** Ruling: 5.9 Channels — remote Share and import (12-03 scoped to the node), channel JSON export/import and the Delete-and-purge zone are not offered on a remote target. A remote slot is disabled through its role, as today's modal does — why: scope; the URL import's reconnect wait polls this radio's connection, not the node's — cost if wrong: remote URL import/export stays Classic-only (parked for Phase 9 polish).
- **L894** Ruling: 5.9 Channels — after a remote `setChannel` the slot shows what was sent. Today's 1.5 s delayed re-read is dropped — why: one packet fewer — cost if wrong: a stale slot until the next Read.
- **L895** Ruling: 5.9 Security — on remote the keys group is hidden (#4736). Today's `window.confirm` "Save security config to <node>?" is a ConfirmSheet asked before the frame's checks, and the Protection Level confirm names the node with its short name / node id — why: parity — cost if wrong: none.
- **L896** Ruling: 5.9 Network — rsyslog and UDP broadcast are hidden on remote — why: Admin Commands neither reads nor sends them, so an edit there would never go out — cost if wrong: two rows Classic-only.
- **L897** Ruling: 5.9 12-11 — a node whose favorite or ignored status is unknown offers both Set and Remove (today's buttons); the board draws one per column — why: D9d — cost if wrong: one extra button per unknown cell.
- **L898** Ruling: 5.9 12-11/12-29 — the target actions head both remote-only pages on desktop; on phone they are in the page bar's ⋯. The pin star is not shown on remote-only pages — why: the boards — cost if wrong: none.
- **L899** Ruling: 5.9 Danger — remote Reboot is today's `executeCommand('reboot', {seconds})` with the 0–60 s delay (default 5) in the sheet and today's `reboot_confirmation` text. Purge types PURGE (s12n3), where today's Admin Commands asks plainly — why: the board note overrides (D9d) — cost if wrong: one typed word.
- **L900** Ruling: 5.9 console — `CliConsoleBody`'s own typed-name danger modal is kept (the shared primitive, MESHCORE_REMOTE_ADMIN.md) rather than a ConfirmSheet. The prefix row sits above the transcript, where the board draws it below — why: the primitive owns the input row — cost if wrong: a non-sheet modal on that one path.
- **L901** Ruling: 5.9 save bar — on a remote target the bar shows no restart wording, says "Sends 1 admin packet per changed category", and stays as "No changes yet" on pages that save through it — why: board and brief; a remote node's restart timing is unknown — cost if wrong: none.
- **L902** Ruling: 5.9 leave guard — while a remote target is on, the leave guard guards that node's queue; this radio's queued edits are not guarded meanwhile. Switching target with unsent remote edits drops them without asking — why: one guard at a time (D9c) — cost if wrong: lost unsent edits on a deliberate switch.
- **L903** Ruling: 5.9 tx-status — read once (`refetchInterval: 0`) where Admin Commands rode App's 30 s poll — why: Ruling N — cost if wrong: a TX change mid-session is seen on the next pick or open.
- **L904** Ruling: 5.9 checks (D9b / Ruling I):
- **L905** Ruling: 5.9 PhoneShell — device settings draw their own header on a remote target too (the interim `?node=` exception is removed) — why: AD — cost if wrong: none.
- **L906** Ruling: 5.9 Rule X — `useAutoFavoriteTarget` (out of AutoFavoriteManagementSection; the confirm and the invalid-number hold stay with the caller), `useMeshtasticCliRunner` (out of MeshtasticRemoteCliConsole), and `useDeviceConfigState`'s `load` option. AdminCommandsTab is not edited, and its payload builders are mirrored in `remoteConfig.ts` over the Workspace fields, reusing `buildAdminMqttSavePayload`, `buildMeshBeaconConfigPayload`, `policyToSend` and `applyLoadedConfig` — why: D15; its builders read its own reducer state — cost if wrong: a future payload fix must touch both (comment points to it).
- **L907** Ruling: 5.9 GA boards — b-set-d6-remote: the list says "Sent" where the board draws "Acknowledged" ("Acknowledged" added to `absent`). 12-25-remote-console: the check's "Acknowledged" becomes "Set device.role to ROUTER", because the console shows only the node's own reply — why: today's server awaits no routing ACK for a config write — cost if wrong: board copy differs.
- **L908** Ruling: 5.9 I1 — on remote, module support is seeded as supported for Status Message, Traffic Management, MeshBeacon and TAK, and the firmware comes from the node row, then the security reply — why: today locks a remote module only when its load fails, and a failed read here shows no rows — cost if wrong: a 2.7.x node shows TM/MeshBeacon rows that its firmware ignores, as today's Admin Commands also lets you send.
- **L909** Ruling: 5.9 I4 — a remote node's MQTT is drawn on the kit and queued (Send to node). Presets, Quick-configure and the proxy warning are this radio's only — why: they read and write this radio's source — cost if wrong: no broker presets for a remote node (today's Admin Commands has none either).
- **L910** Ruling: 5.9 I5 — a field a remote reply elides is shown and sent as its proto3 zero, where today leaves it unset; the node receives the same protobuf — why: kit number fields cannot hold "unset" without reading as invalid — cost if wrong: none on the wire; a reviewer comparing raw JSON sees 0 where today omits.
- **L911** Ruling: 5.9 GC — the config-URL export (Share's Export card) is not offered on a remote target — why: it rebuilds the URL on every tick change, a remote `export-config` asks the node for each ticked slot over the mesh each time, and today's remote call carries no sourceId — cost if wrong: a FINAL REPORT ITEM; remote URL export stays Classic-only.
- **L912** Ruling: 5.9 GC — remote channel JSON export writes the file from the slot as read, where today re-reads the slot first (1 request) — why: one packet fewer, and the slot was just read — cost if wrong: a stale file if the slot changed since the read.
- **L913** Ruling: 5.9 M10 — remote AEAD stays read-only (today's Phase 1); support reads "not known" unless a read showed it in use — why: today sends the node's own flag back — cost if wrong: none.
- **L914** Ruling: 5.9 I3 — the leave guard on remote lists both queues in one sheet ("Position · Hilltop Relay" for the node's entries), and a target switch with unsent node edits asks with the same sheet — why: D9c, one sheet — cost if wrong: none.
- **L915** Ruling: 5.9 GH — remote config-URL import is withheld like export (GE). The Share link is hidden, and `channels/share` on a remote target falls back to the channel list, with no reason copy (GE showed none). FINAL REPORT ITEM: remote URL share/import is Classic-only, and today's Classic remote import also drops sourceId — why: the import API cannot name this source, so it could transmit through another radio — cost if wrong: one more remote capability stays in Classic.

#### Task 6.1 — You sign-in and security

- **L958** Ruling: 6.1 GJ — promote M2, M4, M5, M7 and M8 into round 1:
- **L959** Ruling: 6.1 GK — M3 (8 px code-list padding in OneTimeReveal) and M6 (the DISABLE word check lives in the sheet) are accepted as deferred minors.
- **L960** Ruling: 6.1 all — Rule X: today's logic moved unchanged into `src/components/account/` hooks. Classic consumes them with the same DOM, and its tests pass with no edits. Workspace pages are kit redraws over the same hooks — why: dispatch ("behaviour must equal today's, step for step") — cost if wrong: Classic's six components now import hooks.
- **L961** Ruling: 6.1 all — board-check strings changed to today's en.json labels for the same controls (D9b, Ruling I for CSS uppercase):
- **L962** Ruling: 6.1 r1/r2/b-set-p5 — the Preferences rows (YouSidebar and YouHome) are Layout plus today's preference categories with today's labels and gates (Language, Units & Formats, Sorting, Appearance, Link Previews, MeshCore Messaging, Map). The boards' merged "Language & units" is Task 6.3's page — why: D9b; each row lands on today's section until 6.3 — cost if wrong: 6.3 relabels and merges rows.
- **L963** Ruling: 6.1 r1 — no Profile row; no "Changed N ago" on the password row; no "Backup codes · N left" (today's API exposes no password date and no backup-code count) — why: no backend changes — cost if wrong: three facts not shown.
- **L964** Ruling: 6.1 r1/s4 — the passkey-only switch ("Password sign-in") sits under Password, as 11-12 draws it, not under the passkey list as in Classic — cost if wrong: one row's place.
- **L965** Ruling: 6.1 s4 — phone rows keep their action buttons below the text (Rename, Delete, Disable…, Turn off…). The board draws chevron rows to sub-pages, but only three routes are specified — why: no extra routes; D9c one sheet at a time — cost if wrong: a later redraw into sub-pages.
- **L966** Ruling: 6.1 11-11 — PasskeysPage is a section of Sign-in & security, not a route; TwoFactorSetup replaces the Security page in place (its back control cancels) — why: the brief's routes are `/you/security`, `/you/token` and `/you/password` only. Setup state lives in the page, so leaving the page drops the secrets — cost if wrong: a deep link to setup is not possible (and should not be: the secret is one-time).
- **L967** Ruling: 6.1 11-11 — a refused delete (LAST_PASSKEY) shows today's toast, and the ConfirmSheet stays open, as today's inline confirm did. The board's inline red box is not drawn — why: today's message and channel; no client-side block — cost if wrong: the message is in a toast over the sheet, not inside it.
- **L968** Ruling: 6.1 11-03 — the TOTP key is in a OneTimeReveal with Copy (the board and the dispatch), which today does not have; the QR stays an image beside it. One 6-digit field, not six boxes (today's input, with today's 6-digit hint as the step text) — cost if wrong: a new Copy; a visual difference.
- **L969** Ruling: 6.1 11-04/11-12 — the explain step is a ConfirmSheet (consequences = today's three bullets; confirm = "Continue with a passkey", busy "Waiting for passkey…", Cancel off while busy, Esc and backdrop ignored while busy). The DISABLE step is a ConfirmSheet with `confirmWord`, so the field is trimmed (ConfirmSheet's rule), where today's input needed an exact match. Either way the request sends exactly "DISABLE" — cost if wrong: " DISABLE " is accepted.
- **L970** Ruling: 6.1 11-12 — the recovery-codes sheet is `dismissible={false}` throughout, even after the tick. Today's modal regains its close button once ticked; Done is the only way out — cost if wrong: one less way to close after saving.
- **L971** Ruling: 6.1 11-06 — the forced change is today's flow: the shell shows it over every page (Classic's UserMenu does the same), now redrawn as a non-dismissible Sheet; `/you/password` draws the same form itself and the shell stays out. Today does not force it before the app renders — cost if wrong: none.
- **L972** Ruling: 6.1 11-05 — the token page is one column (reveal, Using it, Your token). The board's two columns and its curl example with the live prefix are not drawn; Using it keeps today's `Authorization: Bearer YOUR_TOKEN_HERE` line and description. "To replace it: Revoke, then Generate." is new copy (s11n3) — cost if wrong: a layout change.
- **L973** Ruling: 6.1 all — `Sheet` gained `dismissible`; `OneTimeReveal` gained optional title, intro, label, copy, done label and an optional Done; `ConfirmSheet`'s body got 20 px side padding, because every ConfirmSheet's text was flush with the sheet's edge — cost if wrong: the screenshots of earlier confirm boards shift 20 px.
- **L974** Ruling: 6.1 s1-you / WorkspaceShell / WorkspaceApp tests — Workspace tests edited: You's rows are now links to the new pages and today's preference categories; the `/preferences/*` sidebar is labelled "You"; `/you` shows the account head twice on desktop (page and sidebar) — cost if wrong: none.
- **L975** Ruling: 6.1 r2 — the r2-you-layout test now runs the full `expectBoard` (the sidebar is built) — cost if wrong: none.
- **L976** Ruling: 6.1 11-06 — "Show" is dropped from the 11-06 board check — why: today's PasswordField toggle is an icon button whose name ("Show password") is only an aria-label, so it is not in text content; the control exists, and D9b keeps today's control — cost if wrong: a text "Show" label on the toggle, a shared PasswordField change.
- **L977** Ruling: 6.1 r2 — r2's "Language & units" check became "Language" — why: the You sidebar lists today's preference categories with today's labels (D9b) until Task 6.3 builds the merged Language & units page. r1 and r2 still draw the merged row, and 6.3 owns that merge — cost if wrong: 6.3 relabels one row and restores the string.
- **L978** Ruling: 6.1 all — OneTimeReveal's code list left padding went from 36 to 44 px for every reveal, so a two-digit "10." number fits (M3, deferred; recorded here) — cost if wrong: 8 px.
- **L979** Ruling: 6.1 M4 — an uncopied API token survives two-factor setup ("keep", not "block"). The token state sits above the setup switch in SecurityPage and shows again when setup ends — why: 11-03 draws setup as a whole page with no blocked Enable; keeping matches the board — cost if wrong: the token stays in memory (not on screen) during setup.
- **L980** Ruling: 6.1 M5 — ConfirmSheet ignores Esc, the backdrop and the close button while `busy` for every consumer, not only the three in 6.1 — why: the root cause is in the shared pattern, and Cancel was already disabled while busy — cost if wrong: other confirms can no longer be dismissed mid-request (none needs to be).
- **L981** Ruling: 6.1 audit — removed the 20 px side padding of five ConfirmSheet body wrappers (WaypointSheet/LocalMarkerSheet `.form`, OverridePositionSheet `.form`, PurgeDataSheet `.purge`, MergeIdentitySheet `.merge`, CopyNodeInfoSheet `.copy`). ConfirmSheet's own padding now provides it — cost if wrong: those sheets' screenshots shift by the 8 px of bottom padding they lost.

#### Task 6.2 — sign-in pages

- **L985** Ruling: 6.2 GL — the reviewer's ⚠️ "screenshots not verified" is closed by a controller visual check of 11-01/02/07/08/09 against png3 after the TG.
- **L986** Ruling: 6.2 all — Rule X: the sign-in logic moved unchanged into `src/components/account/useSignIn.ts` (`useSignIn`, `passwordLoginErrorMessage`, `usePasskeySignIn`, `useRecoveryCodeSignIn`). The default mark moved into `components/MeshMonitorLogo.tsx`. LoginModal, LoginPage, PasskeyLoginButton and PasskeyRecoveryLink consume them with the same DOM, and their tests pass unedited — why: dispatch (behaviour equal to today's, step for step; one copy of the error mapping, not three) — cost if wrong: four Classic components now import hooks.
- **L987** Ruling: 6.2 all — the Workspace shell now waits for `/api/auth/status` before mounting (RouteLoading until then), so that a signed-out install with anonymous viewing off fires no shell queries — why: dispatch ("must not fire shell data queries before sign-in") — cost if wrong: every Workspace load waits one auth round trip before the shell's queries start (most of them already waited on auth).
- **L988** Ruling: 6.2 11-01/11-07 D9b — the check swaps "Sign in with OIDC"→"Login with OIDC", "MeshMonitor 4.15.2"→"Version", "Privacy policy"→"Privacy Policy", "Session expired"→"session has expired", "Wait 14 minutes"→"try again in 14 minute(s)", "no OIDC"→"OIDC is not configured", and (11-07) "Too many sign-in attempts"→"Too many login attempts". The buttons read today's "Login" / "Login with OIDC" (s11n0 states it) — cost if wrong: string edits.
- **L989** Ruling: 6.2 11-01 D9d — "COOKIE_SECURE" and "Learn more" were dropped from the check. That banner is AppBanners' (s11n3, "APP BANNER"), and today's LoginPage does not show it, since App returns LoginPage before its banners. The Workspace has no config-issue banner yet — cost if wrong: one banner on the sign-in page.
- **L990** Ruling: 6.2 11-01 — "Reload" is a new button (`workspace.auth.reload`) next to today's session-expired words, which calls `location.reload()`, as the board and s11n0 ("session expired → Reload") draw it. It shows whenever the error text equals `auth.session_expired`, so for a passkey CSRF failure too — cost if wrong: one button.
- **L991** Ruling: 6.2 11-01 — "Sign in to continue" (`workspace.auth.subtitle`) is new copy under the title on the desktop page. The phone page shows today's "Login" as its heading (the board's "Sign in", D9b) — cost if wrong: one string.
- **L992** Ruling: 6.2 11-02/11-08 — one code field, not six boxes (6.1's 11-03 ruling), with today's label, maxlength and inputmode. The check swaps "Two-factor"→"Two-Factor" and "Backup code"→"Backup Code" (Ruling I). The hint "8 characters" (`workspace.auth.backup_code_hint`) is new copy. The board's "Use authenticator code instead" and "Each works once" stay today's "Use authenticator code" and "Enter one of your backup codes." — cost if wrong: a visual difference and string edits.
- **L993** Ruling: 6.2 11-02 — Back uses today's LoginPage word "Back" (`common.back`) in both the page and the dialog, where LoginModal read "Back to login"; Verify's busy label is LoginModal's "Verifying..." in both — cost if wrong: two words in one surface.
- **L994** Ruling: 6.2 11-09 — the recovery code is a step of the card that replaces the password form, with today's Cancel (not the board's "Back to sign in"), where today's link expands the form below the password form. Entering the step clears the typed password and any error — why: the board draws a separate step; secrets are cleared when the step changes — cost if wrong: the password form is not visible beside the recovery form.
- **L995** Ruling: 6.2 11-09 — a recovery-code sign-in reloads, as today, and lands on 6.1's forced sheet over the page it reloaded at. There is no redirect to `/you/password`. The check swaps "New password"→"New Password", "Confirm new password"→"Confirm New Password" and "Change password"→"Change Password" (6.1's 11-06 swaps) — cost if wrong: none.
- **L996** Ruling: 6.2 all — one error slot at the top of the password step (11-07's placement), for every password-step error, including passkey and OIDC errors and the "local off, no OIDC" message. Today shows the error above Login, or above the OIDC button when local sign-in is off. The two-factor and recovery steps keep the error above their submit button — cost if wrong: error placement.
- **L997** Ruling: 6.2 dialog — the guest dialog is the shared Sheet (right-docked on desktop, bottom on phone), and its title follows the step (Login / Two-Factor Authentication / Sign in with a recovery code), as LoginModal's title did for MFA — cost if wrong: a centred dialog instead.
- **L998** Ruling: 6.2 all — the footer redraws `PrivacyLinks` from its hooks (`usePrivacyLinks`, `privacyLinkHref`, `isExternalPrivacyLink`, the same labels) instead of mounting the Classic component; the GitHub link gets a `code` UiIcon (board) and keeps today's "View on GitHub" — cost if wrong: two copies of a six-line list.
- **L999** Ruling: 6.2 e2e — `Board.init` (an init script before `goto`) was added, and the five sign-in boards use it to report no conditional-mediation support. Headless Chromium has no authenticator, so the autofill wait fails and shows today's passkey error over the board — cost if wrong: none (test-only).
- **L1000** Ruling: 6.2 tests — the gate's request allowlist includes SettingsProvider's reads (settings, themes, map styles, push and map preferences, the locale). They sit above the shell, as in Classic, and run on today's login page too — cost if wrong: a stricter gate would also hold SettingsProvider until sign-in.

#### Task 6.3 — preferences and help

- **L1004** Ruling: 6.3 GM — I3: Apply as Dark/Light goes back to today's local, unsaved context set — why: D9d and the dispatch ("applying a theme uses today's mechanism"); no new features — cost if wrong: the user loses an install-wide shortcut nobody asked for.
- **L1005** Ruling: 6.3 GN — promote M2 through M10 into round 1:
- **L1006** Ruling: 6.3 GO — M1: s13n2's news auto-open is spec. Build it in round 1 with the extracted unseenNewsItems helper: one news read on Workspace shell mount, the same request Classic makes; it opens once. No interval.
- **L1007** Ruling: 6.3 all — Rule X: ThemeEditor, CustomThemeManagement, TapbackEmojiSettings and the NewsPopup unseen filter were moved unchanged into `src/components/themes/*` and `NewsPopup/unseenNews.ts`. Classic consumes them, its DOM is identical and its tests pass unedited. — why: the dispatch allows hook extraction — cost if wrong: four Classic files now import hooks.
- **L1008** Ruling: 6.3 all — D9b check swaps (today's en.json labels):
- **L1009** Ruling: 6.3 13-01/13-03/13-04 — options keep today's long labels, for example "Celsius (°C)" and "Match system appearance". Segmented controls stay where today's labels fit (appearance mode, time, temperature, distance, icon style). Date format, direction, pin style and history line stay selects, and every select row is stacked (label above). — why: D9b; long options squeezed the label in the two-column layout — cost if wrong: short `workspace.*` option strings.
- **L1010** Ruling: 6.3 all — the scope line reads "Applies to everyone on this MeshMonitor · saves as you go", not the board's "Your preference". Map adds "the map style follows you". Without settings:write the rows are View only (CategoryPage's pill); Language and the tilesets stay open, as today they are per-browser and per-user. — why: dispatch (install-wide wording, no per-user storage) — cost if wrong: one string.
- **L1011** Ruling: 6.3 13-01 — "Apply as Dark / Light" saves the Dark / Light Theme setting (settings:write) instead of today's local-only context set. Both of today's Apply buttons show ("Dark Active" disabled), not the board's single button with "Applied as dark". — why: s13n1, everything on the page saves as you go, and a custom theme is the same choice as picking it in the Dark Theme list; today's local set was overwritten on the next load — cost if wrong: non-writers lose a per-browser preview.
- **L1012** Ruling: 6.3 13-01 — theme swatches use the role keys (bg, surface, text, accent). Today's card reads Catppuccin keys that role themes no longer have. The sub-line is the slug, not "Dark · custom". — why: no dark/light flag exists on a theme — cost if wrong: swatch choice.
- **L1013** Ruling: 6.3 13-01 — Default Landing Page stays an admin row on Appearance until 6.4 moves it to Server › General (s13n5). Theme lists are flat (today's optgroups dropped in the kit select). — cost if wrong: one row's place; group headers.
- **L1014** Ruling: 6.3 13-02 — the colour groups are today's role groups and labels (Backgrounds, Surfaces, Text, Lines, Accent, Status, optional Chat Bubble), not the board's Catppuccin set. Failures show inline instead of `alert()`. The slug field is read-only and previews the generated slug for a new theme. — why: D9d, today's editor — cost if wrong: none.
- **L1015** Ruling: 6.3 13-03 — the merged page shows the "Show link previews" switch with today's description. The board's extra "server, not your radio" note is not drawn, because today's description already says the fetch is server-side. — cost if wrong: one note.
- **L1016** Ruling: 6.3 13-04 — the admin-only parts of today's Map section (custom tilesets, GeoJSON, map styles, Carto key, default map centre, embed) stay re-hosted at `/server/map`, reached by an admin row on Map. 13-05/13-06 (Task 6.4) redraw them. The preview draws today's tileset only, with no node pins, at the zoom gate around the default map centre (else the world). — why: s13n0/s13n5 put them in Server › Map & tiles and Embed; nothing is lost — cost if wrong: one link row.
- **L1017** Ruling: 6.3 13-04 — saving a tileset writes the viewer's `user_map_preferences` (today's `setMapTilesets`, as the map's tileset picker does), plus the install key for settings writers, as global Settings' Save did. `theme` and `mapTileset` (the legacy effective keys today's Save also wrote) are not written: SettingsContext reads them only when the new keys are absent. — cost if wrong: a legacy key goes stale.
- **L1018** Ruling: 6.3 meshcore — MeshCore Messaging gets a kit page under `/preferences/meshcore-messaging` and a You row. s13n5 places it in Server › General, which 6.4 redraws, so 6.4 moves it then. It is not under Server now, because today a non-admin settings writer can reach it. — cost if wrong: one row and route move.
- **L1019** Ruling: 6.3 sorting/link-previews/units — `/preferences/units|sorting|link-previews` redirect to `/preferences/language`, keeping the hash. The You list has one "Language & units" row (13-03 sidebar). — why: dispatch — cost if wrong: none.
- **L1020** Ruling: 6.3 13-14 — System status shows today's nine rows (three memory rows, "platform (arch)", "type version"), not the board's merged lines, on both phone and desktop. Without dashboard:read it shows the no-permission state and asks nothing. Help links: "View Settings Documentation" (today's docs link title), "GitHub" (sidebar footer) with "Report a bug…", "Support on Ko-fi" (`source.sidebar.support`) with a "Ko-fi" button. News items are not clickable, because NewsPopup cannot open at a given item. "Show all news" is board copy (today's equivalent is the sidebar's "News" button). — cost if wrong: string and row tweaks.
- **L1021** Ruling: 6.3 13-14 — the note "New items open by themselves once" is not drawn. The Workspace never shows today's automatic news popup, so the sentence would be false. — cost if wrong: the auto-popup is a shell task (see concerns).
- **L1022** Ruling: 6.3 all — `WorkspaceApp`'s `SettingsProvider` gets `baseUrl={appBasename}`. — why: URL guessing broke every SettingsContext request on Workspace-only paths — cost if wrong: none.
- **L1023** Ruling: 6.3 GO — the auto-open reads today's `GET /api/news/unread` (the same request as Classic's App and Dashboard) and opens NewsPopup without `forceShowAll`, which applies `unseenNewsItems`. It does not read feed + status in the shell — why: "the same request Classic makes"; one read instead of two — cost if wrong: one helper call in the shell.
- **L1024** Ruling: 6.3 GO — re-hosted App and DashboardPage skip their unread-news check while embedded (ShellContext hook). Classic users are unaffected — why: the shell now owns it; otherwise a re-hosted route would pop a second popup — cost if wrong: two one-line guards.
- **L1025** Ruling: 6.3 s13n0 — Preferences rows are a static list (`PREF_FIELDS`) held to the pages by a test, because the registry knows only mounted rows — cost if wrong: a row added without its entry fails the test.
- **L1026** Ruling: 6.3 GM — after a local Apply, the Dark / Light Theme rows still show the install's stored value, while the theme list's "… Active" shows the applied one. Today's page re-seeded the select from context instead — why: the rows are the install setting; Apply is today's local preview — cost if wrong: the row reads context too.

#### Task 6.4 — server categories, part 1

- **L1032** Ruling: 6.4 GQ (provisional, for review): the two timers are today's, moved verbatim, and fire only during their operation. N bans new timers only.
- **L1033** Ruling: 6.4 GR (provisional): the writer-visible General and Map & tiles rows keep today's non-admin access ("nothing lost" beats s13n2's admin-only list, as in 6.3 I1). Restart follows today's single action (D9d).
- **L1034** Ruling: 6.4 GQ and GR confirmed by the reviewer.
- **L1035** Ruling: 6.4 GS — M3: the canvas notes are spec. Build the s13n5 placements:
- **L1036** Ruling: 6.4 GT — also promote:
- **L1037** Ruling: 6.4 all — Rule X: ChannelDatabaseSection, CustomTilesetManager, GeoJsonLayerManager, MapStyleManager and EmbedSettings logic moved verbatim into `useChannelDatabase`, `useCustomTilesetForm`, `useGeoJsonLayers`, `useMapStyles` and `useEmbedProfiles`. Classic keeps its `confirm()`/`alert()` and its DOM, and its tests pass unedited — why: one implementation for Classic, the admin page and the 6.3 non-admin path — cost if wrong: five Classic files import hooks.
- **L1038** Ruling: 6.4 all — Backup, maintenance, restart, Reticulum, the Apprise test and the MeshCore device import call today's endpoints with today's bodies and copy today's messages, without a hook extraction — why: a few requests each; the 2.2 resolution — cost if wrong: about 150 lines that could drift from Classic.
- **L1039** Ruling: 6.4 gates — the sidebar shows General and Map & tiles to settings writers too, not only admins as s13n2 lists. Those pages show such a user only today's writer rows (MeshCore Messaging and Reticulum; tile servers, GeoJSON and map styles) — why: "Keep each action's gate as today", 6.3 I1, and "the sidebar shows only what the user can open" — cost if wrong: two sidebar rows for non-admin writers.
- **L1040** Ruling: 6.4 13-16 — the list note is reworded: "Not an admin: Backup & maintenance for anyone with settings access; with settings:write also General, Map & tiles and Background jobs." The board's right-hand values are not drawn. — why: the gates ruling above; the values would cost 5+ extra reads on open (N/DM) — cost if wrong: one string and per-row reads.
- **L1041** Ruling: 6.4 b-set-d7 — the check drops the page strings CONNECTION, WHERE IT IS USED, Last test and the scope "Server · applies…". Its page is Notification services as 18-11 draws it — why: s13n0 ("sidebar only… its page is drawn in full on 18-11 / 18-12") — cost if wrong: four check strings.
- **L1042** Ruling: 6.4 18-11 — the check drops "http://localhost:8000", the input's placeholder, which is not text content. It is still the placeholder — cost if wrong: one string.
- **L1043** Ruling: 6.4 all — D9b check swaps to today's labels:
- **L1044** Ruling: 6.4 13-07 — today's restart is one action: Restart in Docker, otherwise Shut down (one endpoint, the server decides). The page draws that one row with today's words, not the board's two buttons. "Restart and Shut down are admins only" is in the scope line — why: D9d; a second button would be false — cost if wrong: none.
- **L1045** Ruling: 6.4 13-07 — Run now has no confirm, because today has none. Restore has no button (s13n4) — cost if wrong: one ConfirmSheet.
- **L1046** Ruling: 6.4 13-07 — backup schedule, maintenance schedule and retention save as you go (each row, today's endpoint), replacing today's SaveBar — why: s13n1, and the schedulers persist their last run, so no timer re-arms — cost if wrong: back to an inline Save.
- **L1047** Ruling: 6.4 13-24 — on phone the six retention rows sit inline under the heading, not on a deeper page (s13n7) — cost if wrong: one sub-page.
- **L1048** Ruling: 6.4 13-07 — non-admins see Create Backup Now disabled, with "Only an administrator can create, download or delete system backups.", and the list is not read. Today's button was enabled and failed with a toast — why: BP2 "gated item → disabled with reason"; the server gate is unchanged — cost if wrong: one string.
- **L1049** Ruling: 6.4 13-08 — the PSK field stays plain text with Generate, as today (no Show/hide). The list shows today's server-masked `pskPreview` — why: dispatch "keep today's masking/reveal" — cost if wrong: one toggle.
- **L1050** Ruling: 6.4 13-08 — the edit form's buttons are today's Cancel and Save (not "Save channel"). Decrypt lives in the row's ⋯ (s13n5), not in the form ("Decrypt history"). The form is in the right column on desktop and replaces the list on phone — cost if wrong: labels and placement.
- **L1051** Ruling: 6.4 13-08 — the retroactive progress card shows only while a run is pending or running, read through today's 1 s poll in today's hook — why: today's behaviour, moved verbatim — cost if wrong: one poll during a run.
- **L1052** Ruling: 6.4 13-08 — "Import from MeshCore device" is redrawn as a Workspace Sheet calling the same endpoint. MeshCoreChannelImport is untouched — cost if wrong: about 60 lines.
- **L1053** Ruling: 6.4 13-05 — today's form fields are kept (overlay colours select, description, autodetect) instead of the board's Overlay and TMS checkboxes, which have no backend. GeoJSON layers keep today's controls on a second line (public, no popup, opacity, fill, width), with ⋯ holding Delete — why: D9d; range inputs do not fit in a menu — cost if wrong: layout.
- **L1054** Ruling: 6.4 13-05 — Map & tiles' Keys and defaults carry "Admins only". The scope line says the page applies to everyone and needs settings:write — cost if wrong: one string.
- **L1055** Ruling: 6.4 13-06 — Preview is today's centre and zoom picker (click sets the centre, zoom sets the zoom) on BaseMap, without live nodes. Save profile covers both new and edit. Today's Create and Save labels are not used — cost if wrong: one label; live nodes need the embed data route.
- **L1056** Ruling: 6.4 18-11 — Notification services is two columns on desktop and one on phone. The VAPID row left device Settings › Notifications (s18n6). The admin "Send test notification" stays there, because it pushes to this browser — cost if wrong: one row's place.
- **L1057** Ruling: 6.4 r4 — GeneralLayoutCard loses its own page wrapper and h1, which GeneralPage's frame now draws. "Landing page" is a new group heading — cost if wrong: none.
- **L1058** Ruling: 6.4 search — General's rows are a static list (`SERVER_FIELDS`), held to the page by a test, like `PREF_FIELDS`. A Server section hit resolves `SERVER_ALIASES` directly — cost if wrong: a row added without its entry fails the test.
- **L1059** Ruling: 6.4 all — 6.3's theme ⋯ menu became the shared `patterns/RowMenu`, used by the theme list, GeoJSON, map styles, channel keys and embed profiles — cost if wrong: none (6.3's tests pass).
- **L1060** Ruling: 6.4 13-05 — the GeoJSON row switch is Public (the board's Public / Signed-in), and today's Visible moved into ⋯ as a checkbox with Disable click popup. Colour, opacity, fill and width are in a "Colour and style" sheet opened from ⋯, because inputs do not fit in a menu — why: GS / s13n5; nothing lost — cost if wrong: one control's place.
- **L1061** Ruling: 6.4 13-05 — Test URL tests a tile template as today. For anything else it runs today's Autodetect on the typed address. It does not pick a result by itself: Use picks one, then it is tested. — why: GS "today's two endpoints in today's order", with no new automatic choice — cost if wrong: auto-picking the first result.
- **L1062** Ruling: 6.4 all — RowMenu follows ⋯ on scroll and resize rather than closing — why: a scroll that lands right after the open, such as a click scrolling the row into view, closed the menu — cost if wrong: none.

#### Task 6.5 — server categories, part 2

- **L1066** Ruling: 6.5 GU — I1: keep that row editable for writers, matching the server, and correct the report/file-header claim. I2: invalidate MW_KEY, and add a test.
- **L1067** Ruling: 6.5 GV — promote M1, M6, M7 and M8.
- **L1068** Ruling: 6.5 GW — the kit toggle renders as a native checkbox where the boards draw a switch. This is a pre-existing kit defect from Phase 5 and affects every settings page.
- **L1069** Ruling: 6.5 all — Rule X: ScriptsSection, ScriptDependenciesPanel, PrivacyDocumentsSection and TranslationConfigSection's Test logic moved verbatim into `useScriptsInventory`, `useScriptDependencies`, `usePrivacyDocuments` and `useTranslationTest`. The test hook adds `sample` to its success result, which Classic ignores. Classic DOM and tests are unchanged — why: one implementation for Classic and Server pages — cost if wrong: four Classic files import hooks.
- **L1070** Ruling: 6.5 all — Position estimation, auto-enrichment, mesh issues, MeshWars, solar, coverage and the toggles save as you go, one key or today's key group per row, replacing today's SaveBar. Switching to cron sends the cron with the type, so the server's cron check passes as in today's single body. The rule mutes send today's CSV and legacy B7 pair — why: s13n1; the schedulers persist their last run, so no timer re-arms — cost if wrong: back to a group Save.
- **L1071** Ruling: 6.5 13-10 — Background jobs is two columns, not three. Desktop: Position estimation, Coverage and Solar on the left; Auto-enrichment and Mesh issues on the right. The phone order is as 13-26 — why: today's labels and help do not fit a third column at 1280 px — cost if wrong: layout only.
- **L1072** Ruling: 6.5 13-10 — (corrected in fix round 1) For a non-admin settings writer, every row on Background jobs is view only except Router cluster max link, with a note. The other 33 keys are in GLOBAL_ONLY_SETTINGS_KEYS, so the server dropped a non-admin's save silently. `mesh_issues_router_cluster_max_link_km` is in neither GLOBAL_ONLY nor ADMIN_ONLY, a writer's save reaches it today, and so it stays editable. Run analysis now (settings:write) and Fetch Estimates Now stay; Recalculate now and Run now are disabled with today's title — why: nothing lost, and no silent no-op — cost if wrong: a writer sees disabled rows.
- **L1073** Ruling: 6.5 13-10 — Mesh issues "Run analysis now" keeps today's settings:write, not s13n2's "admins only" — why: nothing lost beats the admin-only list — cost if wrong: one gate.
- **L1074** Ruling: 6.5 13-12 — (superseded in fix round 1, GV M6) Security & privacy opens to everyone with settings access (gate `read`) and shows a non-admin only the hosted documents: writers edit them, readers view them read only, as today.
- **L1075** Ruling: 6.5 13-12 — Default Meshtastic source is a link row to Server › General, where 6.4 (r4, Option A) saves it. It is not a second control — why: one save path — cost if wrong: one hop.
- **L1076** Ruling: 6.5 13-12 — Analytics is its own page (s13n0). Its Save writes provider and config together, as today; today has no Test, so none is added — cost if wrong: none.
- **L1077** Ruling: 6.5 13-12 — Unpublish (a hosted document) has no confirm, as today. It sits in the row ⋯ — why: D9d — cost if wrong: one ConfirmSheet.
- **L1078** Ruling: 6.5 13-11 — Translation Test shows today's unused `settings.translation_test_success` ("Translation service connected successfully!") followed by "Sample translation: …" in place of today's "Success! Sample translation" — why: D9b / the board string — cost if wrong: one line.
- **L1079** Ruling: 6.5 13-11 — Translation, elevation and ADS-B saves invalidate every `['settings', …]` query, as today's Save did, so `useTranslationSettings`, `useElevationEnabled`, `useDuctingForecast` and `useFlightMatch` see the change — cost if wrong: an extra re-read per save.
- **L1080** Ruling: 6.5 13-09 — Today's English-only Scripts copy gets `workspace.server.*` keys with today's words. The card's "Used by" list is today's `describeRef` text, which is English-only in Classic — cost if wrong: one untranslated list.
- **L1081** Ruling: 6.5 all — The board checks swap to today's labels (D9b):
- **L1082** Ruling: 6.5 13-12 — The 13-12 check's "Analytics" is met by the sidebar row, because the Analytics half is its own page (s13n0) — cost if wrong: one check string.
- **L1083** Ruling: 6.5 devices — `/server/devices` (and the rail's `?add=1`) renders today's source list (OverviewRehost, DashboardPage), where devices are added, edited, reordered and removed today, until Task 6.6 draws Devices. Today it rendered the whole global Settings page, which has no Devices section — why: the narrowest piece that still works, without re-opening the dual save path — cost if wrong: one route until 6.6.
- **L1084** Ruling: 6.5 search — Settings search finds these five categories as today's sections (configSections plus `SERVER_ALIASES`). Their rows are not added to `SERVER_FIELDS`, which stays General's moved rows — why: today's palette is section-level, and the rows register when mounted — cost if wrong: a row-name search hits the section, not the row.
- **L1085** Ruling: 6.5 13-26 / 13-27 — On phone, Solar, ADS-B, Elevation and MeshWars are pages of their own (`/server/background-jobs/solar`, `/server/integrations/:service`), and the disclosure URL rows open a sheet with Save (s13n7) — cost if wrong: four sub-routes.
- **L1086** Ruling: 6.5 13-10 — GU: `mesh_issues_router_cluster_max_link_km` stays editable for a non-admin settings writer, because a writer's save reaches it today. Every other row stays view only. A test holds the split to the server's key lists, since the frontend does not import the server-only constants — cost if wrong: one row.
- **L1087** Ruling: 6.5 13-12 — GV M6: Security & privacy is gated on settings:read. A non-admin sees the hosted documents only: writers edit them, readers view them read only, as today. A reader's desktop `/server` now opens Security & privacy, the first category in s13n0's order they can open — cost if wrong: one sidebar row and the reader's landing page.
- **L1088** Ruling: 6.5 13-11 — GV M7: Integrations is gated on settings:write. A non-admin writer sees Virtual Node replay view only, because the server keeps its keys for admins. Settings readers also saw it on today's page; they are not given Integrations, per GV's wording — cost if wrong: one read-only group for readers.
- **L1089** Ruling: 6.5 13-11 — GU: MeshWars Save re-reads `/api/settings/meshwars/status`, as today's Save did — cost if wrong: none.

#### Task K1 — settings kit switch (controller task, Ruling GW)

- **L1098** Ruling: K1 GX — promote two minors: NotificationsPage.module.css:38's own native-checkbox switch moves onto the kit or the same style (same defect, GW), and the Space test also covers toggle-off. The phone hit-area overlap and the reduced-motion guard are deferred minors.
- **L1099** Ruling: K1 — reused the GeneralLayoutCard switch and applied the 0.15s transition without a reduced-motion guard — why: house pattern already does so — cost if wrong: motion-sensitive users see a 150 ms slide.

#### Task 6.6 — Add device flow and Server › Devices

- **L1103** Ruling: 6.6 GY — accept the implementer's useSourceForm interface (`useSourceForm(sources)`, `startAdd()` / `startEdit(id)`, no `fieldsetsFor`, `submit()` → `DashboardSource | null`). Nothing downstream codes against the brief's signature; 6.7's dispatch will name the real one. — cost if wrong: a wrapper.
- **L1104** Ruling: 6.6 GZ — promote M1 (hostOf must never show userinfo on a parse failure; the fixture carries user:pass@), M2 (no duplicate Back on a failed result), M3 (failed result shows the admin status `lastError` as secondary text; the first row must not say "Reached" when the host was not reached), M4 (phone Add device ≥44 px), M5 (test comment saying Edit's `enabled: true` is today's body on purpose; FINAL REPORT ITEM: Classic and Workspace Edit re-enable a disabled source), M6 (fill the edit form before the first render, drop the exhaustive-deps disable), plus the ⚠️ CR check (Escape in a nested finder closes only it; a test if nested). M7 (file splits) and M8 (Passive Mode in both steps) deferred to F.1 triage.
- **L1105** Ruling: 6.6 HA — controller visual check of h2 and h4 against png3: layout, copy and the row anatomy match. Minor (deferred): h2 draws Host / IP and TCP Port 50/50, but the board has a narrow port column; h4 row menus use a vertical kebab (the shared RowMenu trigger), but the board's is horizontal.
- **L1106** Ruling: 6.6 all — `useSourceForm(sources)` takes today's source list (for edit fill, bridge base, broker lists and the masked-field reads), not `initial?: DashboardSource`. `startAdd()` / `startEdit(id)` replace `initial`, and `fieldsetsFor(type)` is not added: the steps render today's per-type fields directly, so nothing would call it. `submit()` resolves to the saved source or `null`. — why: DashboardPage fills one hook instance per modal open, and the Workspace flow edits by id — cost if wrong: a ~10-line `fieldsetsFor` map and an `initial` wrapper.
- **L1107** Ruling: 6.6 all — after a successful add, the hook keeps editing the new source, so Edit connection → Save is a PUT of the same device. Classic resets the hook on every open, so nothing changes there. — why: the flow's Edit connection after a failed connect must not create a second device — cost if wrong: duplicate sources from the flow.
- **L1108** Ruling: 6.6 h2/h3/i3 — D9b: "Host or IP address" → today's "Host / IP" (`source.form.host`); "Port" is covered by today's "TCP Port"; "Connect automatically when MeshMonitor starts" / "Connect automatically" → today's "Automatically connect on startup" (`source.form.auto_connect`). The board checks were swapped. — why: an en.json string labels the same control — cost if wrong: string edits.
- **L1109** Ruling: 6.6 h3 — "CONNECTING" → "Connecting" in the check (CSS-uppercased; Ruling Q precedent). — cost if wrong: a style-aware matcher.
- **L1110** Ruling: 6.6 h4 — "Offline since 14:02" → today's status word ("Connecting" for an enabled, unconnected, auto-connecting source; `getStatusInfo`). No "since" time exists in today's status. — why: D9d — cost if wrong: a server field.
- **L1111** Ruling: 6.6 i2 — "Advanced · baud rate, heartbeat" → "Advanced · heartbeat, virtual node": today's form has no baud rate; its advanced fields are heartbeat and the virtual node. The check was swapped. — why: D9d, no new setting — cost if wrong: one string.
- **L1112** Ruling: 6.6 i2 — the serial port is a text field with today's help, not a list of found ports: no endpoint lists the server's serial ports today. — why: backend unchanged — cost if wrong: a new route.
- **L1113** Ruling: 6.6 i2 — i2's labels (Connected by, USB on the server, Network, Serial port, Firmware) are the board's: today's equivalents ("Transport", "USB / Serial", "TCP", "Serial Port", "Device Type") exist only as `t()` defaults, not in en.json, so D9b does not apply. — cost if wrong: string edits.
- **L1114** Ruling: 6.6 18-09/18-10 — the checks drop "/rns", "amsterdam.connect.reticulum.network" and "4965": they are input values, which textContent cannot see (Ruling 3.1 precedent). The tests assert those values on the fields instead. — cost if wrong: a value-aware matcher.
- **L1115** Ruling: 6.6 h1/i1 — the type cards use the board's titles and descriptions (`workspace.devices.type.*`), not today's one-line select options ("Meshtastic (TCP)", "Embedded MQTT Broker (devices connect here)"…): the board splits each option into a title and a description. "Add source" is absent per the board check. — cost if wrong: string edits.
- **L1116** Ruling: 6.6 h3 — no Square colour picker: a device's colour is its position in the list (`useWorkspaceSources`) and nothing stores a choice. The name help says where the name shows, not "From the node's long name": the node is not read before Save. — why: backend unchanged — cost if wrong: a stored colour setting.
- **L1117** Ruling: 6.6 h3 — a Meshtastic node's passive mode is in step 2's Advanced (h2) and again in step 3's Advanced (h3), both bound to the same state, because both boards' labels name it. — cost if wrong: drop one.
- **L1118** Ruling: 6.6 h3/i3 — the result reads the status once after Save. The server's add awaits the first connect attempt, so "not connected" then means the attempt failed (today's manager keeps retrying in the background). Later changes arrive through the rail's existing 15 s poll of the same query key. "timed out, 10 s" is not drawn: no duration exists. — why: no polling in today's add flow — cost if wrong: a slow-starting MQTT / MeshCore source can show Couldn't connect until the next poll or Try again.
- **L1119** Ruling: 6.6 i3 — Try again is today's Connect (`connectSourceAndWait`, the `onConnectSource` loop moved verbatim) with an abort on close. It is hidden for an MQTT broker, whose `/connect` answers 400 today. With auto-connect off, the result says today's "Idle (manual)" with `source.connect_help`, and the button reads today's "Connect". — cost if wrong: a broker that fails to listen has only Edit / Save anyway.
- **L1120** Ruling: 6.6 h1 — "Admins only · every field stays editable in Server › Devices": the board's "in the device's settings" names a Connection card that does not exist yet (h5); Edit lives on Devices. — cost if wrong: one string.
- **L1121** Ruling: 6.6 all — "Edit device" titles the edit flow, not today's "Edit Source", matching the "Add device" the board requires over "Add Source". — cost if wrong: one string.
- **L1122** Ruling: 6.6 h4 — Disable asks first (ConfirmSheet titled with today's "Disable", new body copy), per the dispatch; enabling is immediate as today. Today's 400 ms debounce of the list refetch after a toggle is not kept (the refetch is immediate; the PUT count is unchanged). — why: one PUT per confirmed change, no new timer — cost if wrong: one extra list read per toggle.
- **L1123** Ruling: 6.6 h4 — the Prune result is a toast with today's words, not today's result modal. — why: one layer at a time (D9c) — cost if wrong: a second sheet.
- **L1124** Ruling: 6.6 h4 — Resync confirms with a SendsLine in today's words (today has no confirm). — why: dispatch, mesh checklist — cost if wrong: one click more.
- **L1125** Ruling: 6.6 h4 — Primary is today's `defaultMeshtasticSourceId`, else the first enabled Meshtastic node in list order ("Automatic (first started)"). The server's real automatic choice is not exposed. — cost if wrong: a wrong chip in Automatic mode.
- **L1126** Ruling: 6.6 h4 — Devices reads the list and statuses through `useDashboardSources` / `useWorkspaceSources`, the rail's queries and keys. Each observer brings today's 15 s `refetchInterval`, so while Devices is open those queries can refetch twice per interval. The precedent is OverviewMap and GeneralLayoutCard; no new endpoint. — cost if wrong: one extra list / status read per 15 s while the page is open; fix with a cache-only read.
- **L1127** Ruling: 6.6 h4 — the FWD pill, mark-all-DMs-read, the unread badge, the node counts and the News button stay on today's source card. They are not source actions in this task's list. — cost if wrong: a follow-up row extra.
- **L1128** Ruling: 6.6 all — the per-bridge topic rewrites (today: edit an existing broker) are not drawn in the Workspace flow. The hook still carries them, so Classic and its PUTs are unchanged, and a Workspace edit of a broker leaves the rewrites unchanged (no PUT). — cost if wrong: a rewrites card on the broker's Edit.
- **L1129** Ruling: 6.6 all — no "Square" (colour) and no h5 Connection card (ds6 "tapping a status line opens its Connection card"); h5 is another board. — cost if wrong: follow-up.
- **L1130** Ruling: 6.6 i3 (fix 1) — the board check drops "Reached". A failed result's first row is the endpoint with today's status word (`getStatusInfo`), and the manager's `lastError` sits under the reason. The board's "Reached … timed out, 10 s" claims a reach and a duration that today's status cannot give. — cost if wrong: one string, if a server field for the attempt is added.
- **L1131** Ruling: 6.6 h4 (fix 1) — on phone, Add device sits above the device list, full width at 44 px: the phone page bar has no head actions (YouPageFrame). — cost if wrong: move it into the bar.
- **L1132** Ruling: 6.6 all (fix 1) — `useSourceForm(sources, editId?)`: `editId` fills the initial state, so an edit renders filled from the first frame. This is the brief's `initial?` by id. — cost if wrong: none for Classic, which passes no id.
- **L1133** Ruling: 6.6 all (fix 1) — the flow's Escape yields to any later `aria-modal` dialog. This covers today's `common/Modal`, which renders in place with its own document listener. — cost if wrong: a nested dialog without `aria-modal` would let Escape close the flow too.

#### Task 6.7 — Device states and Connection card

- **L1137** Ruling: 6.7 HB — promote M1 (one in-flight connect per source, shared by the card and the Devices row), M2 (the connect-help condition must not compare translated text), M3 (offline banner copy must not say sending pauses on a receive-only source), M4 (h6 non-admin test waits for a real element, not 50 ms), M5 (guest Login test asserts 6.2's phone card; rename the stale "You tab" test), M6 (first-run guide link ≥44 px on phone), M7 (verify the shell cannot render before auth status loads; a test if it can), plus the ⚠️: message-row send actions take the same composerGate.
- **L1138** Ruling: 6.7 HC — the phone device header keeps the board's height (64 px, or what it was before d006ce7). The switcher stays the square plus name (the square is 44 px). The status line is its own button, at least 24 px tall (WCAG 2.5.8 minimum), with its hit area padded down to the header's bottom edge where it can be, and no overlap with the switcher. This is an exception to the ≥44 px phone-target rule for this one secondary control. — why: every phone board draws the header at that height, and the switcher keeps a 44 px target — cost if wrong: one control below 44 px (FINAL REPORT ITEM); the alternative is a 96 px header on every phone device screen.
- **L1139** Ruling: 6.7 h5/i4 — the "Last 24 hours" up/down bar is not drawn. Today's API keeps no connection history or uptime for a source (`GET /api/sources/:id/status` and `GET /api/connection` give only the current state), and no client-side history was invented. The board checks drop "Last 24 hours". FINAL REPORT ITEM: a source connection-history field or route is needed to draw it — why: dispatch (no backend change) — cost if wrong: one server field and a bar.
- **L1140** Ruling: 6.7 h5/i4 — "Offline since 14:02" / "(2 h 13 min)" / "Offline for 2 h 13 min" are replaced by today's words. The header uses "Disconnected" (statusLabel, as 1.7 / 6.6). The card uses `getStatusInfo` ("Connecting" for an auto-retrying source, as Server › Devices). Today's status reply has no time to say "since" from. FINAL REPORT ITEM: the same server field — why: D9d — cost if wrong: string swap, plus a field.
- **L1141** Ruling: 6.7 h5 — "Last error: … Retrying every 30 s, next in 12 s." becomes "Last error: <lastError>", shown only when the status reply carries `lastError` (today: MQTT bridge, MeshCore MQTT). No retry interval or next-attempt time is exposed. The h5 check drops "Last error: connection refused." and a behaviour test covers the line — cost if wrong: one server field.
- **L1142** Ruling: 6.7 h5/i4 — "Retry now" and "Disconnect" show only where today offers them. Connect / Retry appear for a manual or stopped source (admins, the source card), or after a user disconnect (`connection:write`, System status). Disconnect appears on a connected Meshtastic node (`connection:write`) or a connected manual source (admins). The boards' device auto-retries, and for it today offers neither: `/connect` is a no-op on a registered Meshtastic manager, and `userReconnect` expects the UserDisconnected state. The checks drop "Retry now" and "Disconnect", and behaviour tests cover all four paths. Labels are today's ("Connect", "Retry", "Disconnect") — why: D9d — cost if wrong: a server "retry now" for a retrying manager.
- **L1143** Ruling: 6.7 all — Disconnect has no confirm, because today's System status and source card ask none (dispatch: "otherwise follow today") — cost if wrong: one ConfirmSheet.
- **L1144** Ruling: 6.7 h5/i4 — the card is the shared Sheet (docked on the right on desktop, a bottom sheet on the phone), not a popover anchored to the header. This follows the 6.2 dialog precedent: one layer, Escape closes only it — cost if wrong: a popover variant.
- **L1145** Ruling: 6.7 h5 — the banner's "Retry" button is a "Connection" button that opens the card, since a retry exists only in the cases above. The banner text is "<device> is offline. History stays here; …", with no time — cost if wrong: one string, plus a button that may do nothing.
- **L1146** Ruling: 6.7 h5 — the offline composer is today's Composer with `disabledReason`, the same pattern as TX disabled. Its placeholder is unchanged, and the reason is the tooltip and the note under the box. The board draws the reason as the placeholder — cost if wrong: a placeholder override prop.
- **L1147** Ruling: 6.7 h5 — the composer gate shows the turned-off composer only for status `offline`. While no status has arrived (`connecting`), the composer stays hidden as before, so a page load does not flash "paused" — cost if wrong: none.
- **L1148** Ruling: 6.7 i4 HC — the phone device header keeps the boards' 64 px. The square and the name are the switcher button: its target includes the 44 px square, which hangs from the 24 px name row. The status line is its own button under the name, running down to the header's bottom edge, 30 px tall: at least 24 px (WCAG 2.5.8), and starting right of the square and below the name, so the two never share a hit area. It opens the Connection card. This is an exception to the 44 px phone-target rule for this one secondary control. FINAL REPORT ITEM — why: the 96 px header of d006ce7 pushed every phone device screen ~23 px below the boards (controller, Ruling 6.7 HC) — cost if wrong: a 30 px target where the rule asks 44 px.
- **L1149** Ruling: 6.7 i4 — the banner is on phone Home, in channel threads and in DMs; MeshCore and Reticulum (re-hosted) pages have none — cost if wrong: Phase 7 adds it.
- **L1150** Ruling: 6.7 i5 D9b — the one line is today's `tx_disabled.no_local_radio_tooltip` ("This MQTT source has no radio of its own, so it cannot send. Open a Meshtastic source to send.") with the board's "Switch" (`workspace.chat.switch`). The check swaps "so it can’t send. Reply from a device with a radio." → "no radio of its own, so it cannot send." and "only listens to gateways" → "Open a Meshtastic source to send." — cost if wrong: string edits.
- **L1151** Ruling: 6.7 i5 — "Heard by N gateways" becomes today's row text "heard via Athens MQTT" (MessageRowD; per-gateway counts are not in the row). The absent "Message" becomes "Sends 1 message", because each row carries a screen-reader "Message actions" label and the board meant "no composer" — cost if wrong: a reception-count line in the row.
- **L1152** Ruling: 6.7 i5 — on an MQTT channel the header subtitle is the device name plus the "Receive-only" chip (`workspace.switcher.receive_only`), in place of role and heard-today, as the board draws it. Only channels get the one line; an MQTT DM keeps the 10-05 / 10-14 card. 10-05's channel test now expects the link "Switch" — cost if wrong: one subtitle.
- **L1153** Ruling: 6.7 i5 — Switch goes to the same channel on the first enabled Meshtastic TCP device (today's `openOn` rule) and is hidden when there is none — cost if wrong: open the switcher instead.
- **L1154** Ruling: 6.7 i6 D9b — the "Sign in" tab reads today's "Login" (`auth.login`, as 6.2). "Sign in" in the check is still met by the guest note. The check swaps "CHANNELS" → "Channels" (CSS case, Ruling Q) and "You’re" → "You're" (today's `workspace.chat.guest_note`) — cost if wrong: string edits.
- **L1155** Ruling: 6.7 i6 — a guest's tab bar is Home + Login, with no DMs, Activity or You. A guest reaches You › Help & about only by URL on the phone — why: the board — cost if wrong: one tab.
- **L1156** Ruling: 6.7 i6 — guest tiles add Dashboard, gated by today's `dashboard:read`. Automation and Tools keep today's gates, and Tools (info) is always visible today, so a guest sees Tools where the board does not. Jump to… shows where today's search gate allows it. Signed-in tiles are unchanged (c-home-e1) — why: today's permission checks — cost if wrong: hide Tools for guests.
- **L1157** Ruling: 6.7 h6 — first run is admin-only. It applies when the source list is empty (disabled sources count) and only on `/`, `/overview` and `/overview/map`. A non-admin with no sources gets today's page. "Restore a backup" → `/server/backup`. The guide → `https://meshmonitor.org/getting-started`. The type list is static and leads nowhere — why: no second add flow — cost if wrong: a type preselect in AddDeviceFlow.
- **L1158** Ruling: 6.7 h4 — a Server › Devices row's status line is now a button that opens its Connection card (ds6), and keeps the `lastError` tooltip. `?edit=<id>` opens the edit flow (Edit connection's target); closing it clears the param — cost if wrong: none.
- **L1159** Ruling: 6.7 all — `sourceControls` (deviceInfo.ts) is DevicesPage's Connect/Disconnect rule, moved unchanged so the row and the card cannot drift apart — cost if wrong: none.
- **L1160** Ruling: 6.7 h5 (fix 1) — a listen-only device (receive-only, MQTT broker or bridge) gets "<name> is offline. History stays here." (new copy). The board's "sending is paused" would contradict the receive-only line under it — cost if wrong: one string.
- **L1161** Ruling: 6.7 all (fix 1) — `connectSourceAndWait` dedupes per source in memory, for this tab only (not across tabs or users). The server still accepts concurrent `/connect` calls, as today — cost if wrong: none on the mesh; a second tab can still send one more POST.
- **L1162** Ruling: 6.7 all (fix 1) — while offline, a message row's send actions show the composer's "Sending is paused while <device> is offline" in place of "Disconnected", and the offline reason now outranks the TX-disabled tooltip, since both come from composerGate. When connected, nothing changes — cost if wrong: one tooltip string.

#### Task 7.1 — MeshCore shell, channels and rooms

- **L1209** Ruling: 7.1 HD — the sidebar's second instance of today's 15 s unread poll on re-hosted MeshCore views is accepted. It is HTTP only and adds no new cadence. Phase 7's native views retire the re-hosted copy view by view. — cost if wrong: one extra unread read per 15 s per re-hosted view.
- **L1210** Ruling: 7.1 HE — promote M1 (row ⋯ "Node details" via senderKey, so nothing is lost), M3 (phone viewer without connection:read keeps the header and switcher), M4 (clear roomSessions when the signed-in user changes; the "Log out" label must not suggest the radio logs out unless the board draws exactly that), M5 (a real re-render test; Enter in the flood and resend confirms sends nothing), M6 (room rows keep today's distance) and M7 (the dmContact hand-off works when the same DM is clicked again).
- **L1211** Ruling: 7.1 all — native: channel (`channel/<idx>`), room (`room/<key>`), phone bare URL (Home); everything else re-hosted as before, including the `channels`/`rooms`/`dms` list views — why: the boards draw these three; the list views still work and keep today's two-pane UI — cost if wrong: the list URLs show Classic's lists until a later task.
- **L1212** Ruling: 7.1 DM — DM rows open today's re-hosted DM (Node Details) view on that contact (`dmContact` → today's `pendingDmContact` hand-off) — why: no 7.1 board draws a MeshCore DM thread, and today's DM view carries the contact pane, ignore/block, Show on map and the security draft, which a native thread would have to re-create — cost if wrong: a later task builds the native DM thread.
- **L1213** Ruling: 7.1 8-01/8-04/8-18 — byte counter is today's "0/143" (channel budget from the node name) and "0/160" (room/DM), not "/ 127 bytes"; must lists edited to "/143" / "/160" — why: today's limits and format win (D9b/D9d) — cost if wrong: a must string.
- **L1214** Ruling: 7.1 8-01 — "Jump to Bottom" (today's string) — why: D9b — cost if wrong: case.
- **L1215** Ruling: 7.1 8-01/8-04/8-18 — Mute is today's bell (MuteMenu, accessible name "Mute notifications"), icon-only as in the Meshtastic thread; "Mute" removed from the must lists — why: today's control and the Workspace's channel header — cost if wrong: one visible word.
- **L1216** Ruling: 7.1 8-02/8-24 — title "Message Route" (today's) — why: D9b — cost if wrong: case.
- **L1217** Ruling: 7.1 8-02/8-24 — Route details only for a received message with a route path; no "Heard by" section and no timestamped reception list in it; "Packet flow" is today's flow map (when every hop is positioned) — why: today stores no per-reception log for a received message and no heard-by for it — cost if wrong: two board sections.
- **L1218** Ruling: 7.1 8-01 — heard-by box on our own channel sends only; a received message shows hops (and SNR only when direct), scope and Route details — why: today's data (self-echo heard-by; SNR describes the last hop) — cost if wrong: received messages lack the box.
- **L1219** Ruling: 7.1 8-01 — the required-repeater note uses today's "Heard by N repeater(s), but the required repeater (X) has not relayed this yet" — why: D9b — cost if wrong: copy.
- **L1220** Ruling: 7.1 8-01 — older history loads from a "Load older" button (today: on scrolling to the top) — why: the board draws the button; same request — cost if wrong: one extra click.
- **L1221** Ruling: 7.1 8-01/8-16 — sidebar unread is a dot (bold row + dot), not a count — why: today's endpoints give the newest time per channel/room, not unread counts — cost if wrong: numbers missing.
- **L1222** Ruling: 7.1 8-16 — section headings are "Channels", "Rooms", "Direct messages", uppercased by CSS; must lists edited — why: textContent is not text-transformed — cost if wrong: none.
- **L1223** Ruling: 7.1 8-03 — Login and Log in with saved password both drawn; Login is off while a password is saved and the field is empty — why: today's single button logs in with the saved password then; the board draws two — cost if wrong: none (same behaviour set).
- **L1224** Ruling: 7.1 8-03 — the refused-login hint shows while an attempt waits and after no reply (today: after no reply) — why: the board draws it during attempt 2; static text, sends nothing — cost if wrong: an early hint.
- **L1225** Ruling: 7.1 8-03 — Auto-sync offers today's 1/2/4/8/12/24 h choices; a stored other value (the fixture's 6 h) is shown and kept; Save appears when changed (today); the board's "If the password is refused, auto-sync turns itself off" is not added (today's warning text) — why: today's setting, scheduler and clamp unchanged — cost if wrong: a 6 h choice.
- **L1226** Ruling: 7.1 room-logout — Log out forgets this browser's login to the room (MeshMonitor only, sends nothing); room logins are kept in memory for the session across Workspace navigation (today: until leaving the Rooms view) — why: today has no room logout and the board draws one; nothing on the mesh — cost if wrong: a control with no radio effect.
- **L1227** Ruling: 7.1 8-04/8-18 — "Post to Athens Room" is the composer's placeholder; asserted with `getByPlaceholderText` and removed from the must lists — why: a placeholder is not text content — cost if wrong: none.
- **L1228** Ruling: 7.1 8-04 — Rooms ⋯ always lists Mark all as Read, off when nothing is unread (today hides it); the menu adds Reorder… for Custom — why: board; today's drag reorder — cost if wrong: one disabled item.
- **L1229** Ruling: 7.1 all — More tools… holds Info and Packet Monitor (board) plus Device Configuration, Notifications and Security; the gear opens today's Settings tab — why: GR, those tabs have no other entry until 7.x builds the settings list — cost if wrong: three extra items.
- **L1230** Ruling: 7.1 all — sidebar data from today's requests without a socket (channels/all, contacts, dm-peers, rooms/credentials, push/preferences) plus today's `useMeshCoreUnread` 15 s poll; the native screen pushes its live contacts into the sidebar's cache; while a re-hosted view is open MeshCorePage runs the same poll too — why: one useMeshCore per screen (no double sounds/sockets) — cost if wrong: duplicate HTTP polling on re-hosted views, lists refresh on reconnect/poll rather than per push.
- **L1231** Ruling: 7.1 all — DM unread in the sidebar compares dm-peers' newest message time with the DM mark (today's dot used the live pool's received messages) — why: no pool in the sidebar — cost if wrong: a dot for a thread whose newest message is ours until it is opened.
- **L1232** Ruling: 7.1 all — `useReadStateSync` returns `ready`; native screens wait for the user's server marks before pinning the unread line — why: the Workspace opens straight on a conversation, before today's hydrate finished — cost if wrong: a brief loader.
- **L1233** Ruling: 7.1 8-01 — region discovery runs on the first open of the Scope menu (today: opening the override), with a Sends line in the menu — why: today's trigger; every transmitting control shows a Sends line — cost if wrong: copy.
- **L1234** Ruling: 7.1 8-01 — a sender's name on a row is not a link (today: opens Node Details) — why: MessageRowD draws the name as text; the contact is one click away in the sidebar DMs and Nodes — cost if wrong: one shortcut.
- **L1235** Ruling: 7.1 8-01/8-02 — the device bar (status, adverts, Disconnect) is on the channel screen only (boards 8-01/8-02); the room screens follow 8-03/8-04 (none); re-hosted views keep today's status bar — why: boards — cost if wrong: adverts one click away on a room.
- **L1236** Ruling: 7.1 8-16 — phone Home has no message search (MeshCore has none today) and no bell (note s8n6); Disconnect asks nothing (today) — why: today — cost if wrong: none.
- **L1237** Ruling: 7.1 HD — the second 15 s `useMeshCoreUnread` poll on re-hosted MeshCore views (sidebar + MeshCorePage) is accepted; nothing changed for it — why: a second instance of today's interval, HTTP only, gone when those views go native — cost if wrong: doubled channel-counts/room-stats requests on re-hosted views.

#### Task 7.2 — MeshCore contacts, node page, nodes

- **L1241** Ruling: 7.2 HG — accept the board-check must-list casing swaps to today's en.json strings (D9b; same as 6.1 / 6.6). Promote M1 (a crafted splat must not throw; no double decode; the fix-up redirect encodes), M2 (a tab the node type lacks redirects to Overview's URL), M3 (the favourite override clears when server data changes), M4 (without remote_admin:write the facts do not claim "Not logged in"), M5 (the disabled Log in reason is visible text, not tooltip-only), M6 (no hardcoded English: use today's or new workspace.* keys), M7 (desktop path-chip buttons and star at 36 px; phone quick-age select at 44 px) and M9 (a disabled Export shows its reason).
- **L1242** Ruling: 7.2 all — native: `nodes` (MeshCoreNodesTable) and `node/<key>[/<tab>]` (ContactPage); today's Nodes view (list + map) moves to `map` (the sidebar Map row, `map?node=<key>` for Show on Map), and the forbidden/unknown-view fallback redirects to `map` — why: the boards draw a table without a map, the map half has no other home, and the re-hosted page stays mounted while the URL is fixed — cost if wrong: an old `/nodes` bookmark shows the table, not the map.
- **L1243** Ruling: 7.2 g6 — Log in and the Console tab link to `settings/console?node=<key>`, which until 7.4 re-hosts today's DM view (Node Details) on that node, where today's console (login, saved password, session, stats, ACL) lives; no new prop (today's `dmContact`) — why: today's login flow exactly, no second login UI — cost if wrong: the console opens in Classic's two-pane view until 7.4.
- **L1244** Ruling: 7.2 all — the row ⋯ "Node Details" (today's label) opens the native node page; DMs stay one click away via Message — why: dispatch — cost if wrong: one more click to a DM.
- **L1245** Ruling: 7.2 8-05/8-20 — must lists edited where an en.json string labels the control (D9b): "COMPANION"→"Companion", "REPEATER"→"Repeater" (CSS uppercases), "Discover path"→"Discover Path", "Not in radio"→"Not in the radio" (today's "Not in the radio's contact list"), "Signature"→"Advert signature", "Group by role"→"Group by Role", "Last heard"→"Last Heard" — why: today's strings win — cost if wrong: case/wording.
- **L1246** Ruling: 7.2 8-05 — board copy (no en.json string exists; today's are code defaults only): Ping, Trace path, Reset path, Share contact, Export meshcore://, Remove, 1/2/3-byte, Add hop, Save path, Edit path, Set path, Flood, Import contact, Allow this contact to run CLI commands — why: D9b applies only to en.json strings — cost if wrong: copy.
- **L1247** Ruling: 7.2 8-05 — the Direct / Flood / Set path segment is a status, not three buttons; Flood is Reset path, Set path is the editor — why: today has no "set direct" control and the board's segments map onto today's two — cost if wrong: one click saved.
- **L1248** Ruling: 7.2 8-05 — Ping and Trace path cards only for non-repeaters; a repeater's asks are in Ask the node (g6 absent "Ping") — why: board note s8n0 — cost if wrong: one menu click for a repeater.
- **L1249** Ruling: 7.2 8-05/8-20 — the RTT and per-hop SNR lines show after a press in this visit (today keeps no last result) — why: today's data — cost if wrong: an empty card before the first ping.
- **L1250** Ruling: 7.2 g6 — Repeater facts are Admin login (remembered session), Uptime and Battery from the node row; no Clock drift or Flood adverts rows — why: those need a logged-in status request (airtime) — cost if wrong: two rows.
- **L1251** Ruling: 7.2 g6 — a repeater also gets an Admin tab (after Console) with today's per-node telemetry / neighbours / time-sync configs — why: GR, s8n3 puts them on Admin — cost if wrong: one extra tab.
- **L1252** Ruling: 7.2 8-11/8-28 — Discover segments keep today's labels ("Discover Nearby Nodes", "Discover Repeaters", "Discover Sensors"); the answer is a line in today's words with the mode, time and the board's "multi-hop nodes do not appear" (no toast) — why: D9b; one place for the answer — cost if wrong: longer labels, wrapping on phone.
- **L1253** Ruling: 7.2 8-11 — the Neighbour tag shows whenever the row carries today's repeater-neighbour flag (today: repeater sources only, the only place the flag is set); NEW tags rows the last discovery reported `isNew` — why: today's data — cost if wrong: none.
- **L1254** Ruling: 7.2 8-11 — Export is a Workspace RowMenu (CSV / HTML, today's exporter); filters open today's `AdvancedNodeFilterPopup` with MeshCore's features (not NodeFiltersSheet, which is Meshtastic-only) — why: today's controls, no Classic change — cost if wrong: a Classic-styled filter dialog.
- **L1255** Ruling: 7.2 8-28 — phone adds a Favourites chip (view-only, not persisted) — why: board — cost if wrong: none.
- **L1256** Ruling: 7.2 8-05 — Not in the radio is today's notice component (its text, its "full list" window.confirm) plus a Sends line "Sends nothing on the mesh; writes it to the radio" (board says "over USB"; the link may be TCP) — why: today's behaviour, accurate copy — cost if wrong: copy.
- **L1257** Ruling: 7.2 all — "Copied to clipboard." / "Advert broadcast." stay shown (today hides them after 2.2 s) — why: no new timers — cost if wrong: a lingering line.
- **L1258** Ruling: 7.2 8-11 — every row is rendered (no virtualising; `shortcut:` comment) — why: a radio's contact list is hundreds at most — cost if wrong: a slow page on a very large list.
- **L1259** Ruling: 7.2 all — Rule X: the age-window filter moved to `filterMeshCoreRowsByAge`; MeshCorePage gained optional `mapNode` — why: shared, behaviour-preserving — cost if wrong: none (Classic tests unchanged and green).
- **L1260** Ruling: 7.2 8-28 — phone Sort and Export sit in their own row under the count line (the count line holds the quick age window) — why: one 390 px row cannot hold count, age window, sort and Export at 44 px — cost if wrong: one row of height.
- **L1261** Ruling: 7.2 g6 — a disabled Log in states its reason in a line at the top of the page body ("Log in: …") — why: touch users cannot see the tooltip — cost if wrong: one line.

#### Task 7.3 — MeshCore repeater and room admin

- **L1265** Ruling: 7.3 HF — ordering with 7.4: 7.3 mounts the shared SettingsFrame for MeshCore sources and registers only its own categories (Console, repeater Settings, ACL via the remote target). Every other MeshCore settings URL stays re-hosted as today until 7.4. 7.2's settings/console?node= link then lands natively. — why: 7.3's categories need the frame that 7.4 fills — cost if wrong: 7.4 rebases its list on 7.3's registration.
- **L1266** Ruling: 7.3 HH — the boards win on layout (the user asked for the canvas as drawn). Redraw 8-07/8-25 on the settings row kit and the frame's dock: chevron rows, "was" badges, Read again / Import / Export, and the dock reading "N changes · Save repeater settings" with the SendsLine, Discard changes and "Send to node" (the 5.9 remote-dock label). The draft lifts into MeshCoreTargetProvider, which also fixes I2. Restore the trimmed must strings wherever today's data supplies them. 8-06's stats and history panels and the sidebar SESSION block (Log out / Forget) are drawn as the board draws them, over the same hooks. Rule X: no Classic edits beyond extractions. — cost if wrong: a larger redraw than mounting today's form.
- **L1267** Ruling: 7.3 HI — the danger confirm keeps today's typed contact-name word for a console reboot. s8n2 says "Reboot and a console reboot ask plainly" as a statement of today's behaviour, not as an override, and today does guard reboot with a typed word (MESHCORE_REMOTE_ADMIN.md). The global constraint keeps the typed word where today asks for one. Add 8-06's "What happens" list through ConfirmSheet's `consequences`. FINAL REPORT ITEM: the s8n2 note misstates today's reboot guard. — cost if wrong: one typed word more than the board shows.
- **L1268** Ruling: 7.3 HJ — promote M2 (a viewer without remote_admin:write sees a no-permission note in the frame, not a silent redirect, and nothing is lost versus the old Node Details link), M3 (quick actions are exactly today's catalog: no added get radio/tx/name; advert.zerohop only if today has it, otherwise a Ruling; the phone "+N more" per s8n6), M4 (chip labels are not command strings used as i18n keys) and M6 (count capability/session GETs on re-render; count Log out / Forget requests; a frame-level test for the no-permission and unknown-key fallbacks). M5 (a second useMeshCore runtime when moving node page → Console, which restarts the snapshot and today's 30 s poll) and M7 are deferred minors.
- **L1269** Ruling: 7.3 all — `SettingsFrame` hands a MeshCore device to `MeshCoreScreen` (kind `settings`), whose body (`MeshCoreSettingsFrame`) draws the shared `SettingsList` / `CategoryPage` / registry; Meshtastic's `RadioConfig` is not mounted — why: one `useMeshCore` per screen (Ruling AD) and RadioConfig loads the Meshtastic device config — cost if wrong: a second, small frame body (≈40 lines) beside the Meshtastic one.
- **L1270** Ruling: 7.3 all — only `settings[/node-settings|/console]` with a target (`?node=` or the one picked while settings stay open) are native; every other MeshCore settings URL, `#configuration` included, stays re-hosted until 7.4 — why: HF — cost if wrong: none (old URLs unchanged).
- **L1271** Ruling: 7.3 all — the target is a MeshCore repeater or room server in this radio's contacts; a companion keeps today's console on its node page (Admin tab, 7.2) — why: those are the contacts today's remote console logs in to — cost if wrong: companions are not in the picker.
- **L1272** Ruling: 7.3 all — the picker and the pages need `remote_admin:write` on the source (today's console gate); disconnected or a non-Companion radio show the page with sends off and the reason (today hides the console) — why: a visible reason beats a vanished page — cost if wrong: a page whose controls are all off.
- **L1273** Ruling: 7.3 all — `CliConsoleBody` gains optional `onDangerCommand(command, send)`; unset (Classic) keeps today's typed-name modal; its tests unchanged and green — why: the dispatch asks for a ConfirmSheet with `submitOnEnter={false}` and the primitive owns the danger interception — cost if wrong: one optional prop on a shared primitive.
- **L1274** Ruling: 7.3 8-06/8-21 — the danger ConfirmSheet keeps today's typed contact name, today's title "Confirm destructive command", today's "Send <command>" and today's body less its "Type the contact name" sentence (the sheet's own prompt says it); no "What happens" list — why: today asks for a word (global constraint: typed word only where today asks), although s8n2 says a console reboot "asks plainly" — cost if wrong: one typed name more than the board.
- **L1275** Ruling: 7.3 8-06/8-21 — quick-action chips are labelled with their commands (board) and add `get radio`, `get tx`, `get name`; no `stats` (no remote verb, today's note) and no `advert.zerohop` (not in today's remote catalog); all shown at once (no "+5 more"); a chip fills the input and sends nothing (today) — why: today's labels are code defaults, so the board's wording may win (D9b); today's catalog — cost if wrong: two board chips missing.
- **L1276** Ruling: 7.3 8-06 — Log out and Forget stored password sit in the login card, not the page header; the sidebar has no SESSION block (the login card shows the state) — why: one place for the login state, shared by both pages — cost if wrong: a sidebar line.
- **L1277** Ruling: 7.3 8-06/8-21 — Remote node status, the command history and the access list form are today's components as they are (Classic look inside the Workspace page) with Workspace Sends lines beside them; the history is today's collapsed "Command history" (all users, masked as `********`), no All users / Mine switch — why: Rule X, no fork; today's data — cost if wrong: Classic-styled blocks in a Workspace page.
- **L1278** Ruling: 7.3 8-07/8-25 — Settings is today's `RepeaterSettingsForm` in remote mode (per-group Read / Read again, cost lines, Save repeater settings, Discard, Import/Export settings) with Workspace-token input styling, not the board's chevron rows, "was" badges and save dock — why: the form is the shared schema-driven form (#6256) and Rule X allows no fork — cost if wrong: a row-kit rebuild later.
- **L1279** Ruling: 7.3 8-07/8-25 — no access-list key rows (the firmware's `get acl` is serial-only; today has no list) — why: today's data — cost if wrong: a board block.
- **L1280** Ruling: 7.3 8-07/8-25 — the access list's reply shows under its form (today: in the console transcript) — why: the form is on Settings, the transcript on Console — cost if wrong: none.
- **L1281** Ruling: 7.3 8-07/8-25 — Settings needs the admin session as today; logged out, it shows today's "Log in as admin first. Settings never log in on their own." with the login card — why: today shows the settings only once logged in — cost if wrong: none.
- **L1282** Ruling: 7.3 all — the values read from a target stay while its settings are open (provider state), drafts in the form do not — why: no second airtime cost for Console → Settings; today's form holds its own draft — cost if wrong: a typed but unsaved value is lost on leaving the page.
- **L1283** Ruling: 7.3 8-06 — Guest / Admin segments drive today's one password field (Guest = blank, field hidden); the form is shown whenever logged out, beside Resume session and Log in with saved password (today: buttons first, then a modal) — why: board; same flow and requests — cost if wrong: none.
- **L1284** Ruling: 7.3 8-06/8-21 — status reads "Logged in · admin · password saved" (new workspace copy) where today's chip says "Session active" — why: today's chip strings are code defaults, the board adds facts today has (isAdmin, saved) — cost if wrong: copy.
- **L1285** Ruling: 7.3 8-06/8-21/8-07/8-25 — must lists edited: 8-06 drops "advert.zerohop", "All users", "••••••" and "History" → "Command history"; 8-21 "QUICK ACTIONS" → "Quick actions" (CSS uppercases), "History" → "Command history"; 8-07 and 8-25 drop "Send to node" (today's en.json "Save repeater settings" labels the save, D9b) — why: today's strings and data — cost if wrong: board words.
- **L1286** Ruling: 7.3 all — `CategoryPage` lets a remote-only page without a Meshtastic target own its scope line; the MeshCore pages set "Remote repeater · …" and a crumb to the node page (desktop) — why: "On the radio ·" would misname a remote node — cost if wrong: none (Meshtastic DOM unchanged).
- **L1287** Ruling: 7.3 all — a MeshCore target sits in today's `remoteTargetStore` as a `RemoteNode` with `nodeNum: 0` and the public key in `nodeId` — why: the settings list and trigger read that store; no second store — cost if wrong: a field whose meaning differs by protocol.
- **L1288** Ruling: 7.3 all — Rule X: `useMeshCoreRemoteSession`, `useRemoteRepeaterSettings` and `remoteActionCatalog.ts` moved out of MeshCoreRemoteConsole / MeshCoreRemoteSettingsSection, behaviour-preserving (the one dependency added, `t` on Forget, is stable) — why: no fork — cost if wrong: none (Classic tests unchanged and green).
- **L1289** Ruling: 7.3 HI — the console danger confirm keeps today's typed contact name; "What happens" goes through ConfirmSheet `consequences` for reboot/clkreboot — why: today guards reboot with the name; s8n2 describes, not overrides — cost if wrong: one typed word more than the board.
- **L1290** Ruling: 7.3 8-06 — "advert.zerohop" stays out of the quick actions and the must list — why: today's remote catalog (`REMOTE_ACTION_CATALOG`) has no such entry (M3: exactly today's catalog) — cost if wrong: one chip.
- **L1291** Ruling: 7.3 8-06 — "••••••" stays out of the must list — why: today's server masks secrets as `********` (`meshcoreCliRedact.ts` `REDACTED`), so the history shows that — cost if wrong: a glyph.
- **L1292** Ruling: 7.3 8-06/8-21 — the history title is today's "Command history" (en.json) — why: D9b — cost if wrong: one word.
- **L1293** Ruling: 7.3 8-07 — a row's value opens a sheet with today's field and Done (the kit has no chevron row for text or numbers; its phone select is the pattern) — why: HH chevron rows over today's validation — cost if wrong: one tap more than an inline field.
- **L1294** Ruling: 7.3 8-07 — Read again reads all three groups in one request (today's route takes a list; today's form reads one group per button) — why: the board has one Read again — cost if wrong: none (same values, same per-value airtime).
- **L1295** Ruling: 7.3 8-07 — today's per-value warnings (advert and flood airtime per day, TX power, hop limit ≤ 2, repeat off, airtime factor < 1), the per-key save results, the out-of-range note and Include name, position and radio are kept — why: GR — cost if wrong: longer row help than the board.
- **L1296** Ruling: 7.3 8-06 — Sent and Received show "total · flood fl · direct dir"; RX air time and Error Events stay — why: GR (today shows them) — cost if wrong: two more cells.
- **L1297** Ruling: 7.3 8-06 — the sidebar Session block draws the state only, as the board; Log out / Forget are in the page header (desktop) and the login card (phone) — why: the board draws them there — cost if wrong: none.
- **L1298** Ruling: 7.3 HJ — a forbidden or unknown target shows a no-permission / not-found note in the frame with a link to the node page — why: HJ — cost if wrong: none.
- **L1299** Ruling: 7.3 all — shared additions are optional props (SettingNumber `stepper`, ActionCommand `label`, the CategoryPage header slot, LeaveGuard without a queue, RemoteEntry `session`) — why: no fork — cost if wrong: none (Meshtastic DOM unchanged; Phase 5 boards green).

#### Task 7.4 — MeshCore settings, channels, maintenance

- **L1303** Ruling: 7.4 HK — HH holds and s8n4 is spec. Redraw all eleven pages on the kit, each with its own bar as on 8-08: Path hash & scope, Sender names, Contacts, Observer, Adverts & forwarding, Access as its own page, Clock, Reactions, Required repeaters, Display (Purge messages in its danger zone), Filters and Notifications. Remove today's SaveBarProvider/SaveBar from the Workspace frame, including the Backups card's schedule save. Every draft is covered by LeaveGuard. Rule X: extract today's state into hooks where needed, with Classic unchanged. — cost if wrong: a large redraw instead of mounting.
- **L1304** Ruling: 7.4 HL — promote:
- **L1305** Ruling: 7.4 HM — accept the slot list showing the first and last 4 hex characters of a channel key, as the board draws it. The raw key reaches only writers, who can already see it in full in the editor and the Share URL; 96 bits stay hidden. FINAL REPORT ITEM: today's list shows none of it. — cost if wrong: 32 bits of a PSK on screen for a writer.
- **L1306** Ruling: 7.4 HN — N1 must be fixed: build the local Console as 7.3 built 8-06 (CliConsoleBody, onDangerCommand → ConfirmSheet with today's typed word, Sends line, module CSS, phone targets), reusing 7.3's pieces. Also promote N2 (Observer Cancel clears the broker password and the manual key draft, as today), N3 (restore today's one-sweep-at-a-time discovery guard across the Regions and node discovery pages; it must survive a remount), N4 (sound picker in .embedded for phone targets), N5 (the Channels LeaveGuard names the actual changed fields) and N6 (Purge messages test asserts exactly 1 request).
- **L1307** Ruling: 7.4 HO — Purge messages checks messages:write for this source, which is narrower than today's sourceless check. This is accepted: CLAUDE.md requires per-source permission checks on a sourceId route. FINAL REPORT ITEM. — cost if wrong: a user with messages:write only on another source loses Purge here.
- **L1308** Ruling: 7.4 all — every MeshCore `settings[/…]` URL is the settings frame; `configuration[#section]` and `#configuration` redirect beside it to the page holding the section (`MESHCORE_SECTION_TO_CATEGORY`); `notifications` and `security` stay re-hosted (not settings views) — why: HF, no URL regresses — cost if wrong: two MeshCore views still Classic.
- **L1309** Ruling: 7.4 all — MeshCore page ids may repeat a Meshtastic id (`channels`, `telemetry`, `notifications`); `categoryById` returns the first (Meshtastic) and MeshCore code resolves through the device's visible categories — why: natural URLs — cost if wrong: an id shared across protocols.
- **L1310** Ruling: 7.4 all — `settings/maintenance` is a page on MeshCore and a group on Meshtastic; `resolveSettingsPath` reads a lone group name before a one-part page and the MeshCore frame treats it as the page id — why: the board's single Maintenance page — cost if wrong: one special case.
- **L1311** Ruling: 7.4 all — Console is one category (`remote: 'yes'`): a remote target's console (remote_admin:write) or this radio's serial console (configuration:write, today's showConsole); CategoryPage decides "remote MeshCore page" by target kind — why: one `settings/console` URL — cost if wrong: none (7.3 tests green).
- **L1312** Ruling: 7.4 all — the frame publishes the radio's role and list summaries into `remoteTargetStore.device` so the settings list and search show pages by role; an unknown role reads as a Companion — why: the list sits outside the screen's runtime — cost if wrong: a Companion page briefly listed for a repeater before status loads.
- **L1313** Ruling: 7.4 all — the undrawn pages with large sections (Path hash & scope, Sender names, Contacts, Observer, Adverts & forwarding, Clock, Reactions, Required repeaters, Display, Filters, Notifications) hold today's sections as they are, with their own save buttons / today's SaveBar — why: s8n4 draws none of them, Rule X allows no fork, GR — cost if wrong: Classic-styled blocks inside Workspace pages; a kit redraw later. FINAL REPORT ITEM.
- **L1314** Ruling: 7.4 all — Access (local repeater) is on Adverts & forwarding, not its own page — why: today's one RepeaterSettingsForm reads and saves both in one request — cost if wrong: one list row missing.
- **L1315** Ruling: 7.4 all — Contacts holds today's Device actions; its gate is configuration:read or settings:read, and for a viewer without configuration:read it also holds the radio contact list (today's Settings tab keeps both for them) — why: GR — cost if wrong: none.
- **L1316** Ruling: 7.4 8-08 — Multi-ACKs and BLE PIN save from Radio's dock (each setter once, only when changed; today each had its own Save); the BLE PIN is read on open as today's section did — why: board — cost if wrong: one dock for three saves.
- **L1317** Ruling: 7.4 8-08 — Coding Rate is a 5–8 stepper with "5–8 → 4/5 – 4/8" help (board), not today's 4/5–4/8 select labels — why: board — cost if wrong: label form.
- **L1318** Ruling: 7.4 8-09 — virtual channels (channel database) are not listed — why: not device slots — cost if wrong: none (today's section listed every row; the server returns them only to the list view).
- **L1319** Ruling: 7.4 8-09 — a secret slot shows the first 4 and last 4 hex characters (board), only to viewers the server sends the key to — why: board; 96 bits stay hidden — cost if wrong: a partial key on screen.
- **L1320** Ruling: 7.4 8-09/8-26 — no drag in the table; reordering is today's Reorder panel behind the button — why: today's reorder logic and its write — cost if wrong: drag handles that are decoration.
- **L1321** Ruling: 7.4 8-09 — Edit opens the editor card under the table; phone: a row opens it, with Delete inside — why: board has one editor card — cost if wrong: one scroll.
- **L1322** Ruling: 7.4 8-09 — Reset to Public stays visible, off with "Slot 0 already holds the Public channel." when slot 0 is stock (today hides it) — why: board draws it — cost if wrong: a disabled button.
- **L1323** Ruling: 7.4 8-09 — Import from URL lives in the Add card (decode, then import), today's modal's requests and words; its 600 ms close delay is dropped — why: board, no new timers — cost if wrong: none.
- **L1324** Ruling: 7.4 8-10/8-27 — Power off keeps today's label "Shut down" (en.json `device_actions.shutdown.button`, D9b) with today's dialog title "Power off <name>?"; must lists 8-10 and 8-27 "Power off" → "Shut down" — cost if wrong: one word.
- **L1325** Ruling: 7.4 8-10/8-27 — the Factory Reset sheet keeps today's five-item wipe list under today's "This wipes:" and the TCP warning — why: today's words win — cost if wrong: a longer sheet.
- **L1326** Ruling: 7.4 8-10 — Backups is a compact card (last backup, N stored, Daily switch, time, max backups, Create backup, Download latest, each file's Restore / Delete) rather than "Weekly ›" — why: today has a daily schedule, not weekly — cost if wrong: board layout differs.
- **L1327** Ruling: 7.4 8-10 — Restore Private Key asks in one sheet holding the key field and the typed name (today: inline panel, then a typed dialog) — why: D9c one sheet — cost if wrong: none (same request, same words).
- **L1328** Ruling: 7.4 8-22 — must list "ON THE RADIO" / "IN MESHMONITOR" → "On the radio" / "In MeshMonitor" (CSS uppercases); counts "· 12" / "· 8" on the phone list; summaries for Radio (preset), Channels, Contacts, Console, Connection only — cost if wrong: casing.
- **L1329** Ruling: 7.4 all — Purge all messages and Receive-only off confirm in ConfirmSheet with today's words instead of window.confirm; Receive-only's confirm label is new copy "Allow transmitting" — cost if wrong: copy.
- **L1330** Ruling: 7.4 all — the Workspace copies drop today's 2.5 s "Saved" badges (no new timers); a successful save closes the dock — cost if wrong: no explicit "Saved".
- **L1331** Ruling: 7.4 all — Rule X: `useMeshCoreContactSync` moved out of MeshCoreContactSyncSection (body moved byte-for-byte by script); `MeshCoreNode.maxChannels?` added (type only) — cost if wrong: none (Classic tests unchanged and green).
- **L1332** Ruling: 7.4 all — MeshCore devices are now searched (⌘,): `MESHCORE_FIELDS` (sync-tested), today's MeshCore section catalogue and page names; `b-set-d4-search` edited because "hop" now also finds Heltec's Device actions ("zero hop") — cost if wrong: one more result.
- **L1333** Ruling: 7.4 all — Workspace test edits: `WorkspaceApp.test.tsx` (MeshCore `configuration`/`settings`/`#configuration`/`settings/console` now the frame), `categories.test.ts` (ids unique per device type, MeshCore sections map to pages, remote-only list), `routes.test.ts` (redirect cases) — cost if wrong: none.
- **L1334** Ruling: 7.4 8-09 — the slot list shows a key's first and last 4 hex characters, as the board draws it (HM) — why: the raw key reaches only writers, who already see it in full in the editor and the Share URL; 96 bits stay hidden — cost if wrong: 32 bits of a PSK on screen for a writer. FINAL REPORT ITEM: today's list shows none of the key.
- **L1335** Ruling: 7.4 all — HK applied: the eleven s8n4 pages plus Access are on the kit, each with its own bar; switches that saved at once today still do (Answer discovery, Receive-only, a region, a filter's On, list deletions, broker credentials, the signing key) — why: same request at the same moment as today — cost if wrong: a few rows act without the bar.
- **L1336** Ruling: 7.4 all — Contacts and Clock have no bar: nothing on them is a saved setting (today's "Nothing here is a saved setting") — cost if wrong: none.
- **L1337** Ruling: 7.4 all — Console keeps today's MeshCoreLocalConsole (s8n4: "the same console() as 8-06"); HK does not list it — cost if wrong: Classic look inside the console.
- **L1338** Ruling: 7.4 all — Display's Clean outliers opens today's TelemetryOutlierDialog, as Phase 5's Data page does — cost if wrong: one centred dialog.
- **L1339** Ruling: 7.4 all — Notifications' per-channel sounds are today's ChannelSoundPicker, as Phase 5's Notifications page does — cost if wrong: Classic look for that picker.
- **L1340** Ruling: 7.4 all — an unknown MeshCore role offers only the pages every role has (HL) — cost if wrong: a Companion's own pages wait for its status.
- **L1341** Ruling: 7.4 all — Purge all messages checks `messages:write` on this source, narrower than today's sourceless check (HO) — why: CLAUDE.md requires per-source permission checks on a route that acts on a `sourceId` — cost if wrong: a user with `messages:write` only on another source loses Purge here. FINAL REPORT ITEM.
- **L1342** Ruling: 7.4 all — `AclManager` takes `run(command)` and its `sends` text, and `HistoryPanel` takes a history target string. This lets 7.3's pieces serve this radio's console without a fork — cost if wrong: none (7.3's callers pass the same values; its boards and tests are green).
- **L1343** Ruling: 7.4 all — the one-sweep guard is a per-source store (`sweepStore.ts`), not runtime state — why: it must outlive the page and be read by both pages — cost if wrong: none.

#### Task 7.5 — MeshCore packets, info, automations, region feed

- **L1347** Ruling: 7.5 HP — fix I1–I5. The dock line is accurate per built-in: where today's server runs or re-arms on save, say so in today's terms; otherwise say saving sends nothing. This is wording, not a limit, so no user decision is needed; the re-arm behaviour itself stays a FINAL REPORT ITEM. Use today's meshcore.advert.flood_automated_warning, shown for flood only (D9b). The region feed's Nodes and Channels reuse 7.2's MeshCoreNodesTable and 7.1's channel thread, read-only, per s8n5.
- **L1348** Ruling: 7.5 HQ — promote minors:
- **L1349** Ruling: 7.5 HR — MeshCore map, the channels/rooms/dms list views, telemetry, notifications and security stay re-hosted. No board in Section 8 draws them as pages (the review confirmed this), so building them would be design without a canvas. FINAL REPORT ITEM: the plan gap.
- **L1350** Ruling: 7.5 8-12/8-29 — titles "Packet Monitor" / "Packet Decode" (today's en.json); must lists edited — why: D9b — cost if wrong: case.
- **L1351** Ruling: 7.5 8-13 — "Add to favorites" (today's favourite, which puts the graph on the Dashboard) for the board's "Add to Dashboard"; must list edited — why: D9b — cost if wrong: two words.
- **L1352** Ruling: 7.5 8-14 — titles in en.json win (Auto Ping, Auto Delete by Distance, Time Sync, Remote Telemetry, Auto Favorite, Auto Welcome); the hard-coded ones take the board's words (Auto-pathfinding, Auto-ack, Auto-announce, Auto-responder, Timer triggers); must list edited — why: D9b, ledger 3.1/4.8 precedent — cost if wrong: string swaps.
- **L1353** Ruling: 7.5 8-12 — Decrypt is a label, not a button: today decrypts once when a group frame opens; the board's "Decrypt" shows next to the result — why: D9d, same single request — cost if wrong: one click.
- **L1354** Ruling: 7.5 8-12 — a grouped row's observers come from today's `packets/receptions` route (once per open) — why: the board lists them; today's view only shows the count — cost if wrong: one read per open.
- **L1355** Ruling: 7.5 8-12 — default view All (today), Grouped one click away; Size and Path columns kept; the time-window select kept — why: GR/D9d — cost if wrong: the board's default.
- **L1356** Ruling: 7.5 8-14 — Timer triggers, Time Sync and Remote Telemetry have no overview switch (on/off per trigger or node today); they show On/Off — why: no such switch today — cost if wrong: three switches.
- **L1357** Ruling: 7.5 8-14 — engine rules switch at once (today's engine page), built-ins queue in the dock — why: today's two behaviours — cost if wrong: one more dock.
- **L1358** Ruling: 7.5 all — the twelve built-in pages are drawn on the row kit from one table (builtins.ts), lists edit in a sheet; script management stays in Server › Scripts; the token reference is a hint line — why: HK — cost if wrong: the responder's script panel one hop away.
- **L1359** Ruling: 7.5 all — Auto Delete by Distance's Run now asks first (ConfirmSheet with today's description) — why: a destructive control (global constraint), today has no confirm words — cost if wrong: one extra press.
- **L1360** Ruling: 7.5 8-15/8-23 — the feed's Overview reads nodes, messages and (desktop) two packets on open — why: the board draws them — cost if wrong: three reads per open, no poll.
- **L1361** Ruling: 7.5 8-12/8-13 — More tools… stays a menu (7.1) rather than the board's expanded sub-list — why: 7.1 Ruling and its test — cost if wrong: a sidebar disclosure.
- **L1362** Ruling: 7.5 8-13 — graphs are sparklines (SVG title shows the last value) rather than recharts with axes and tooltips — why: board; module tokens — cost if wrong: hover values.
- **L1363** Ruling: 7.5 HR — MeshCore `map`, the `channels`/`rooms`/`dms` list views, `telemetry`, `notifications` and `security` stay re-hosted — why: no Section 8 board draws them as pages (review confirmed) — cost if wrong: a later task builds them.
- **L1364** Ruling: 7.5 I2 — the feed's Channels tab uses 6.7's receive-only line as is; its text ("… Open a Meshtastic source to send.") names Meshtastic — why: the shared line, no new copy — cost if wrong: one sentence.

#### Task 7.6 — Reticulum

- **L1368** Ruling: 7.6 HT — fix I1 with an optional counter-hiding prop on MessageComposeInput, defaulting to today's behaviour (Rule X; precedent maxBytes / blockSendOverLimit from 7.1). Fix I2 with an Enter guard (!e.repeat and not in flight) plus a test. Promote:
- **L1369** Ruling: 7.6 HU — the Reticulum dashboard page mounts the shared Dashboard grid whole until Task 8.1, which owns that redraw; 8.1's brief must name reticulumDashboardSource. canEdit now checks dashboard:write on this source, narrower than today's sourceless check; this is accepted under the per-source rule (as HO). FINAL REPORT ITEM.
- **L1370** Ruling: 7.6 9-01 — The status poll moves to one `useReticulum` per device screen; all view URLs render one ReticulumScreen; the sidebar reads its lists from the query cache — why: the controller's poll ruling and Ruling AD — cost if wrong: none (fewer requests than a second hook).
- **L1371** Ruling: 7.6 9-01 — No Activity bell in a Reticulum device's header — why: Activity is the Meshtastic feed (Task 2.8); a Reticulum device has none — cost if wrong: one header icon.
- **L1372** Ruling: 7.6 9-01/9-10 — LXMF rows are `MessageRowD` read-only, with no Reply/React/Delete actions — why: today has none for LXMF — cost if wrong: none.
- **L1373** Ruling: 7.6 9-01/9-10 — The composer shows the shared byte counter "N/200" without blocking — why: Composer has no prop to hide it, and adding one to the Classic MessageComposeInput was avoided; today's LXMF box has no counter or limit — cost if wrong: a misleading counter. FINAL REPORT ITEM.
- **L1374** Ruling: 7.6 9-01/9-10 — Without `messages:write`, the composer is a note ("Needs messages:write"), and guests get the guest note; today showed a box the server would refuse — why: the Workspace composer pattern — cost if wrong: none.
- **L1375** Ruling: 7.6 all — Peer hashes read `<xxxx…yyyy>` (board) instead of today's 12-character prefix — why: the board's format — cost if wrong: a format.
- **L1376** Ruling: 7.6 9-02 — The favourite star is off without `nodes:write`, with "Needs nodes:write"; today it showed and the route refused — why: today's route gate shown up front — cost if wrong: none.
- **L1377** Ruling: 7.6 9-02 — Last heard is relative ("2 minutes ago"), as the board draws it; today showed the clock time; the panel shows both — why: the board — cost if wrong: one format.
- **L1378** Ruling: 7.6 9-03 — Today's Dashboard grid moves from under the Interfaces cards to its own URL `dashboard` (the sidebar's Dashboard row) and is mounted whole there; Phase 8 redraws the Dashboard for every device type — why: the board has a Dashboard row and its own rate-history block; the grid is the shared Dashboard component, not a Reticulum view — cost if wrong: a Classic-styled grid until Phase 8. FINAL REPORT ITEM.
- **L1379** Ruling: 7.6 9-03 — Rate history is drawn natively from today's telemetry read, one `useTelemetry` per interface, with today's 30 s refetch while the page is open (HTTP only). "Add to Dashboard" toggles today's telemetry favourite of that chart's series for every interface, one settings write per changed interface — why: the board draws one chart per direction with one button; today's favourites are per node and type — cost if wrong: N telemetry reads per 30 s on the page (N = interfaces).
- **L1380** Ruling: 7.6 9-04/9-12 — Each probed row keeps its last result while the page is open; today kept only the latest probe — why: the board shows several results at once; display only, no request — cost if wrong: none.
- **L1381** Ruling: 7.6 9-04/9-12 — Without `nodes:write` there is no Probe column, as today — cost if wrong: none.
- **L1382** Ruling: 7.6 9-05/9-14 — A Locations marker click opens the side panel or sheet instead of today's Leaflet popup; the tooltip stays — why: s9n3 says a click opens the same detail as 9-05 — cost if wrong: none.
- **L1383** Ruling: 7.6 9-06/9-07 — RNode radio visibility follows the source config's mode (missing reads as attach, as the server does), not the status poll — why: the settings frame runs no poll; the status reports the same config value — cost if wrong: the page listed or hidden before a config change reaches the status.
- **L1384** Ruling: 7.6 9-06/9-15 — Save is a plain button under the Identity card (desktop and phone), with LeaveGuard on edits; no McDock — why: the board draws a plain Save; McDock shows only with changes — cost if wrong: the phone's Save is not in a bottom bar.
- **L1385** Ruling: 7.6 9-06 — The board's announce help ("The server allows one Announce now every 60 s; the button counts down.") replaces today's "An announce tells the network this identity exists… Once a minute at most."; the Sends line names every interface — why: s9n1 — cost if wrong: one sentence of today's help.
- **L1386** Ruling: 7.6 9-07 — Numbers are inline fields (SF and CR steppers), not chevron rows that open a sheet, as RadioCategory did for 8-08 — why: the kit and its precedent — cost if wrong: a tap more on the phone.
- **L1387** Ruling: 7.6 9-07 — A field the radio did not report shows "—" and cannot be set here; today it showed an empty input — why: the kit's SettingNumber has no blank state — cost if wrong: a value set in Classic only.
- **L1388** Ruling: 7.6 9-07 — Apply sends today's whole non-blank config in one PUT, not only the changed fields — why: today's request — cost if wrong: none.
- **L1389** Ruling: 7.6 9-08 — Info adds the non-RNode interfaces with Online / Offline and the RNode-only note; gauge values keep today's format — why: the board; D9b — cost if wrong: none.
- **L1390** Ruling: 7.6 9-09 — No "Jump to conversation or destination…" field on the phone Home — why: no such control today, and no note asks for one — cost if wrong: one search field.
- **L1391** Ruling: 7.6 9-09 — Refresh is a header button on the phone Home, not pull-to-refresh (s9n4) — why: no pull gesture exists in the shell; the button keeps today's Refresh — cost if wrong: a gesture.
- **L1392** Ruling: 7.6 9-13 — Phone list rows carry no summaries ("GI desk", "869.525 MHz") — why: they need two reads on opening the list; the frame runs no poll — cost if wrong: two summaries.
- **L1393** Ruling: 7.6 9-13 — Global Settings is a list row linking to `/server/general`, shown to every viewer, as today's pointer was — cost if wrong: a viewer without settings access sees Server's no-permission page.
- **L1394** Ruling: 7.6 all — Must lists edited:
- **L1395** Ruling: 7.6 all — `dms` (today's Messages view) is a list page; desktop no longer shows today's empty "Select a conversation" pane — why: the sidebar lists the conversations — cost if wrong: none.
- **L1396** Ruling: 7.6 all — Today's `configuration` URL redirects to `settings`, and today's `settings` URL is now the frame — why: GR — cost if wrong: none.
- **L1397** Ruling: 7.6 HU — The Reticulum Dashboard page (`ReticulumDashboardPage`) mounts the shared Dashboard grid whole until Task 8.1, which owns its redraw; 8.1's brief names `reticulumDashboardSource` — why: the grid is the shared Dashboard component, not a Reticulum view — cost if wrong: a Classic-styled grid until 8.1.
- **L1398** Ruling: 7.6 HU — The Dashboard page's `canEdit` checks `dashboard:write` on this source, narrower than today's sourceless check (as HO) — why: CLAUDE.md's per-source rule — cost if wrong: a user with `dashboard:write` only on another source cannot edit this device's Dashboard. FINAL REPORT ITEM.

#### Task 8.1 — Device dashboard, per-user board

- **L1443** Ruling: 8.1 HV — the dashboard filters come back as a compact control reusing useDashboardFilters (search, node, type, role) over the board items. Sort is replaced by the user's own order, which is the board's model (D12); FINAL REPORT ITEM. Fix I1–I4:
  - Remove only the chart keys the draft removed; `changed` is measured against the snapshot. Test a star arriving mid-edit.
  - Read status from the shell or the cache, with no polling observer.
  - lowBattery is null ("—") without battery data. MeshCore Nodes reads ?show= so the tiles filter.
  - Phone 44 px element rules under the module class, inside card bodies.
- **L1448** Ruling: 8.1 HW — promote these minors:
  - M1: chart rows say removing unstars for everyone.
  - M2: `ready` waits for the prefs query, so a failed or late read never lets the seed overwrite a saved board (data-loss guard).
  - M4: tile counts use the same predicates as the views they open.
  - M5: dedupe the range buttons.
  - M6: forgetChart on removal.
  - M7: widget-body controls are gated on canEditBoard.
  Accepted: M3 (last write wins across tabs; noted in the storage table). M8 is process only.
- **L1456** Ruling: 8.1 j1/k1 — Packets / h is not a tile, and the board checks drop "Packets / h" — why: no read the Dashboard makes returns packet counts (the dispatch's no-new-request rule) — cost if wrong: a packet-stats read per device.
- **L1457** Ruling: 8.1 all — the nine tiles are Nodes online, Channel util., Airtime TX, Low battery, New today, Direct (default six), plus Favorites, Battery, Uptime; all from the nodes read and the status poll — why: the board draws six and says "6 of 9"; the other three are not drawn — cost if wrong: tile swaps.
- **L1458** Ruling: 8.1 j1/k1 — no sparklines, no "+2 vs yesterday", no channel name, no "limit 10%" on tiles — why: no history, channel or limit in the reads — cost if wrong: extra reads.
- **L1459** Ruling: 8.1 all — Low battery is 1–20 % (today's default notification threshold); 0 and 101 (mains) are not low — cost if wrong: a threshold change.
- **L1460** Ruling: 8.1 j1/j2/k2/k3 — widget names and descriptions are today's (D9b): Node Status, Hop Distribution, Distance Distribution, Hop/Distance Heatmap, Live Mesh Activity; checks swapped — cost if wrong: string edits.
- **L1461** Ruling: 8.1 j1 — "packets / min" and "NodeInfo" dropped from the check: today's Live Mesh Activity is a per-node table, not stacked bars by type (D9d) — cost if wrong: a new widget body.
- **L1462** Ruling: 8.1 k1/k2 — "MESH HEALTH", "YOUR BOARD · TOP TO BOTTOM" are CSS-uppercased "Mesh health", "Your board · top to bottom" (Ruling Q precedent); k2's "Telemetry chart · battery" → "Telemetry chart · Battery Level" (today's metric label) — cost if wrong: string edits.
- **L1463** Ruling: 8.1 j2 — the footer reads "Widgets offered depend on the device." without "MeshCore adds repeater stats, Reticulum interfaces": today MeshCore offers the same six and Reticulum none — cost if wrong: copy.
- **L1464** Ruling: 8.1 j2/k3 — *Telemetry chart* opens starring help (today's modal's help, steps rewritten for node pages) rather than a node and metric picker — why: today's behaviour (D9d), and a picker needs per-node telemetry reads — cost if wrong: a picker step.
- **L1465** Ruling: 8.1 all — today's search, node, type, role filters and sort are not on the Workspace board; the user's order replaces sort — why: the boards draw none and the board is per user — cost if wrong: a filter row (useDashboardFilters is reusable). FINAL REPORT ITEM (GR).
- **L1466** Ruling: 8.1 all — removing a starred chart in edit mode unstars it for everyone on Done, with no confirm (today's × has none) — why: D19 — cost if wrong: a ConfirmSheet, or hiding the chart per user instead.
- **L1467** Ruling: 8.1 all — renderers mount with `bare` inside Workspace cards; their body controls keep Classic styling (chart mode toggles, Node Status search, Live window) — why: HH allows reuse "through small props"; GR keeps every control — cost if wrong: a redraw of each widget body.
- **L1468** Ruling: 8.1 Reticulum — no health strip (no mesh-health data in its reads; its status line carries interfaces); still gated on `dashboard:read` as its sidebar row — cost if wrong: a Reticulum-specific strip.
- **L1469** Ruling: 8.1 MeshCore — tiles that MeshCore does not report (channel util, airtime, battery, uptime, new today) show "—"; Nodes' `?show=` scopes apply to Meshtastic-family Nodes only, and MeshCore Nodes opens unfiltered — cost if wrong: MeshCore Nodes reading `?show=`.
- **L1470** Ruling: 8.1 all — Edit needs `dashboard:write` on this source (today's canEdit, per source as 7.6 HU) and a signed-in user (the board is saved to the account) — cost if wrong: readers can't arrange their own board.
- **L1471** Ruling: 8.1 j2 — the Add widget panel is the shared Sheet (docked right, with backdrop), not a non-modal side panel — why: one sheet pattern (spec §5.7) — cost if wrong: a non-modal panel.
- **L1472** Ruling: 8.1 HV — sort is replaced by the user's own order (D12); search, node, type and role filters are back over the charts through today's `useDashboardFilters` — FINAL REPORT ITEM.
- **L1473** Ruling: 8.1 I3 — a tile whose value the device does not report is "—", "Not reported" and not a link — why: "each tile links to its filtered view" is kept true for every tile that links — cost if wrong: dead tiles on MeshCore and Reticulum-like sources.
- **L1474** Ruling: 8.1 M4 — tile counts are over every node with the opened view's predicate; in traceroute hop mode Direct uses no traceroutes (no new read) — cost if wrong: a small count difference in that mode.

#### Task 8.2 — Overview dashboard

- **L1478** Ruling: 8.2 HY — the Overview page adds no new intervals (N/DM). The per-device 30 s node polls are new on this URL; today's unified dashboard polled only the bundle. If the bundle already carries what the widgets need, use it. Otherwise read each board device's nodes once on open, with no refetchInterval on the Overview (they refresh on revisit or focus). Count the timers in a test. — cost if wrong: Overview widget node data is staler than on the device page.
- **L1479** Ruling: 8.2 HZ — fix I1 (no solar button on Overview cards) and promote:
  - M2: no home node for Reticulum, as 8.1;
  - M3: a disabled device's widget says it is disabled, not no permission;
  - M4: Change device resets the chart help;
  - M5: no raw node id as a title; use today's node-name fallback;
  - M6: drop the misleading sourceId from the global dashboard permission call;
  - M7: test that an unreadable chart card hides the node name and device tag.
- **L1486** Ruling: 8.2 j3/16-04 — no Packets / h column or figure — why: no read the page makes (status, unified bundle) returns packet counts, and the bundle omits `packetRatePerHour` (DASHBOARD_OMITTED_NODE_FIELDS); same as 8.1 — cost if wrong: a packet-stats read per device.
- **L1487** Ruling: 8.2 j3/16-04 — an offline device reads today's "Disconnected", not "Offline since 14:02" — why: no status reply carries a disconnect time — cost if wrong: a server field.
- **L1488** Ruling: 8.2 j3/16-04 — the MQTT broker reads its status ("Connected"), not "6 gateways"; an MQTT bridge with publishers reads today's "N gateways" / "c/t gateways" — why: only the bridge's status reports gateways (DashboardSidebar's badge); the broker's `clientCount` counts any client — cost if wrong: a broker-specific label.
- **L1489** Ruling: 8.2 j3 — Nodes is `activeNodeCount / nodeCount` from each device's status for every type (Reticulum "4 / 6", MQTT "28 / 64"), not "38 destinations" / "38 heard" — why: one rule from the status the shell already polls; it matches the Overview sidebar's "N online" — cost if wrong: per-type wording.
- **L1490** Ruling: 8.2 all — Nodes online on a row (status `activeNodeCount`, heard in 2 h) can differ from the device dashboard's Nodes online tile (`isHeardRecently`) — why: no per-device node read for the rows (the status poll already has the count) — cost if wrong: a node read per device.
- **L1491** Ruling: 8.2 all — Ch. util, Airtime TX and Low battery come from the all-devices bundle with `ageWindow=settings` (today's request on this URL); Low battery counts nodes inside the map's age window; MeshCore shows "—" (no battery level, no local node number) — cost if wrong: a row reading differs from the device tile for long-unheard nodes.
- **L1492** Ruling: 8.2 j3/16-04 — "Gateways reporting" and the noise-floor chart are not drawn; the board's widgets are today's six types and starred charts (8.1 HH) — why: no such widget today (D9d) — cost if wrong: a new widget.
- **L1493** Ruling: 8.2 j3/16-04 — the device tag is the existing DeviceTag (abbreviation in the device colour), not a name pill — why: the dispatch names DeviceTag — cost if wrong: a pill variant of DeviceTag.
- **L1494** Ruling: 8.2 all — Overview charts are pinned from a device's stars into `dashboard.overview` (with their device); removing one unpins it for this user only and never unstars — why: D19 keeps stars with the device; the Overview board is the user's own — cost if wrong: Done writes telemetryFavorites like the device dashboard.
- **L1495** Ruling: 8.2 all — Overview charts draw no solar overlay and no Y-range editor — why: both are each device's install-wide chart settings (`dashboardSolarVisibility`, `dashboardChartYRange`) and would need a settings read and the solar poll per device; they stay on the device's dashboard — cost if wrong: one settings read per device on the board and the 5-min solar poll.
- **L1496** Ruling: 8.2 all — no filters (search, node, type, role) on the Overview board — why: the boards draw none, Classic has no Overview board, and filters need every device's nodes — cost if wrong: a filter sheet over pinned charts.
- **L1497** Ruling: 8.2 all — the per-card gate is "device in the shell's readable list and `dashboard:read`" (global resource; not per source, spec §1.3); a card that fails shows today's permission text, no tag, no node name, and reads nothing for that device — cost if wrong: a stricter `nodes:read` per device check.
- **L1498** Ruling: 8.2 all — Edit needs a signed-in user and loaded prefs only (no `dashboard:write`) — why: the Overview board is per user and writes nothing install-wide; there is no Classic Overview board whose gate applies — cost if wrong: readers can arrange their own Overview board.
- **L1499** Ruling: 8.2 all — MeshCore widgets on the Overview get no home node (`currentNodeId` null) — why: MeshCore's local key comes from its own runtime poll, which the Overview does not mount — cost if wrong: Traceroute / distance widgets from MeshCore show their no-home state here; full on the device dashboard.
- **L1500** Ruling: 8.2 j3 — board-check edits: uppercase headers → their text ("Ch. util", "Airtime TX", "Low battery", "Status", "This MeshMonitor", "Devices", Ruling Q precedent); "Automations"/"Audit log" → today's sidebar labels "Automation Engine"/"Audit Log" (D9b, as f6); "PACKETS / H" dropped; "Offline since 14:02" → "Disconnected"; "Gateways reporting" → "Live Mesh Activity". 16-04: "Packets / h" and "6 gateways" dropped, "Offline since 14:02" → "Disconnected", "Gateways reporting" → "Live Mesh Activity", plus "No live numbers while offline" and the phone subtitle — cost if wrong: string edits.
- **L1501** Ruling: 8.2 all — the device picker is a Sheet before the Add widget sheet (one sheet at a time, D9c); *Change device* returns to it — cost if wrong: a combined sheet.
- **L1502** Ruling: 8.2 HY — Overview board node reads are on open (and focus or revisit) with no interval; the device dashboard keeps its 30 s poll on its own page; the Overview's only timer is the bundle's existing 15 s poll — why: N/DM — cost if wrong: Overview widget data is up to one visit staler than on the device page.
- **L1503** Ruling: 8.2 M3 — a readable but disabled device's widget keeps its device tag and says the device is disabled; it reads nothing for that device — cost if wrong: a disabled device's name is visible on the user's own board (it is readable).

#### Task 8.3 — Device automations and built-ins

- **L1507** Ruling: 8.3 HX — the plan text for 8.3 ('each built-in renders today's section component inside BuiltinPage with its SaveBarGroup') is superseded by 7.3 HH and 7.4 HK/HN, which were made later and are binding. Built-ins are drawn on the kit with their own bar over today's state, following 7.5's MeshCore built-ins. — why: the user asked for the canvas as drawn, and reviews rejected mounted Classic sections three times — cost if wrong: more redraw work than mounting.
- **L1508** Ruling: 8.3 IA — fix I1–I3. I1: draw every control a canvas note names, from today's data/calls (no new request on an interval; a preview computed client-side as today). I2: an opt-in confirm prop on the shared ListField Delete with today's words, used by responder, timer and geofence triggers. I3: Send now's confirm shows the saved message and saved channels (what the server sends); while the draft is dirty it says the unsaved edits are not sent. — why: GR and s14n* notes are spec; the confirm must show what transmits — cost if wrong: more drawn surface.
- **L1509** Ruling: 8.3 IB — promote minors:
  - M1: the MeshCore BuiltinView dirty check compares only saved keys (polled data such as Auto Ping sessions never reads as dirty) and the count counts each changed field; MeshCore behaviour as before the refactor.
  - M2: save-count tests for Forwarding and Timer Triggers; "sends nothing" tests count every non-GET request, not only fixture writes.
  - M3: in-flight guard on the door's rule switch.
  - M4: the door save loop names which built-ins saved and which failed.
  - M5: Delete by Distance follows the user's distance unit, as today.
  - M6: Timer Triggers search, the responder type filter, Auto Favorite role_warning; the admin scanner counts re-read every 30 s on that page only, moved verbatim from today (GQ).
  - M7: no Verify response toggle on channel responder triggers.
  - M8: CSS: .inline input does not hit the Convert sheet checkboxes; phone matrix checkboxes and MeshCore .search reach 44 px.
  - M9: Ignored Nodes is not counted as On unless today counts it so.
  - M10: board items backed by today's features are drawn (14-06 Import/Export if today has them; m3 word chip and the "2 other nodes, then quiet" line from settings); only items with no data are dropped, each with a Ruling line. Sends-line text per s14n1 is accepted.
  Accepted: M11 (process only).
- **L1521** Ruling: 8.3 IC — fix I4 (one query-options object shared by every observer of the scripts query, or pass scripts + refetch down; test one import with today's headers then the list re-read; an Export test). Promote re-review minors:
  - Import/Export shown to whoever today shows them to (the server's own gates stay the guard), not admin-only.
  - Airtime status/fill-line logic extracted verbatim (Rule X) and shared, removing the drift (node-name fallback, hops fallback).
  - Script test: Run disabled on an empty message; draw today's extractedParams / matchedPattern result.
  - MatchCount shows today's "no nodes match" line at 0.
  - Delete by Distance summary in the user's unit.
  - builtinIsOn('ignored-nodes') and its comment agree with the On count.
  — cost if wrong: small.
- **L1529** Ruling: 8.3 all — today's en.json titles win (Auto Acknowledge, Auto Announce, Auto Responder, Timer Triggers, Auto Key Management, Auto Traceroute, Auto Welcome, Auto Ping, Geofence Triggers, Auto Time Sync, Cutoff Airtime Utilization Threshold, Auto Favorite, Auto Heap Management, Remote Admin Scanner, Auto Delete by Distance, Ignored Nodes, and labels such as Pattern Testing, Response Matrix, Per-Sender Cooldown, Test Script, Console Output, Would Send to Mesh); must lists edited — why: D9b — cost if wrong: string swaps.
- **L1530** Ruling: 8.3 m1/n1/n4 — uppercase section titles are CSS (text-transform); must lists use sentence case — why: textContent — cost if wrong: none.
- **L1531** Ruling: 8.3 m3/n4 — "saves with the save bar" (14-06/07/08's words) for "saves as you change it" — why: the dispatch's "only on Save" and 14-x — cost if wrong: two words.
- **L1532** Ruling: 8.3 m3 — superseded by 14-08 (regex pattern, matrix); m3's word chips, "Reply to", "Reply" and "2 other nodes, then quiet" are not drawn; must list edited — why: today's model is a regex (s14n6 places auto-ack's controls on 14-08) — cost if wrong: a word-chip editor over the regex.
- **L1533** Ruling: 8.3 all — Sends lines follow the brief's wording without a leading "Sends" ("60 s cooldown per sender · …"); 14-07/08/15/16 must "Sends" replaced by the line — why: brief's examples, m1/n1 must — cost if wrong: one word per line.
- **L1534** Ruling: 8.3 14-06 — Import script / Export / Dependencies stay in Server › Scripts (7.5 Ruling, dispatch); the page lists the scripts its triggers use and links there (admins); must list edited — why: dispatch — cost if wrong: one hop.
- **L1535** Ruling: 8.3 14-06/14-07 — a trigger edits in a sheet (desktop right-docked), with the live test, script test and map inside it, not inline columns — why: D9c one sheet at a time, 7.5's lists — cost if wrong: layout.
- **L1536** Ruling: 8.3 14-06 — the script test is drawn inline in the trigger's sheet on the kit (today's request and results) instead of reusing `ScriptTestModal` — why: CR (one layer), D9c, HH — cost if wrong: env-variable list not shown.
- **L1537** Ruling: 8.3 14-07 — today's `GeofenceMapEditor` (CSS modules, BaseMap) is reused inside the sheet — why: a map widget, not a Classic form — cost if wrong: redraw.
- **L1538** Ruling: 8.3 m1 — the door's six built-ins are fixed (Auto Acknowledge, Announce, Responder, Timer Triggers, Key Management, Traceroute) — why: the board's six — cost if wrong: a different six.
- **L1539** Ruling: 8.3 m1 — Needs attention counts the rules that include this device with neither a cooldown nor a rate limit — why: s14n1's "No limit set" — cost if wrong: a chip.
- **L1540** Ruling: 8.3 n4 — Next announcement: the next cron time, or "Every N h, counted from the last save or restart" for an interval (today's scheduler does not store its arm time); the board note is reworded to what today's server does — why: no invented time — cost if wrong: one row.
- **L1541** Ruling: 8.3 all — Send now (announce) asks first; today sends at once — why: dispatch "if it transmits, it asks first" — cost if wrong: one press.
- **L1542** Ruling: 8.3 all — not drawn: Auto Welcome's sample preview, the traceroute/LocalStats matching-node preview, the responder's pattern-examples gallery and type filter, the admin scanner's 30 s re-read — why: scope; settings and actions all present — cost if wrong: these displays.
- **L1543** Ruling: 8.3 all — Delete by Distance's threshold is in km (today shows the user's unit) — why: kit field — cost if wrong: miles users convert.
- **L1544** Ruling: 8.3 all — DeviceAutomations wraps SourceProvider + SettingsProvider as the Dashboard (8.1), which adds SettingsProvider's own settings read — why: the previews' date/time formats — cost if wrong: one read per visit.
- **L1545** Ruling: 8.3 all — a built-in page's "Verify response" shows for every responder trigger (today's Done keeps it only for a DM trigger) — why: 14-06 draws it — cost if wrong: a dead toggle on channel triggers.
- **L1546** Ruling: 8.3 m3 — "Reply to" and "Reply" are not separate controls: their data is today's Active Channels / Response Matrix and Message templates, under today's labels (D9b) — why: no other data — cost if wrong: two headings.
- **L1547** Ruling: 8.3 m3 — word chips only for a plain `^(word|word)` pattern; any other regex shows the regex field alone — why: the chips edit today's `autoAckRegex` — cost if wrong: chips for complex patterns.
- **L1548** Ruling: 8.3 14-06 — Export Scripts sends the script paths (what `/api/scripts/export` validates); today's "export all" branch posts metadata objects — why: the server reads paths — cost if wrong: none (FINAL REPORT ITEM: Classic's export-all may export nothing).
- **L1549** Ruling: 8.3 14-06 — script Delete and Dependencies stay in Server › Scripts (linked) — why: 7.5 Ruling — cost if wrong: one hop.
- **L1554** Ruling: 8.3 ID — the pattern-example data stays literally in PatternExamples.tsx and is exported from there (targeted react-refresh disable); Classic source-reading tests pass unedited (Rule X).

#### Task 8.4 — Overview automations: rules, runs, trace, variables, templates

- **L1558** Ruling: 8.4 IE — fix I1/I2. I1: on the phone, Add a step and Test stay reachable from the rule's ⋯ menu while the draft has changes (the bottom row still gives way to the save dock). I2: s14n4's Tokens link is drawn in the step sheet and the Test panel; it opens Classic's substitutions reference (SubstitutionsHelp split into a reusable SubstitutionsReference, Classic markup unchanged) in a kit sheet that replaces the step/test sheet and returns with the draft intact. The implementer's Ruling not to draw the help is withdrawn. — why: canvas notes are spec; anti-goal §2 (a power user finds every control they use today); testing before saving is what makes an untested rule less risky to the mesh — cost if wrong: one more sheet.
- **L1559** Ruling: 8.4 m2/n2/14-03/14-11 — a step's and a template's parameters render with today's `BlockFields` / `FieldInput` (the catalogue's field renderer TemplateGallery already reuses) inside kit sheets, styled by the sheet's CSS module (element selectors under `.fields`, no `:global`) — why: 23 field kinds incl. geofence map, node picker, trace paths, token checks; redrawing them is a fork — cost if wrong: kit restyle of each kind.
- **L1560** Ruling: 8.4 all — a graph the steps cannot draw (If/Else ports, extra keys, version ≠ 1) opens as JSON with a banner; a save sends the saved graph untouched unless steps/JSON were edited (GR) — why: never rewrite what is not drawn — cost if wrong: such rules edit as JSON only.
- **L1561** Ruling: 8.4 m2/n2 — "Text starts with" is today's catalogue wording "Message text starts with" (field label); must lists edited — why: D9b — cost if wrong: one word.
- **L1562** Ruling: 8.4 n3 — the When… sheet lists today's 18 triggers by today's names (A message is received, A new node is discovered, A node goes silent…, Telemetry is received, A node enters/leaves a region, A repeater gains a confirmed new neighbour…); "Someone reacts" and "A traceroute finishes" do not exist today (reactions are an option of the message trigger); groups Messages / Nodes / Places / Time / Mesh / MeshMonitor; must list edited — why: D9b, no new triggers — cost if wrong: labels.
- **L1563** Ruling: 8.4 n2 — the third tab reads "Live trace" on the phone too (14-13 draws "Live trace", n2 "Trace"); must edited — why: one label — cost if wrong: one word.
- **L1564** Ruling: 8.4 m4/14-13 — no Took column: today's run row stores no duration (`createRun` sets startedAt = updatedAt); must "TOOK" dropped; "TRIGGERED BY"/"RESULT" are sentence case (CSS uppercases) — why: no invented data — cost if wrong: a column.
- **L1565** Ruling: 8.4 m4/14-13 — a run's result is read from today's status and steps: Failed (status), Skipped (no action ran; "· IF not met" when a condition was false), Sent (a transmitting action ran), Completed (another action ran) — why: today stores only completed/failed — cost if wrong: labels.
- **L1566** Ruling: 8.4 m4 — the footnote says "N sent in the last 24 h." and, for a rule with no limit, "This rule has no limit: every match gets an answer." instead of m4's "With a limit of 6 an hour, 9 would have been held back" — why: that proposes a limit (dispatch: pick no default) — cost if wrong: one line.
- **L1567** Ruling: 8.4 m4 — Runs › Export downloads the runs shown as JSON in the browser (no request) — why: the board draws it and the data is already loaded — cost if wrong: a button.
- **L1568** Ruling: 8.4 14-04 — Run now's confirm title is today's "Run this automation now?" (board: "Run Net check-in now?"), body today's two sentences, then "Would send, from the saved rule:" per step with device tags — why: dispatch "today's confirm text" — cost if wrong: a title.
- **L1569** Ruling: 8.4 all — Delete's consequences say "Its runs and their traces" without a count (the list does not read runs); the rule page's count is on its tab — why: no extra reads — cost if wrong: a number.
- **L1570** Ruling: 8.4 14-03 — install results list each rule with Open (s14n4) instead of today's auto-open of the first — why: the note — cost if wrong: one click.
- **L1571** Ruling: 8.4 m2 — name and description of a saved rule are edited from ⋯ › Name and description (a sheet) — why: the board draws neither field — cost if wrong: one hop.
- **L1572** Ruling: 8.4 all — a saved rule's PUT omits `enabled` (today sends the editor's checkbox); the header switch owns enabling — why: a save changes only what was edited — cost if wrong: none observed.
- **L1573** Ruling: 8.4 m2 — the Test panel's field labels reuse today's tester words (Message text, From node #, …) as literals, as AutomationTester does; only new copy is under `workspace.*` — why: today's words — cost if wrong: i18n of tester labels.
- **L1574** Ruling: 8.4 14-01 — the trigger chip uses a short word per trigger (Message, Telemetry, Schedule, Node discovered…) where today shows the raw type (`message`) — why: board — cost if wrong: chip words.
- **L1575** Ruling: 8.4 14-01 — the row ⋯ menu items have no second line (RowMenu draws one line) — why: shared pattern — cost if wrong: descriptions.
- **L1576** Ruling: 8.4 all — Sends lines: "Sends 1 message in #X (+ …) each time it fires / on schedule <cron> · cooldown N s · at most N per M s"; a script step reads "Runs x; its output goes out only through a later step" — why: s14n1 from saved settings only — cost if wrong: wording.
- **L1577** Ruling: 8.4 m2 — not drawn: the tester's "resolved params" details; the field-level token highlighting and checks stay — why: scope of the kit panel — cost if wrong: one detail block.

#### Task 8.5 — Device packets, info, security and quiet nodes

- **L1589** Ruling: 8.5 IF — capture-off page opens with the honest note and today's Start capturing (settings:write, server flag, 1 POST/press, nothing on the mesh) — why: dispatch "disabled state shown honestly"; the toggle is today's packet-monitor control, not a new feature — cost if wrong: hide the row while capture is off.
- **L1590** Ruling: 8.5 IG — promote minors M1 (security/quiet honours caps.deadNodes), M2 (Clear Record repeat guard), M3 (exact non-GET list in DM test; o1 Clear viewer assertion; wait-for-enabled before Save/Scan/Delete/Clear clicks — dispatch-binding), M4 (one real-MeshCorePage dmDraft seeding test), M7 (misplaced boards.ts comment) — why: cheap, and M3 is a binding test rule — cost if wrong: small.
- **L1591** Ruling: 8.5 IH — fix I1/I2. I1: InfoTab's and SecurityTab's chart and data shaping (hardware-model top 10, packets by device/type, per-type nodes, RX/TX, last message, most recently heard, availableChannels, groupDuplicateKeyNodes, mismatch status) moved verbatim into src/components/infoTabCharts.ts and src/components/security/securityHelpers.ts and shared by Classic (InfoTab, SecurityTab, App) and Workspace; the Workspace takes today's RX/TX colours. I2: sheet bodies and panel actions carry data-phone so buttons in portalled sheets reach 44 px; Tools inputs, segment buttons and group links get phone sizing. — why: Rule X (consume, don't copy); 44 px global constraint — cost if wrong: none.
- **L1592** Ruling: 8.5 all — board-check must strings changed to today's en.json wording (D9b): "Packet monitor" → "Packet Monitor" (o1, o3, q1), q2 "Packets" → "Packet Monitor" (the page title is today's nav label, as MeshCore's 8-31), "STATION G2" / "CONNECTION" / "RADIO" / "RECORDS" / "NEEDS A LOOK" → their text (CSS uppercases; Ruling Q precedent), 16-01 "Connected for" → "Connection Status", "Virtual node" → "Virtual Node Server", "Region · preset" → "Region · Modem Preset", "Hop limit" → "Hop Limit", 16-05 "Security digest" → "Security Digest", "Plain text" → "Plain Text", 16-06/16-07 "Select all" → "Select All", "Local only" → "Local Only", "days ago" → "day(s) ago", "Delete 2 nodes" → "Delete 2 node(s)"; 16-02 "Sends 1 DM…" → "sends 1 DM…" (the board's own sentence is "Send sends 1 DM to …") — why: D9b, and the checks are case-sensitive — cost if wrong: string swaps.
- **L1593** Ruling: 8.5 o1/q3 — "RAW · 58 BYTES" hex is not drawn: MeshMonitor stores no raw bytes for a Meshtastic packet (packet_log has a preview and metadata JSON). The panel is the shared raw-packet panel ("Raw packet #id") with today's "Packet Details (Full JSON)"; must "RAW" → "Raw packet" — why: no data — cost if wrong: a section if the server ever stores bytes.
- **L1594** Ruling: 8.5 16-01/o2 — "admins" next to Server is not drawn and the group is shown to every Info reader: today's Application Information and Host Metrics have no admin gate — why: D9d, no new gate — cost if wrong: a label and a gate.
- **L1595** Ruling: 8.5 o2/16-01 — summary rows are today's data only: Connected for, Online now's history, Packets 24 h, Duplicates dropped, Farthest node, Best SNR today, MQTT uplink/downlink/last publish, CPU · memory and Database are not drawn (no such read today); in their place today's Connection Status, Total Nodes / Online (the shell's count) / Total Messages / Packets TX, the two route records, MQTT enabled / server / root topic, version / timezone — why: no new request or feature — cost if wrong: new reads.
- **L1596** Ruling: 8.5 o3 — Needs a look lists the shared-key, weak-key and sending-a-lot findings (and MeshCore's collisions, signature failures, name reuse), as the board; clock-off nodes are in the Clock off list (with their DM buttons), not repeated in Needs a look — why: the board draws Clock off 2 but no clock finding — cost if wrong: one more finding kind.
- **L1597** Ruling: 8.5 o3 — tile lines use today's thresholds from the issues reply ("over 60 packets / h", "more than 5 min"); Key problems counts today's low-entropy + duplicate nodes ("1 weak, 2 shared": nodes, not groups) — cost if wrong: copy.
- **L1598** Ruling: 8.5 o3/16-02 — a "Send a DM" the viewer may not use (no messages:write) is shown off with today's reason ("You need messages:write permission to send notifications") instead of hidden as today's tab does — why: BP2 (gated items off with the reason) — cost if wrong: hide it.
- **L1599** Ruling: 8.5 o3 — today's "open node" (node name → the DM thread, after a messages:read check) opens the node's Workspace page — why: the Workspace's node page is where a node opens — cost if wrong: one navigate.
- **L1600** Ruling: 8.5 o3 — desktop keeps today's scanner status word ("Status: Active") under the subtitle, and both layouts carry the digest and Also-on-this-page sections (o3 does not draw them; 16-05 does) — why: GR — cost if wrong: layout.
- **L1601** Ruling: 8.5 o1 — the device monitor reads direct-neighbour stats for this device (`getDirectNeighborStats(24, sourceId)`); today's panel asks without a source — why: per-source scoping (the pop-out's relay modal already passes it) — cost if wrong: one query string.
- **L1602** Ruling: 8.5 o1 — type chips include Traceroute (q2's must) beside the board's six; they set today's type / encrypted filters and never replace the Filters panel — cost if wrong: one chip.
- **L1603** Ruling: 8.5 o1/q2 — with capture off the page still opens (today's tab hides it and redirects to Nodes) and says "Packet logging is off…" above whatever is stored, with Start capturing for settings:write — why: the dispatch asks for today's disabled state shown honestly; the sidebar row follows packetmonitor:read — cost if wrong: hide the row while capture is off.
- **L1604** Ruling: 8.5 q2 — on the phone Pause stays in the bar and every other head control (Filters, Export, Pop out, capture, Clear) sits under ⋯ — why: lesson 8.4 (nothing hidden on the phone) — cost if wrong: layout.
- **L1605** Ruling: 8.5 16-07 — the third bullet follows the server: MeshCore "The local node and favourites are always kept" (the route protects them); Meshtastic "The local node is never listed; favourites you tick are deleted too" (the Meshtastic route deletes any listed node; only the local node is excluded from the list) — why: a confirm says what the server will do — cost if wrong: copy.
- **L1606** Ruling: 8.5 16-06 — the confirm and button use today's label "Delete N node(s)"; the sheet title is that label + "?" — cost if wrong: copy.
- **L1607** Ruling: 8.5 all — Classic `MeshCorePage` / `MeshCoreSourcePage` / `sourceDispatch` gain an optional `dmDraft` prop (Classic never passes it; precedent `dmContact`/`dmRequest`/`mapNode`) so a MeshCore "Send a DM" pre-fills today's MeshCore DM view; the draft rides in the location state and is not cleared from history (a reload of that DM URL pre-fills it again; nothing is sent) — why: the MeshCore DM view is still today's — cost if wrong: one prop.
- **L1608** Ruling: 8.5 all — the Meshtastic DM applies a handed-over draft with today's `openDmWithDraft` and then replaces the URL with no state, so a reload does not pre-fill again — cost if wrong: none.
- **L1609** Ruling: 8.5 o2 — Info's group pages reuse today's chart widgets (PacketStatsChart, TelemetryGraphs, PacketRateGraphs, TransportSeriesGraphs, NetworkSurveyPanel, TransportBreakdown, RouteSegmentRecord, DeviceCounterNote) inside kit cards — why: they are widgets, not a view or section (HH), and redrawing charts is out of scope — cost if wrong: chart rework in 9.x.

#### Task 9.1 — Shared confirm, toasts, states, reboot wait

- **L1649** Ruling: 9.1 17-01 — titles and labels are today's (`Reboot the device?`, `Purge Node Database`, `Reset the config of G2?`, with the typed word, as today); "It cannot be undone" (today's purge body) for "This cannot be undone"; must list edited — why: D9b — cost if wrong: string swaps.
- **L1650** Ruling: 9.1 17-01 — Reboot's plain confirm adds "What happens:" and a second bullet "MeshMonitor reconnects by itself and reads its config again" (new `workspace.*` copy; true now that RebootWait follows); Purge keeps today's one paragraph (no "This removes:" list) — why: board copy where no en.json string labels it; today's body wins for Purge — cost if wrong: two strings.
- **L1651** Ruling: 9.1 17-01 — the board test collects the four states one at a time (D9c) with `joined()`; Playwright shows one state (Reboot) — cost if wrong: none.
- **L1652** Ruling: 9.1 17-03/17-10 — the wait's title is today's `reboot.title` / `reboot.title_possible` ("Device Reboot" / "Device May Restart") followed by "· Station G2"; "Elapsed: 34s" (today's format); "Configuration Error" (today's casing); the save toast is today's ("LoRa configuration saved! Device will reboot..."); must lists edited — why: D9b — cost if wrong: string swaps.
- **L1653** Ruling: 9.1 17-03/17-10 — the elapsed time shows on every step (today hides it from "Verifying…" on) — why: the board draws it at 34 s while verifying — cost if wrong: one condition.
- **L1654** Ruling: 9.1 17-03 — the board test reads the 5 s save toast when the save lands and the rest at 34 s (one board check), and mounts DeviceNotices beside the settings page over a stub socket — why: the board draws a 5 s toast beside a 34 s wait, and a socket the settings page does not hold — cost if wrong: none.
- **L1655** Ruling: 9.1 17-10 — the config banner sits at the top of the page column, above the page's own header (board: below the "‹ Settings · LoRa" bar); on desktop it spans the content column as drawn — why: pages draw their own headers; no shared slot under them — cost if wrong: a slot in each page header.
- **L1656** Ruling: 9.1 17-03 — the wait is a centred card over a light scrim that blocks the page on both sizes (board phone: inline in the page) — why: today's modal blocks the page while the radio restarts — cost if wrong: layout.
- **L1657** Ruling: 9.1 17-04 — the empty packet monitor shows no "Capture is on · keeps 5,000 packets for 7 days" line — why: not a must string; the retention settings live in settings, not in today's empty state — cost if wrong: one line and one settings read.
- **L1658** Ruling: 9.1 17-11 — Error details stays closed until opened (board: open) — why: today's AppErrorScreen `<details>` is closed (D9d) — cost if wrong: one attribute.
- **L1659** Ruling: 9.1 17-11 — Playwright reaches the route error with a Users fixture holding a `null` row (the page throws while it renders) — why: no real route throws on demand — cost if wrong: none (Vitest covers a thrown route directly).
- **L1660** Ruling: 9.1 all — `LayoutGate.tsx` keeps RouteLoading — why: it decides Classic vs Workspace in the main entry chunk, before the Workspace loads; StateView would pull UiIcon (lucide) into `main-*.js` — cost if wrong: a few KiB in the entry chunk.
- **L1661** Ruling: 9.1 all — a sent Maintenance reboot (this radio) now opens RebootWait — why: dispatch (route every Workspace reboot through RebootWait); Classic waits too (App's reconnection loop) — cost if wrong: up to 44 server requests per reboot, today's RebootModal budget.
- **L1662** Ruling: 9.1 all — the wait's connection check reads `/api/connection` without a `sourceId`, verbatim from RebootModal (the primary source's status) — why: Rule X moves the logic unchanged — cost if wrong: on a non-primary source the check can pass or fail on the wrong source's state (pre-existing in Classic).
- **L1663** Ruling: 9.1 all — DeviceNotices reads the socket with a guarded `useWebSocketContext()` (no provider → no socket) — why: the page tests stub WebSocketProvider out while keeping the real hook; in the app ChatProviders always has the provider — cost if wrong: none at runtime.
- **L1664** Ruling: 9.1 IJ — every native Meshtastic-family device page shares one DeviceSocket. Settings, Tools, Security and Automations therefore receive socket updates to their poll cache, as Classic's App does on those tabs — why: controller's Ruling IJ (device notices on every page, one socket) — cost if wrong: socket-driven `/api/poll` refetches on those pages.
- **L1665** Ruling: 9.1 I1 — StateView error's default body ("MeshMonitor hit an error…") now shows under the swept load-failure titles (Overview messages and telemetry, MeshCore Info), following the existing UsersPage and AuditPage precedent — cost if wrong: one detail line per state.
- **L1667** Ruling: 9.1 IJ — fix I2: mount DeviceNotices (and the per-source live connection it needs) once at the device-screen level, so every device page under /source/:id shows them; exactly one socket per open device, as Classic holds one per source app on every tab — no second socket where ChatProviders already has one (lift it, don't duplicate). — why: GR; Classic shows notices on every tab — cost if wrong: one socket on device pages that had none in Workspace (Classic already holds it there).
- **L1668** Ruling: 9.1 IK — promote minors M1 (ConfigBanner text token legible on Latte, as Classic's .warning-banner), M2 (local Reboot SendsLine names the connected radio, wizard_sends pattern), M3 (wait-for-enabled before clicks in 17-01, sharedFeedback, 17-03 tests — binding), M4 (App's AppBanners/configIssues gated on !shellEmbedded so the fallback shows one banner; Classic unchanged), M7 (stale RebootModal comment in useRadioSaveQueue), M8 (shrink exhaustive-deps baseline for RebootModal.tsx via `node scripts/lint-ratchet.mjs --update --rule react-hooks/exhaustive-deps`) — why: cheap; M3 binding — cost if wrong: small.
- **L1672** Ruling: 9.1 IM — device settings/tools/security/automations now hold the device's one socket (DeviceSocket), so its events update poll data and can trigger /api/poll refetches there, as Classic does on every tab — why: follows IJ; no interval, no mesh traffic — cost if wrong: extra server reads on those pages while events arrive.

#### Task 9.2 — Outlier cleanup, broker presets, news

- **L1680** Ruling: 9.2 17-07/17-14 — the confirm is a ConfirmSheet that replaces the outlier sheet (D9c), with the same title, the summary and today's confirm text; Cancel reopens the sheet at its preview (board: the confirm sits at the foot of the same sheet) — why: dispatch (today's plain confirm in ConfirmSheet, `submitOnEnter={false}`) and one sheet at a time — cost if wrong: render the confirm block inside the sheet's footer instead.
- **L1681** Ruling: 9.2 17-07/17-14 — the sheet shows a sends-nothing line ("Sends nothing on the mesh; only MeshMonitor’s stored readings change") under the preview and in the confirm — why: the board draws it and both must lists require it; it states that nothing transmits, not that something does — cost if wrong: drop two lines and two must strings.
- **L1682** Ruling: 9.2 17-07 — the Node column shows today's node id (`!penteli`), and values today's precision without a unit (`85`) (board: names, `85.0 °C`) — why: today's preview carries ids and raw values; resolving names would add a node read — cost if wrong: a nodes lookup and a unit formatter.
- **L1683** Ruling: 9.2 17-07 — the preview counts carry digit grouping ("4,812") — why: the board's must string; today printed "4812" — cost if wrong: one call.
- **L1684** Ruling: 9.2 17-07 — Settings › Data's Source picker lists every source (today's Classic Settings list), with this source picked (before: only this source) — why: draw every control today's view has — cost if wrong: one list.
- **L1685** Ruling: 9.2 all — TelemetryGraphs gains an optional `OutlierDialog` prop (default today's dialog), and the node page passes the Workspace sheet — why: the node page mounts today's charts whole (earlier ruling), so their ⋯ item can only reach the Workspace sheet through them; Classic is unchanged without the prop — cost if wrong: a Classic file edit outside the three allowed kinds; the alternative is a context.
- **L1686** Ruling: 9.2 all — MeshCore › Display's Clean outliers… also opens the Workspace sheet (it mounted the Classic dialog whole) — why: Ruling 7.3 HH — cost if wrong: none.
- **L1687** Ruling: 9.2 17-08 — the board's backdrop is the device's MQTT module page, which stays today's Classic section (Ruling 5.6) with today's BrokerPresetSelector and its Classic dialogs. The Workspace sheets are reached from the MQTT bridge page (12-13), as the dispatch directs — why: redrawing the Classic section is out of scope; changing BrokerPresetSelector would be another Classic edit — cost if wrong: a context (or prop through MQTTConfigSection) that lets the Workspace swap in BrokerPresetsSheet there.
- **L1688** Ruling: 9.2 17-08 — the bridge picker's help adds today's `mqtt_presets.description` (the bridge view never showed it) — why: the board's must string and the same control's existing en.json string — cost if wrong: one line.
- **L1689** Ruling: 9.2 17-08/17-15 — the row endpoint is today's `mqtts://host:port · root` (board: `host:port · TLS · username`); the Save as intro is today's `save_intro` (board: "Stored in MeshMonitor for every MQTT form…"); today's Manage intro is shown — why: D9b / GR — cost if wrong: string swaps.
- **L1690** Ruling: 9.2 17-08 — Edit/Duplicate's form replaces the list in the same sheet and its ×/Esc go back to the list, not close everything — why: today's Cancel returns to the list; CR (Esc closes only the top layer) — cost if wrong: one handler.
- **L1691** Ruling: 9.2 17-08 — Find topics (MqttRootFinder, today's Classic modal) stays in the preset form — why: GR, the editor has it today, and the bridge page already reuses it inside a sheet — cost if wrong: its Esc also reaches the sheet (both listen on the document).
- **L1692** Ruling: 9.2 17-09/17-16 — the badge is the item's own category (the board's sheet says Security for an item its list calls Release) — why: today's data — cost if wrong: none.
- **L1693** Ruling: 9.2 17-05/17-12/17-06/17-13 — the public pages are unchanged and outside both layouts. Differences where today wins: the board's slug `privacy-policy` (today: privacy / terms / contact), the date in the viewer's language, "Router" (board: ROUTER), and the Athens Mesh page, which is the host site's. Verified by a routing test, a content test and the Playwright shots, with no expectBoard — why: dispatch (verify only); D9d; s17n4 — cost if wrong: none to the product.
- **L1694** Ruling: 9.2 17-06/17-13 — Playwright serves `dist/embed.html` for `/embed/athens-coverage` (the preview server has no such route), and the map draws without tiles (no key or network in the test) — cost if wrong: none.
- **L1695** Ruling: 9.2 17-08 — Station G2's Modules › MQTT (today's section, Ruling 5.6) opens BrokerPresetsSheet through `BrokerPresetDialogsContext` on BrokerPresetSelector, which defaults to today's dialogs — why: Ruling 9.2 IO; the board draws the sheets there — cost if wrong: one context in a Classic file (precedent: TelemetryGraphs' `OutlierDialog`).
- **L1696** Ruling: 9.2 all — `useDashboardSources`' key and request are exported as `dashboardSourcesQuery`, so a reader can observe the shell's list without its own interval — why: no second polling observer — cost if wrong: none.
- **L1697** Ruling: 9.2 17-08 — the preset forms close on Esc only when no dialog is open inside them (replaces "Find topics' Esc also reaches the sheet") — why: CR / GR — cost if wrong: none.
- **L1698** Ruling: 9.2 IO — fix I1 (Escape closes only the topmost layer: the finder, keeping the form's values), I2 (read the sources from the shell's existing query/cache with no refetchInterval of its own — same queryFn, no second polling observer; test the observer count) and I3 by a seam: an optional prop or context on BrokerPresetSelector with today's dialogs as the default (Rule X; precedent TelemetryGraphs OutlierDialog), so the Workspace's Modules › MQTT opens BrokerPresetsSheet; Classic unchanged, Classic tests unedited; 17-08's screenshot moves to the device MQTT page as drawn. Promote minors M1 (wait-for-enabled in 17-07/17-08 tests — binding), M2 (News close ref-guarded against repeats), M5 (Edit/Duplicate keep today's Manage intro), M6 (publicPages test restores the URL). — why: CR/GR/no-second-observer are standing rulings; boards win on layout — cost if wrong: one optional prop on a Classic component.
- **L1700** Ruling: 9.2 IP — the public pages (/privacy/:slug, /embed/:profileId) are verified by routing, content and Playwright tests, not expectBoard: their must lists carry strings today's unchanged pages never render (ROUTER vs Router, slug privacy-policy, a fixed-locale date, the host site name) — why: the plan says "no change, verified only" and today wins (D9d) — cost if wrong: two board checks with edited must lists.
- **L1701** Ruling: 9.2 IQ — the outlier sheet keeps its "Sends nothing on the mesh" line, contrary to the dispatch's "no SendsLine" — why: the board and both must lists draw it and it is accurate; it states nothing transmits — cost if wrong: one line.
- **L1702** Ruling: 9.2 IR — Classic injection seams accepted: TelemetryGraphs' optional OutlierDialog prop and BrokerPresetSelector's BrokerPresetDialogsContext, both defaulting to today's dialogs — why: same class as the optional props accepted since Phase 7 (dmContact, mapNode, dmDraft); Classic DOM/behaviour and tests unchanged — cost if wrong: two optional seams to remove.

#### Task 9.3 — Remove the preview gate, enable Classic entry points

- **L1707** Ruling: 9.3 r3-classic-banner — `.banner` gets `position: sticky; top: var(--app-header-height); margin-left: var(--sidebar-width)` — why: Classic's header and icon sidebar are `position: fixed`, so the 1.8 banner, sitting in normal flow at y=0, rendered behind the header and was invisible. Its Vitest check reads the DOM and could not see this; it only showed up once the flag was on and Playwright screenshotted it. Sticky puts it below the header and beside the sidebar and keeps its own height in the flow, so it covers no Classic content (unlike Classic's `position: fixed` AppBanners) — cost if wrong: if a Classic AppBanner (TX disabled / config issue / update) shows at the same time, both sit at `top: var(--app-header-height)` and the fixed AppBanner (z-index 9999) overlaps the top of ours until it is dismissed.
- **L1708** Ruling: 9.3 gate — `useLayout` always fetches `/api/settings` and `/api/user/preferences` (Classic and anonymous users included), and `/api/config` is no longer read by the gate — why: with the gate gone, the layout depends only on those two (D3 / §5.1). The mirror still renders Classic or Workspace before they answer, so nothing waits — cost if wrong: two small extra GETs per load for Classic users; a stalled `/api/settings` keeps a Workspace-pref user on the mirror (or Classic) until it answers, as it did under the gate.
- **L1709** Ruling: 9.3 workspaceEntry — kept the `WORKSPACE_ENTRY_ENABLED` constant, now `true`, rather than deleting it — why: the brief says "`WORKSPACE_ENTRY_ENABLED = true`", and the constant is a one-line off switch — cost if wrong: one always-true conditional in UserMenu and WorkspaceBanner.
- **L1710** Ruling: 9.3 server tests — `environment.workspacePreview.test.ts` deleted; the `/api/config` test converted to assert the field is absent — why: the env test only covered the removed field; the route test now guards against the field coming back — cost if wrong: none.
- **L1711** Ruling: 9.3 r3-classic-banner — while shown, the banner is fixed top chrome (z-index 9999, top = the header's measured bottom) and sets `--app-header-height` on its shell element to header + banner height; hidden, it sets nothing — why: that variable is the one offset every Classic surface below the header reads (page padding, `.nodes-split-view`, `.section-nav`, AppBanners' `top`), so the banner is never covered and covers nothing, with no edit to nodes.css, AppBanners or App.tsx. Stacking in AppBanners' own maths was tried first and dropped: AppBanners overlay the page rather than offset it, and their 36 px slot is shorter than real banners (39 px desktop, about 82 px wrapped at 390 px) — cost if wrong: a Classic surface that hard-codes the header height instead of reading the variable would sit under the banner while it shows. None was found; the Nodes view, Channels and the AppBanners are checked in Playwright.
- **L1712** Ruling: 9.3 r3-classic-banner — with the r3 banner shown, AppBanners stack below it (r3 first) — why: they read the same extended offset — cost if wrong: a TX/config/update warning sits one banner lower than today while the offer shows (the offer is dismissable).
- **L1713** Ruling: 9.3 IN — 9.3 removes `workspacePreview` from src/server/config/environment.ts and configRoutes.ts as the plan lists — why: spec D3/D4 name this exact removal; it is the planned gate removal, not new backend behaviour, so the standing "no backend changes" does not bar it; nothing else under src/server is touched — cost if wrong: one dead config field restored (the commit is isolated, D4).
- **L1714** Ruling: 9.3 IS — fix I1: the r3 banner must be visible and clickable on every Classic tab (Nodes included) and alongside today's AppBanners. Stack it with AppBanners through their existing mechanism (fixed, offsets the content the way AppBanners already do), without moving Classic content for users who don't see the banner; Playwright shots of r3 on the Nodes route and with a TX-disabled banner showing. Promote minors: stale comment workspaceEntry.ts:5-6; dead /api/config fixture LayoutGate.test.tsx:440. — why: D18 banner must be usable; the Task 1.8 position bug only showed once the gate opened — cost if wrong: banner CSS.
- **L1715** Ruling: 9.3 IT — the drop set for D4 is cd650fe plus 9.3's fix commit(s); both are named in the final report. No history rewrite on a pushed branch. — why: D4 asks the gate removal be droppable; a fix commit on top keeps that with one extra SHA — cost if wrong: one more commit to drop.
- **L1717** Ruling: 9.3 IU — accept the --app-header-height approach over IS's "stack with AppBanners" wording — why: AppBanners never offset content and their 36 px slot is shorter than real banners, so stacking there would still cover Classic content; the variable is the one every Classic surface already reads, and it is removed when the banner hides (Classic unchanged for non-viewers) — cost if wrong: while the offer shows, AppBanners sit one banner lower; an unchecked Classic surface that hard-codes the header height would sit under the banner.

#### Final review (F.1) and fix pass (F.2)

- **L1751** Ruling: F IW — the r3 banner shows on every Classic page (Dashboard, MeshCore/ingest/Reticulum sources, unified pages), not App only — why: spec §5.2(a) — cost if wrong: banner mount points to remove.
- **L1752** Ruling: F IX — MeshCore Auto-announce Send Now asks first like the Meshtastic one; MeshCore non-flood timer Run now follows the Meshtastic timer Run now — why: 8.3 "if it transmits, it asks first", parity across protocols — cost if wrong: one extra confirm.
- **L1753** Ruling: F IY — F.2 promotes the minors listed in f2-findings.md (each ≤ ~10 lines, or a standing-rule violation: CR, submitOnEnter, phone targets, security of stored passwords); defers A1-M3/M6, A23-M2/M5/M7, B-M4/M5, C-M7 — why: plan F.2 fixes minors under ~20 lines; A23-M5 is a backend refactor and C-M7 changes today's write order — cost if wrong: small follow-ups.
- **L1754** F.2: parked — r3 banner absent from /unified/packets, /analysis, /reports, /automations, /settings — Ruling IZ: real, deferred; the D18 menu item reaches the Workspace from every page and §5.2(a)'s main surfaces (Dashboard, every source type, unified feeds) now show it — cost if wrong: five more mount points.
- **L1756** Ruling: F JA — the o2-info failure is the known cold-load board flake (failed under full-suite load at cd650fe and 930faed, green at 587f104 and df61732, 7/7 alone each time), not an F.2 regression; a test-only deflake (a longer first findBy, as 9.1 did for 10-01) is the first follow-up — cost if wrong: a real regression in the Info Radio card stays masked until that run.
- **L1757** Ruling IV — the whole-branch review is split into five parallel opus reviewers by area (A1 Classic components+App, A23 hooks/pages/contexts/services/utils/server/db + Workspace shell/layout/source/patterns/you/auth/config, B chat/map/nodes/node-page/activity/devices/overview/reports/dashboard, C settings/server, D meshcore/reticulum/automations/tools/misc), production code only, each with the same requirements, Review Focus and its slice of the deferred minors; findings merge into one list for one F.2 fix wave — why: the branch diff (~171k production lines) cannot fit one reviewer's context; opus is the most capable model this session uses — cost if wrong: cross-area issues a single reviewer would have joined up are missed (each reviewer may follow threads out of its area).
- **L1759** Ruling: F JB — JA was wrong; fix the cause in InfoPage (wait for pollData and auth before redirecting; read pollData.deviceConfig when DataContext has not taken it yet), controller inline (≈8 lines) with a sonnet scoped review — why: the deep link is user-visible; a longer timeout could not pass — cost if wrong: an unknown group on a source whose poll never answers shows Loading… instead of bouncing.

### Only in progress.md (SDD workspace, deleted after this task)

- **progress L295** Task 3.1: Ruling: I1 takes option (a) — extract trail builder + paged position-history fetch now and draw it on the device map — why: spec 15-02 (s15n0) draws history on both maps and 3.4's Produces does not cover the device map; a dead toggle is wrong behaviour — cost if wrong: 3.4 reuses the hook instead of creating it.
- **progress L333** Task 3.3: Ruling: TDD order breach recorded — code preceded tests; RED shown only by removing the route; field-coverage test was shown failing for its own reason — why: cannot be redone after the fact; the fix round's virtualisation tests must be written failing-first — cost if wrong: none beyond weaker evidence for the column persistence/drag/Alt+Arrow tests.
- **progress L654** Ruling: EI — 5.9 may reuse today's AdminCommandsTab passkey countdown: one status read on target select, plus a 1 s interval that only decrements local state and makes no request, running only while a remote target is selected. It is today's behaviour, not a new request pattern (N) — cost if wrong: drop the live countdown and show the expiry time instead.
- **progress L655** Ruling: EJ — 5.7 typed resets follow the brief and boards (typed short name, reusing 5.5's Strict typed-confirm pattern); purge keeps typed PURGE; a reset today lacks is not invented — cost if wrong: one extra typed step on a destructive action.
- **progress L656** Ruling: EK — 5.8 autosave is safe only for keys whose save neither re-arms a scheduler nor fires a send; any key that does keeps an explicit Save (mesh checklist 3, which the implementer audits per key) — cost if wrong: one inline Save row.
- **progress L827** Ruling: 6.3 — M11 (tests written after the code) is recorded; no action.
- **progress L1075** Ruling: 7.5 HS — a recurring flake gets fixed now, not re-run away: deflake task dispatched (sonnet acbde7e7cfbf63343), root cause first. 7.5 completes after it plus a full Vitest rerun.

- Ruling: F JC — fix the Task 1.8 carry now (layout-choice save failures shown to the user, Classic's toast or an inline alert), before the report is final, and have a sonnet sweep check every other `deferred → <task>` carry — why: it was marked must-fix-before-enabling and 9.3 enabled the entry points; a doc that only flags it ships a known silent failure — cost if wrong: one small UI fix and a sweep.
- Ruling: F JD — the 5 open carries go into the final report's deferred section, not this pass — why: all minor, none must-fix; the chat window is a performance follow-up that needs its own measurement — cost if wrong: a long channel renders slower in the Workspace than Classic.

### Only in f2-report.md (F.2 fix pass, commit 930faed)

- Ruling: F.2 A1-I1 — on the `.dashboard-topbar` pages and the unified pages the banner sits in the page's flow (`inline`) instead of fixed with a measured `--app-header-height`. — why: those pages place their body under the fixed topbar with `.dashboard-page`'s padding (`--dashboard-topbar-height`, deliberately not the app-wide variable, #5070); in flow, the body moves down by the banner's height with no measurement and with nothing set when hidden. The phone source drawer (fixed at the topbar's bottom) overlays the banner while it is open, as it overlays the page. — cost if wrong: while the phone drawer is open the banner is covered.
- Ruling: F.2 A1-I1 — `classicChrome.snapshot.test.tsx` (a Task 1.4 branch test, not a pre-existing Classic test) gets a `settled` condition for DashboardPage, and that one snapshot is re-recorded at the loaded state. The diff is only the sidebar's loaded data (a selected card, counts, statuses); the chrome is unchanged. — why: the old snapshot caught a mid-load frame, and the banner's two cached GETs shifted the timing. — cost if wrong: none for users.
- Ruling: F.2 A23-I1 — `maintenance/backup` maps to `#config-backup`, not to the first matching section (`config-import-export`). `data` maps to `#settings-reset-ui` (its first section). — why: the Workspace category is the backup list. — cost if wrong: the link lands one section away.
- Ruling: F.2 A23-I1 — `classicSourceLocation` (what a re-hosted App sees) splits a hash out of the fallback. `routes.test.ts` row `settings/lora?node=` now reads `/source/s1/configuration#config-lora`. — why: the fallback now carries a section; App is never mounted for device settings (Tasks 5.2, 5.9). — cost if wrong: none (unreachable for App).
- Ruling: F.2 B-I1 — the error shows as an error toast (ToastHost), not an inline banner; the draft is not restored. — why: today's Classic shows the same string and does not restore the draft (it clears the draft before the await); a toast covers every screen under ChatProviders (chat, map, nodes, node page, tools) with one component. — cost if wrong: the error is transient (today's toast timeout).
- Ruling: F.2 B-I3 — DmConversation now waits for the provider's own first-unread key (`excludeMqtt: !showMqtt`). — why: with Show MQTT off it waited on a second key the provider never pins from, and that was a second polling observer of its own. — cost if wrong: none; the provider pins from that key.
- Ruling: F.2 D-I2 (F IX) — Meshtastic timer triggers have no Run now in Classic or the Workspace, so there is nothing to match. Read IX's intent ("if it transmits, it asks first", parity): every MeshCore timer Run now asks in a ConfirmSheet. A flood advert keeps today's warning; any other trigger shows its name and "Run now sends the saved trigger once, now". MeshCore Send Now's SendsLine uses the Meshtastic wording, which names the channels (`workspace.automations.send_now_sends`). The unused `workspace.meshcore.auto.send_now_sends_*` keys were removed. — why: IX and 8.3. — cost if wrong: one extra press on a zero-hop or text Run now.
- Ruling: F.2 A23-M8 — `navigator.platform` is read once per mount (`useMemo(isMac, [])`, the existing helper), not at module scope. — why: 10-15 sets Mac and Win32 per test, and a module constant would freeze the first. The hook sits above the sidebar's early returns. — cost if wrong: one read per mount instead of zero.
- Ruling: F.2 B-M1 — `submitOnEnter={false}` was also added to the other `danger` confirms that have no input field: MeshCore message delete and channel clear, packet-log clear (pop-out), MQTT receptions clear, rule delete, variable delete. Save forms with input fields (local marker edit, position override) keep Enter. — why: the standing rule for destructive confirms; it changes nothing today. — cost if wrong: none.
- Ruling: F.2 A1-I1 — the banner renders nothing outside an AuthProvider. It reads `useAuth()` through a try/catch (`useAuthIfProvided`), always calling the hook. — why: Classic's own `UnifiedTelemetryPage.test.tsx` renders the page with no AuthProvider and must stay unedited (Rule X). A `useContext(AuthContext)` check broke the ten Classic page tests that mock `contexts/AuthContext` without exporting the context. The app always mounts an AuthProvider, so users see no difference. — cost if wrong: none.
- Ruling: F.2 A23-M3 — the stubs in `17-03-toasts-reboot.test.tsx` and `deviceSocket.test.tsx` now also return the stub socket from `useOptionalSocket` (one line each). — why: DeviceNotices now reads the socket through that hook. These are Workspace branch tests. — cost if wrong: none.

## Deferred minors

All 286 progress.md lines that record a `minor (deferred…)` entry, verbatim and grouped by task (some lines hold several minors; `final-deferred-minors.txt` is a 264-line subset of these, so it adds nothing). Items F.2 fixed are kept and marked **[fixed in F.2, <finding>]**. Lines marked `deferred → <task>` were carries into a later task; I checked only the one flagged as "must fix before enabling", which is still open. Then the F.2 "Not in this pass" list and the parked F.2 item.


**Task 0.2**

- Task 0.2: minor (deferred): contact-sheet --out default hard-coded to this session's scratchpad. **[fixed in F.2, A23-M4]**
- Task 0.2: minor (deferred): i5-receive-only absent "Message" is a substring trap if the build renders "Messages" — swap at build time.

**Task 1.1**

- Task 1.1: complete (commits f6275fe..f66ed40, review clean). Minor carried into 1.2: add committed src/server/migrations/233_add_user_preferences.pgmysql.test.ts. Minor (deferred, covered by 1.2): ≤64 key length enforced at route layer only.

**Task 1.2**

- Task 1.2: minor (deferred): none beyond those folded into fix round 1.

**Task 1.3**

- Task 1.3: minor (deferred → carry to 1.5): on a first visit with no mirror, a Workspace-only URL mounts Classic's DashboardPage catch-all whose defaultLandingPage redirect can fire before the gate resolves, losing the deep link.

**Task 1.5**

- Task 1.5: minor (deferred → Phase 5): device source /source/x/settings (no hash) opens Configuration; Settings tab root unreachable except via a category. minor (deferred → 1.6 screenshots): portaled overlays read :root offsets. minor: duplicate Settings/Toast providers (duplicate settings fetch).
- Carry to 1.6: client-side settings-category moves don't scroll to the section (SectionNav listens to hashchange; router replace doesn't fire it) — fix before shell links to categories. Minor (deferred): SectionNav decodeURIComponent without try/catch (pre-existing Classic).

**Task 1.6**

- Task 1.6: minor (deferred): RF1 Vitest asserts hardcoded data-scroll marker (real check is rail.spec.ts).
- Task 1.6: minor (deferred): rail hides scrollbar (scrollbar-width:none) — no scroll affordance with 16 devices.
- Task 1.6: minor (deferred): hash bridge double-fires on native hashchange; re-clicking same category fires nothing.
- Task 1.6: minor (deferred → Phase 2/3): device-mode Map and Nodes both link to /nodes and highlight together.
- Task 1.6: minor (deferred): no status reply (fetch fails/404) shows "Connecting" forever instead of offline.
- Task 1.6: minor (deferred): openId matchPath computed twice; .srOnly duplicated; .drawerButton repeats .square sizing.
- Task 1.6: minor (deferred): drawer toggle lacks aria-controls and focus move; test name says "header".
- Task 1.6: minor (deferred → 1.7): useWorkspaceSources polls at phone width with nothing rendered (HTTP only).
- Task 1.6: minor (deferred): source.sidebar.reports/automations keys missing from en.json (inherited from Classic DashboardSidebar).
- Task 1.6: minor (deferred): rail unread ignores unreadIndicatorEnabled preference (MapContext outside shell).

**Task 1.7**

- Task 1.7: minor (deferred): Home tab aria-current on non-device routes it doesn't link to (PhoneShell.tsx:38).
- Task 1.7: minor (deferred): disabled tabs are bare span aria-disabled, not announced (TabBar.tsx:56).
- Task 1.7: minor (deferred): switcher unread badge unlabeled (DeviceSwitcherSheet.tsx:96-100).
- Task 1.7: minor (deferred): remembered Home can be a since-disabled device (WorkspaceShell.tsx:89, YouHome.tsx:66).
- Task 1.7: minor (deferred): Sign out has no in-flight guard (YouHome.tsx:70/157).
- Task 1.7: minor (deferred): a-chat-D-phone absent check cannot fail (page is a stub).
- Task 1.7: minor (deferred): Sheet.test lacks focus-return and Shift+Tab wrap tests.
- Task 1.7: minor (deferred): rotating across 768 px remounts the re-hosted page (since 1.6).
- Task 1.7: minor (deferred → Phase 6): Sign-in & security sheet stacks today's three panels; long.

**Task 1.8**

- Task 1.8: minor (deferred → 6.4): duplicate default-source control on /server/general; section below shows stale value after a card change (no write-back).
- Task 1.8: minor (deferred): GeneralLayoutCard has no loading/error state; usage row blank on error.
- Task 1.8: minor (deferred → 9.3, must fix before enabling): banner Try it / Not now / menu item failures only logged, no user feedback. **[fixed in 3e00f28, Ruling F JC]**
- Task 1.8: minor (deferred): LayoutPage no in-flight guard (double PUT); failed prefs load shows defaults as real.
- Task 1.8: minor (deferred): setLayout hardcodes /api/user/preferences/layout beside useUserPreferences path().
- Task 1.8: minor (deferred): Server card group title reuses workspace.you.layout key.
- Task 1.8: minor (deferred): sleep-based (50 ms) negative tests in r4/r3.
- Task 1.8: minor (deferred): Try it test doesn't assert banner hides; no LayoutPage failed-save toast test.
- Task 1.8: minor (deferred → 9.3): ad-hoc media query in WorkspaceBanner.module.css.
- Task 1.8: minor (deferred): default-layout select stays disabled with no message if the admin's prefs never load.

**Task 2.1**

- Task 2.1: minor (deferred): no test for danger class / Cancel enabled / click-while-busy ignored; no tests for StateView error detail, Download button, SendsLine icon.
- Task 2.1: minor (deferred): OneTimeReveal key={s} collides on duplicate secrets; clipboard failure silent.
- Task 2.1: minor (deferred): Enter-to-submit via footer form= attribute untested.
- Task 2.1: minor (deferred): busy live region inserted pre-populated (some SRs won't announce).

**Task 2.2**

- Task 2.2: minor (deferred, plan-mandated): markAircraft returns Promise<void>, dropping applied/skipped counts needed for today's all-sources toast.
- Task 2.2: minor (deferred): requestNeighborInfo on MeshCore silently returns on non-64-hex id.
- Task 2.2: minor (deferred): message hook tests assert only body for sendTapback/resend/sendBell; no replyId DM case; rollback/dedupe/error-toast paths untested in hook tests.
- Task 2.2: minor (deferred): deleteMessage without channel rebuilds map with string keys (unused by Classic).
- Task 2.2: minor (deferred): tsconfig.tests.json error in useSourceView.test.ts:88 (mauve not in ThemeColors) pre-existing, untouched.

**Task 2.3**

- Task 2.3: minor (deferred): ChannelThread.tsx 460 lines mixing route/runtime/page — split ChannelThreadRoute + useChannelRuntime out.
- Task 2.3: minor (deferred): MessageRowD memo defeated by inline onDismissTranslation and per-render tapbacksFor arrays.
- Task 2.3: minor (deferred): ChannelInfoSheet purge closes sheets even when purge failed (purgeChannelMessages swallows errors).
- Task 2.3: minor (deferred): purge confirm names channel via channelLabel (displayName first) vs Classic's channel.name || "Channel N".
- Task 2.3: minor (deferred): Mark-all-read passes unreadCount → window.confirm Classic never shows (dead in practice).
- Task 2.3: minor (deferred): sidebar channel badges count MQTT (excludeMqtt:false) while thread/Classic exclude when Show MQTT off.
- Task 2.3: minor (deferred): a11y — MessageRowD click toggle on non-focusable div; ChannelHeaderMenu role=menu without arrow keys.
- Task 2.3: minor (deferred): renderChat.tsx patches Element.prototype.scrollIntoView globally, never restored.
- Task 2.3: minor (deferred): workspace.chat.guest_note says "Sign in…" above a "Login" button.
- Task 2.3: minor (deferred): tests written after code (RED shown by removing route).
- Task 2.3: minor (deferred): ChannelThread renders nothing while channel-db entries load (dbPending ? null) — no hang, but no StateView.
- Task 2.3: minor (deferred): CHANNEL_DB_OFFSET duplicated in ChannelsTab and channelReadAccess.ts. **[fixed in F.2, A1-M4]**

**Task 2.4**

- Task 2.4: minor (deferred): purgeNodeData swallows per-step errors; report's "stops at first failure" claim wrong for traceroute/telemetry/position steps.
- Task 2.4: minor (deferred): inline purge/delete requests duplicate App/useSourceView; Purge All Messages doesn't refetchPoll like Classic.
- Task 2.4: minor (deferred): Reticulum Organise/Data items show the MeshCore reason (workspace.node_menu.meshcore_later).
- Task 2.4: minor (deferred): NodeActionMenus.tsx ~700 lines — split PurgeSheet/TelemetrySheet; channelName/ChannelOptions filter twice.
- Task 2.4: minor (deferred): MQTT mirror Purge Data offers "Purge from Device AND Database" with a Sends line naming a deviceless source (same flaw as today's modal; server refuses).
- Task 2.4: minor (deferred): 10-01 ack "Timed out" depends on fixture NOW + 2.3's age rule.
- Task 2.4: minor (deferred): 10-01 test renders the banner and the open conversation as two states joined (Classic never shows both); board draws them as one.

**Task 2.5**

- Task 2.5: minor (deferred): no test for sendReason TX-disabled/disconnected in actionContext.
- Task 2.5: minor (deferred): 10-09 test comment says 236 bytes; string is 212.
- Task 2.5: minor (deferred): details panel and ⋯ menu don't return focus to the trigger on close/Esc.
- Task 2.5: minor (deferred): 4 tab stops per desktop row (opacity-hidden buttons) — roving tabindex later.
- Task 2.5: minor (deferred): ⋯ menu absolutely positioned inside scrolling .messages — may clip on last rows.
- Task 2.5: minor (deferred): translate counter string hardcoded English (copies Classic).
- Task 2.5: minor (deferred): swallowClick can stay true after a long-press with no following click (drag-off) → next keyboard activation on that row swallowed once (fails safe).
- Task 2.5: minor (deferred): Android contextmenu path opens no sheet if neither pointerup nor pointercancel follows (fails safe).

**Task 2.6**

- Task 2.6: minor (deferred): SearchMessages repeats SearchModal's filter JSX (scope/channel/sender option rules twice).
- Task 2.6: minor (deferred): DmList orders by timestamp, DmInbox by receivedAt ?? timestamp — Home's 5 most recent can disagree with the inbox.
- Task 2.6: minor (deferred): with no poll cached, peerOf falls back to fromNodeId → our own DMs open /dm/<local>.
- Task 2.6: minor (deferred): phone search page is aria-modal with a focus trap while the tab bar stays tappable — keyboard/AT can't reach tabs.
- Task 2.6: minor (deferred): navigator.platform (deprecated) read on every render in DeviceSidebar. **[fixed in F.2, A23-M8]**
- Task 2.6: minor (deferred): GET /api/channel-database duplicated when App is also mounted (cached, not polled).
- Task 2.6: minor (deferred): new string workspace.dms.mark_read_failed (Classic only logs).

**Task 2.7**

- Task 2.7: minor (deferred): page-2 reaction dedupe matches on packet id only (32-bit collision with another node's message could drop a group).
- Task 2.7: minor (deferred): no tests for the capped-scan branch, spoofSuspected exclusion, channel-db ≥100, MeshCore route path.
- Task 2.7: minor (deferred, security-adjacent): 404 SOURCE_NOT_FOUND before any permission check reveals source existence to anonymous callers (GET /api/sources/:id gates first) — final review to decide.
- Task 2.7: minor (deferred): shared mutable EMPTY page singletons (activity.ts:74, activityService.ts:25).
- Task 2.7: minor (deferred): Meshtastic scan counts every reply/tapback on the source; narrow via own packet ids later.

**Task 2.8**

- Task 2.8: minor (deferred): refresh refetches every loaded infinite page (N sequential 2000-row scans per message:new after Load Mores) — consider maxPages / trim to first page
- Task 2.8: minor (deferred): no pref => all loaded items unseen (first-visit badge up to 50, grows with Load More) — consider seeding pref on first view
- Task 2.8: minor (deferred): unseen dot aria-hidden, row accessible name lacks "unread"
- Task 2.8: minor (deferred): useOptionalSocket in Classic WebSocketContext.tsx — see Ruling AW
- Task 2.8: minor (deferred): -10px margin extends .device hit area 10px into neighbours (title text; unlikely overlap)
- Task 2.8: minor (deferred): rejected Mark all read test covers desktop panel only, not phone ActivityFeed path (same useMarkSeen hook)

**Task 2.9**

- Task 2.9: minor (deferred): reply/mention push replaces templated message push via shared dedup key; multi-source arrival order picks framing (Ruling AY)
- Task 2.9: minor (deferred, plan-mandated D13): notifyOnMention has MeshCore 5-min cooldown/no-DM vs Meshtastic none/DMs (Ruling AZ); 5.8 copy
- Task 2.9: minor (deferred): function-only import cycle meshtasticActivityNotifier <-> messagePushNotifier (move resolveChannelName to a util)
- Task 2.9: minor (deferred): toNodeNum optional and unused in notifier input type
- Task 2.9: minor (deferred): no test for Ruling AU cross-source own radio sender, nor mention in a DM
- Task 2.9: minor (deferred): notifier awaited before normal push (latency on busy multi-user installs)
- Task 2.9: minor (deferred): report wrongly says dedup matches MeshCore mention pattern (MeshCore has no dedup key, 5-min cooldown)

**Task 3.1**

- Task 3.1: minor (deferred): Center on Map on phone navigates to desktop /map (PhoneHome shortcut sends phones to nodes until 3.2)
- Task 3.1: minor (deferred): AJ test does not assert location.state cleared after focus
- Task 3.1: minor (deferred): MapContext coverage test checks counts, not label↔setter wiring
- Task 3.1: minor (deferred): stale comments in DeviceMapLayers.tsx:48/123/140
- Task 3.1: minor (deferred): DeviceMap.tsx:288 new Set per render to Map3DView
- Task 3.1: minor (deferred): deviceLayerGroups.tsx hardcoded 'Not available in 3D' and console.error (copied from Classic)
- Task 3.1: minor (deferred): DeviceMap.tsx 435 lines mixes several jobs
- Task 3.1: minor (deferred): NodesTab neighbour decorate block — 3 whitespace-only lines; stale 'early return above' comment **[fixed in F.2, A1-M2]**
- Task 3.1: minor (deferred): non-asset paged history refetches from page 1 on every nodes poll change (Classic parity; now also on Workspace map while a node is selected)

**Task 3.2**

- Task 3.2: minor (deferred): Packet monitor toggle offered in phone Layers sheet, panel renders under full-screen phone map; contradicts "desktop panel" ruling, untested
- Task 3.2: minor (deferred): fixed 2.5 s wait in boards.ts:270 (screenshot only; poll moveend instead)
- Task 3.2: minor (deferred): 15-21 Playwright uses dispatchEvent click (skips hit-testing)
- Task 3.2: minor (deferred): swipe hint read aloud to screen readers (NodePeek.tsx:133-135; aria-hidden)
- Task 3.2: minor (deferred): buttons-variant tiles lack aria-haspopup="dialog" and rely on host .tiles > button
- Task 3.2: minor (deferred): duplicate .srOnly in PhoneMap.module.css
- Task 3.2: minor (deferred): full Vitest predates the final Sheet portal-guard edit (only src/workspace re-run)

**Task 3.1/3.2**

- Task 3.1/3.2: minor (deferred, still open): AJ test does not assert location.state cleared

**Task 3.2**

- Task 3.2: minor (deferred): DeviceMap.tsx:254 focus waits forever if BaseMap error boundary replaces the map on phone (peek never opens)
- Task 3.2: minor (deferred): DeviceMap.tsx:259 focus effect deps omit effective3D (harmless)

**Task 3.3**

- Task 3.3: minor (deferred): NodesTable.module.css (560 lines) shared by 5 components, and :global restyling of Classic ExportMenuButton classes (NodesTable.module.css:141-177) — CSS containment
- Task 3.3: minor (deferred): column save failure swallowed (nodeColumns.tsx:137); LayoutPage reports it
- Task 3.3: minor (deferred): Alt+Arrow/drag on hidden column is a no-op (ColumnPicker.tsx:39-50)
- Task 3.3: minor (deferred): avatarStyle copies avatarToken (nodeColumns.tsx:45 vs chat/channelLabel.ts:54) — 4th copy
- Task 3.3: minor (deferred): role 0 shows "Client" on desktop table, hidden on phone list
- Task 3.3: minor (deferred): NodeFiltersSheet note "The map's More filters opens the same panel" self-referential when opened from the map
- Task 3.3: minor (deferred): toolbar wraps at 1280 px; no Role chip; phone Add from URL is a centred modal (all ruled acceptable)
- Task 3.3: minor (deferred): Online chip/count use Date.now() memoised per data change — can go stale between polls
- Task 3.3: minor (deferred): rowLayout.ts afterEach(vi.restoreAllMocks) may reset other mocks on older vitest
- Task 3.3: minor (deferred): .table tr:hover paints spacer rows (cosmetic)

**Task 3.4**

- Task 3.4: minor (deferred): "every request is a read" test snapshots early and covers Overview only
- Task 3.4: minor (deferred): invalid tab segment (node/x/bogus) falls through to re-hosted App (Ruling AD intent)
- Task 3.4: minor (deferred): renumbering notice missing from Playwright 15-03/15-16 shots (page.route available)
- Task 3.4: minor (deferred): f4 sidebar Nodes row not active on node page
- Task 3.4: minor (deferred): NodeHeader Message gate drops peek's !!node.user?.id term
- Task 3.4: minor (deferred): neighbour-info query key duplicated (Neighbours.tsx:39 vs DeviceMap.tsx:160)
- Task 3.4: minor (deferred): NodeHeader.module.css 291 lines
- Task 3.4: minor (deferred): SignalTrendBadge fallback nodeId from nodeNum — slightly more permissive than Classic's nodeIdForTrend && sourceId

**Task 3.5**

- Task 3.5: minor (deferred, ruled BH): ConfirmSheet <form> Enter-to-submit adds a keyboard confirm path for Copy (Push sends 1 NodeInfo) / Override / Merge **[partly fixed in F.2: B-M1 sets `submitOnEnter={false}` on MergeIdentitySheet; CopyNodeInfoSheet already had it (Ruling 4.5 L559); Override not checked]**
- Task 3.5: minor (deferred): ConfirmSheet doc comment still says "the one destructive-action confirm" **[fixed in F.2, A23-M6]**
- Task 3.5: minor (deferred): 15-25 check "Request" now passes on the "Request Telemetry" title — drop it
- Task 3.5: minor (deferred): new workspace.node_dialogs.telemetry_sends string + 2.4 test edit were optional (board passes with 2.4 key)
- Task 3.5: minor (deferred): merge no-undo block uses warning colour; Classic uses danger
- Task 3.5: minor (deferred): Admin-tab notice keeps its own mergeOpen, separate from NodeActionMenus dialog state (D9c across both not enforced)

**Task 3.6**

- Task 3.6: minor (deferred): local-marker delete has no busy state (double DELETE → 404 toast; REST only)
- Task 3.6: minor (deferred): GeofenceRow casts partial as Waypoint and strips English "Geofence: " prefix
- Task 3.6: minor (deferred): geofence step Cancel/Esc discards whole draft (ruled)
- Task 3.6: minor (deferred): Esc on map menu doesn't return focus to Map actions button; disabled Measure shows no reason
- Task 3.6: minor (deferred): no double-click tests; 10-min floor test never reaches validate(); long-press never exercised (e2e uses right-click)
- Task 3.6: minor (deferred): useMapEditing returns JSX (state+view mixed)
- Task 3.6: minor (deferred): second "Measure from here" at same spot while active does not reseed anchor A
- Task 3.6: minor (deferred): 10-08-message-actions Playwright flaked 2/4 under heavy load (passes alone/full)

**Task 4.1**

- Task 4.1: minor (deferred): negative landing tests use a fixed 50 ms sleep (OverviewMap.test.tsx:1332)
- Task 4.1: minor (deferred): SidebarMode still includes 'overview' but DeviceSidebar no longer handles it
- Task 4.1: minor (deferred): showList state no longer honoured on / (harmless today; add comment)
- Task 4.1: minor (deferred): overviewLanding negative assertion could miss a late redirect
- Task 4.1: minor (deferred): 10-01-dm-conversation Vitest flaked once in a full-tree run (passes alone)

**Task 4.2**

- Task 4.2: minor (deferred): phone /overview/map has fewer controls between 4.2 and 4.3 (canvas sidebar suppressed) — 4.3 handoff
- Task 4.2: minor (deferred): two usePinAuthoring instances (MapAnalysisCanvas ownPins + useOverviewPins)
- Task 4.2: minor (deferred): dead findByRole wait in analysisCoverage.test.tsx:101
- Task 4.2: minor (deferred): 2D↔3D round-trip refits Overview (MapBoundsUpdater hasFittedRef resets)
- Task 4.2: minor (deferred): nodeOptions copied from MapAnalysisToolbar into OverviewMap
- Task 4.2: minor (deferred): unused test helpers inDrawer/passthrough; TimeControl hardcodes "Time Slider"
- Task 4.2: minor (deferred): packet-flight anchors built from all analysis nodes, not markerNodes (hidden positionless MeshCore node can anchor a flight)
- Task 4.2: minor (deferred): analysisCoverage "same name" check loose (substring/short names); child controls behind parent switches not enumerated
- Task 4.2: minor (deferred): Zoom-to-fit "off with no positioned node" test asserts nothing on click; title/aria-label hardcoded English
- Task 4.2: minor (deferred): "Colour nodes by" radiogroup lacks arrow-key handling
- Task 4.2: minor (deferred): 5-01 ROLE BADGES reachable with Hop Shading off + badge-role fixture node — second-state test not written
- Task 4.2: minor (deferred): Show RF/UDP/MQTT on Overview maps to Map Analysis transports (separate persisted state from MapContext showRf/Udp/Mqtt)
- Task 4.2: minor (deferred): 5-06 "Traceroutes through this segment" left out (D9d ruling)

**Task 4.3**

- Task 4.3: minor (deferred): phone coverage matcher looser than 4.2's (exact:false; "Tools" satisfied by "Map tools")
- Task 4.3: minor (deferred): PhoneToolsSheet/PhoneMapBar use LayersDrawer.module.css; .tools > button reaches into ToolItems DOM
- Task 4.3: minor (deferred): index-based filter placement OverviewMap.tsx:307-311
- Task 4.3: minor (deferred): radio rows toggle off/no roving tabindex; Tools button aria-pressed+haspopup; Time opens sheet without focusing Time section; inspector × <44px
- Task 4.3: minor (deferred): LinkProfileDrawer.module.css :global on Classic non-Leaflet classes (precedent AnalysisInspectorPanel.module.css)
- Task 4.3: minor (deferred): 18-05 emoji picker Vitest flaked once in a wide run (passes alone)

**Task 4.4**

- Task 4.4: minor (deferred): "Show 0 issues" during filter reload / permanent 0 on /summary error; Source chips vanish meanwhile
- Task 4.4: minor (deferred): status chips fail Latte contrast (2.31:1 warning, 2.96:1 success) ReportsList.module.css:105-113
- Task 4.4: minor (deferred): "Recommendation"/"Via" drops cite Q; real cover is D9b/D9d (ruling wording)
- Task 4.4: minor (deferred): footnote_run "runs on its schedule" false when mesh_issues_enabled off
- Task 4.4: minor (deferred): /overview/reports?report=coverage without slug untested; no Workspace test that bulk Dismiss all opens today's confirm
- Task 4.4: minor (deferred): Mesh issues/Coverage pages drop the description subtitle
- Task 4.4: minor (deferred): phone finding sheet drops Classic's dismissPendingId disabled guard (sheet closes at once)
- Task 4.4: minor (deferred): .byNodePhone 52px rule uses structural selectors tied to NodeGroupSection DOM order (Playwright guards it)

**Task 4.5**

- Task 4.5: minor (deferred): 6-07 copy-preview test does not exercise initialDonorSourceId/preselectFields (fixture lacks g2 candidate) — 6-07-nodeinfo-enrichment.test.tsx:124
- Task 4.5: minor (deferred): SolarPage.tsx:98 invents key analysis.solar_monitoring.patterns (not in en.json, outside workspace.*); phone day tiles hardcode 'Low'/'OK' (copied Classic literals) — SolarPage.tsx:161
- Task 4.5: minor (deferred): explorer phone Filters count omits the range; comment says range heads the page — TracerouteExplorerPage.tsx:32
- Task 4.5: minor (deferred): fragile CSS — .targets button/label display:inline-flex overrides Classic display incl. none (reportParts.module.css:192); `> div > div` DOM-depth selectors (TracerouteExplorerPage.module.css:17, MqttViolationsPage.module.css:11)
- Task 4.5: minor (deferred): duplicate doc block useTracerouteExplorer.ts:1-7 and :62-66
- Task 4.5: minor (deferred): reportsRoutes.test.tsx dropped back-link href-per-prefix check (/reports vs /overview/reports)
- Task 4.5: minor (deferred): Classic MqttViolationsReport drill-row JSX deeply nested, mis-indented <> wrapper (MqttViolationsReport.tsx:46-47); ~2k lines Classic churn from Rule X re-indent

**Task 4.6**

- Task 4.6: minor (deferred): MeshCore reaction chips skip client readable filter (chipsByTarget from unfiltered allMessages) — OverviewMessages.tsx:207
- Task 4.6: minor (deferred): messageRowPropsEqual defeated (headExtra/footer new JSX each render) → every row re-renders per poll — OverviewMessages.tsx:179-209
- Task 4.6: minor (deferred): desktop receptions table clips at 1280 px; panel 364 px vs board ~300 px — ReceptionsPanel.module.css, OverviewMessages.module.css:109
- Task 4.6: minor (deferred): phone channel chip truncates "All Channels" — OverviewMessages.tsx:281
- Task 4.6: minor (deferred): empty-state flash while useDashboardSources loads (readable empty) — OverviewMessages.tsx:86-89,232
- Task 4.6: minor (deferred): ExportForm re-implements MessageExportDialog form JSX (~130 lines, drift risk) — ExportMessagesPage.tsx:32-164
- Task 4.6: minor (deferred): duplicate .chips .button rules — OverviewMessages.module.css:378-384
- Task 4.6: minor (deferred): row opens panel by mouse/touch only (heard-by is keyboard route); link click inside text also opens panel — OverviewMessages.tsx:159
- Task 4.6: minor (deferred): no test for re-pin when user had scrolled up (wasAtBottom false)

**Task 4.7**

- Task 4.7: minor (deferred): Paused status text in pop-out driven by autoScroll (today's no-op button)
- Task 4.7: minor (deferred): copy outside en.json — "via {relayByte}", "${r} h"; Workspace Dir cell drops today's direction_tx/rx title
- Task 4.7: minor (deferred): chart bars one colour; hook already computes per-source/type colours
- Task 4.7: minor (deferred): duplicated transport/portnum option lists, clock(), ENCRYPTED_OUTCOMES, three safeJsonParse copies
- Task 4.7: minor (deferred): MQTT canClear unscoped hasPermission (inherited from Classic)
- Task 4.7: minor (deferred): Payload "All" replaces today's "All Packets" (D9b deviation)
- Task 4.7: minor (deferred): RelayModal mounts usePoll (full /api/poll + interval) only for node names
- Task 4.7: minor (deferred): MeshCore pop-out path nests Classic PacketMonitorPage providers inside Workspace ones (auth fetched twice)
- Task 4.7: minor (deferred): Ruling Q drops without own cover — 18-01 "Search content / JSON…", "All Last Hops"; 18-04 "Close"
- Task 4.7: minor (deferred): Source column header truncates to "SOU…" (.colSource 52px); widen to ~64px
- Task 4.7: minor (deferred): Workspace packet table font 14→13px, headers 12→11px to fit the board
- Task 4.7: minor (deferred): pop-out rows carry no sourceId, so its relay estimate stays unscoped like Classic's (see FOLLOW-UP)
- Task 4.7: minor (deferred): 18-01 RSSI and Size sit behind the cue (board draws them inline)

**Task 4.8**

- Task 4.8: minor (deferred): audit time presets recompute startDate from Date.now() per fetch, so paging "Last 24 h" can skip/repeat rows (inherited from Classic's hook)
- Task 4.8: minor (deferred): Rooftop RAK and q4 phone segment request tests are hand-written, not compared with Classic
- Task 4.8: minor (deferred): None/Read/Write cells cannot create a write-only grant that Classic's independent checkboxes can (brief mandates the model)
- Task 4.8: minor (deferred): `forbidden` duplicated (UsersPage.tsx:37, usePermissionMatrix.ts:122); default channel-DB permission object written twice
- Task 4.8: minor (deferred): UsersPage.tsx 487 lines (page + two sheets), AuditPage.module.css 504 lines

**Task 5.1**

- Task 5.1: minor (deferred): hook tests stub apiService methods, so URL/method/CSRF are not asserted at HTTP level (apiService untouched)
- Task 5.1: minor (deferred): untested moved branches — security privateKey/signature-policy-changed paths, position with fixedPosition true
- Task 5.1: minor (deferred): +843 lines net, mostly three large destructure lists kept so Classic JSX stays unchanged

**Task 5.2**

- Task 5.2: minor (deferred): "loads once" test fires goTo without awaiting; lazy pages may never mount (settingsFrame.test.tsx).
- Task 5.2: minor (deferred → 5.3 dispatch): leaving a category unregisters its SaveBar entry while edits stay in shared state.
- Task 5.2: minor (deferred): modules index folds TAK on old firmware under "not on this firmware" (today shows disabled).
- Task 5.2: minor (deferred): SettingNumber phone stepper float add without rounding.
- Task 5.2: minor (deferred): AdvancedCard outside a category writes pref with empty id; hidden-modules <ul> unnamed; phone list page no <main>.
- Task 5.2: minor (deferred): purge TypedConfirmDialog busy prop untested; Backup category restyle untested; failed first /api/poll read retries every 15 s.

**Task 5.3**

- Task 5.3: minor (deferred): write order puts LoRa ('always') before Device/modules; Review's "restarts ~7 s after the last write" unverified against firmware timer start — consider writing restart sections last. FINAL REPORT ITEM.
- Task 5.3: minor (deferred): mesh checklist 3 proven at request level; no-refire-on-restart rests on existing server test (by proxy) — report must say so.
- Task 5.3: minor (deferred): LeaveGuard Discard navigates to stored path and drops a link's router state (shortcut comment); I3 tested via tablet drawer since phone settings pages hide the device switcher.
- Task 5.3: minor (deferred): fallback-label test 'Device battery ina address' goes stale if en.json gains that key.

**Task 5.4**

- Task 5.4: minor (deferred): usePins swallows write errors (rollback only); misleading test comment b-set-d4-search.test.tsx:142; list filter persists when leaving via ⌘, or header; hardcoded font stack SettingsSearch.module.css:11; search gating relies on "every option on" ask — a future stricter section gate could leak.
- Task 5.4: minor (deferred): sidebar search placeholder truncates ("Search Station G2 settin…") at desktop width.

**Task 5.7**

- Task 5.7: minor (deferred): M7 explicit Danger-zone Reboot shows no RebootModal and does not refresh config (frame saves has no onRebootDevice).
- Task 5.7: minor (deferred): firmware wizard `.wizard` has no side padding; content sits flush to the sheet edges (12-09).
- Task 5.7: minor (deferred): on a remote target Shut down skips the canShutdown gate (5.9 routes it; carried into the 5.9 addendum).
- Task 5.7: minor (deferred): M7 (see above).
- Task 5.7: minor (deferred): 12-03-share-import e2e setup waits for a transient progress text that can vanish before waitFor under load; wait on the end state (or hold the import reply) instead. Fix in F.2.

**Task 5.8**

- Task 5.8: minor (deferred): N1 MQTT bridge page does not report unsaved edits to the leave guard (as Classic; not a regression).
- Task 5.8: minor (deferred): N2 the bridge status-count test/report overstate "no extra request" (one refetch on open when the shell read earlier).
- Task 5.8: minor (deferred): N3 bridge dock stays up as "Saved" with both buttons disabled until the next edit.

**Task 6.1**

- Task 6.1: minor (deferred): M1 TDD order (disclosed), M3, M6.
- Task 6.1: minor (deferred): N1. The WaypointSheet error line (WaypointSheet.tsx:217) still uses `.pad`, so the error sits 40 px in while the fields sit at 20 px.
- Task 6.1: minor (deferred, pre-existing, CR): on a confirm stacked on another Sheet (UsersPage Manage → Deactivate/Delete, likely ChannelInfoSheet purge), Esc still closes the parent while the confirm is busy, because useDialogA11y listens on document. The final review is to triage it.

**Task 6.2**

- Task 6.2: minor (deferred): M1 logo tile blue (board yellow, --device-3); M2 autofill error hidden in recovery step reappears on Cancel (today's behaviour); M3 Reload chosen by comparing error text; M4 dialog title survives close for one commit; M5 50 ms sleep in SignInGate test.

**Task 6.3**

- Task 6.3: minor (deferred, parity D9d, one-line fix): after a local Apply, the Dark/Light theme rows show the stored value, not the applied theme; today re-seeds from context. Fix: parse={() => s.darkTheme / s.lightTheme}. The final review should take it in the fix wave.
- Task 6.3: minor (deferred): viewers without settings:write no longer see the Map & tiles managers read-only, which today they could. Also unverified: the forced-password sheet and the news popup may both show on a first sign-in, as in Classic.

**Task 6.4**

- Task 6.4: minor (deferred):
  - N1: the GeoJSON Disable-popup help text is gone, and its en.json key is orphaned.
  - N2: the {z}/{x}/{y} error shows next to the server-address autodetect help.
  - N3: focus drops to body after the RowMenu checkbox/Activate items (6.3 pattern).
  - N4: the portalled RowMenu leaves the row's Tab order while it is open.

**Task 6.5**

- Task 6.5: minor (deferred):
  - The Integrations header still says "admins only" (workspace.server.integrations_scope).
  - The 13-10 test header comment is stale.
  - Settings writers lose today's read-only view of the Privacy rows (noindex and the three disclosure URLs; SettingsTab.tsx:2312 has no gate). This is the same class as M7, so the F.2 wave should restore it.

**Task K1**

- Task K1: minor (deferred): the phone hit-area pseudo-element overlaps neighbouring rows by 9 px; the switch transitions have no reduced-motion guard.

**Task 6.6**

- Task 6.6: minor (deferred): Devices.module.css 768 lines covers page + flow; ConnectionStep exports shared form primitives (Field/Check/Advanced/PassiveMode); `endpointOf` adds an `any`; Passive Mode drawn in step 2 and step 3.
- Task 6.6: minor (deferred): the flow's Esc guard assumes nested dialogs set aria-modal; a failed result's first row may read "Connecting" (today's status word).
- Ruling: 6.6 HA — controller visual check of h2 and h4 against png3: layout, copy and the row anatomy match. Minor (deferred): h2 draws Host / IP and TCP Port 50/50, but the board has a narrow port column; h4 row menus use a vertical kebab (the shared RowMenu trigger), but the board's is horizontal.

**Task 6.7**

- Task 6.7: minor (deferred): the phone switcher's focus ring wraps only the 24 px name row, not the 44 px square; the abort listener in connectSourceAndWait is not removed when the timer fires first (bounded, ~14 ticks); a caller that joins an in-flight connect is bound to the starter's abort signal.

**Task 7.1**

- Task 7.1: minor (deferred): MeshCoreRoom.tsx carries Prettier reformatting of unrelated lines. The row "node" action lands on dm/<senderKey> (today's contact detail lives in the DM view); 7.2's dispatch re-points it to the native node page.
- Task 7.1: minor (deferred): flake — serverFields.test.tsx waits for the search dialog with findByRole's default 1 s; give it a longer timeout.

**Task 7.3**

- Task 7.3: minor (deferred):
  - the Session label truncates at 1280 px;
  - the Guest password help is clipped on 8-07;
  - the AclManager redraw has no <form>, so Enter does not apply;
  - SettingValue's data-changed uses !== instead of repeaterValuesEqual;
  - desktop History loads its first page on Console open (a server read);
  - M5: a second useMeshCore runtime when moving to the Console;
  - M7.

**Task 7.4**

- Task 7.4: minor (deferred): at 1280 px the 8-10 confirm side sheet covers the danger-zone buttons (shared ConfirmSheet pattern; s8n2 says the page stays readable).
- Task 7.4: minor (deferred): no test covers the Observer broker-password clear on Cancel; a double press on discover shows a "failed" toast although nothing is sent; the Display page's Clean outliers opens today's centred TelemetryOutlierDialog (Phase 5 precedent).

**Task 7.5**

- Task 7.5: minor (deferred, F.2 candidates):
  - (a) the region feed's receive-only line uses tx_disabled.no_local_radio_tooltip ("Open a Meshtastic source to send."), which is wrong for a MeshCore feed; use a feed-specific reason.
  - (b) the Nodes tab feeds MeshCoreNodesTable a stubbed runtime cast via `as unknown as UseMeshCoreState` with empty actions; replace with an explicit read-only prop or typed no-op actions.
  - The feed Nodes tab applies the user's age filters, so its count can differ from the header's pre-filter count.
  - Observers table columns clip at 1280 px.

**Task 7.6**

- Task 7.6: minor (deferred):
  - Rate history charts only Dashboard favourites; with none, an empty note points to Add to Dashboard. 9-03 draws every line.
  - M7: an immediate re-read on return from settings.
  - A double blank line in routes.ts.

**Task 8.1**

- Task 8.1: minor (deferred): the tile counts can differ from the view they open in three places: traceroute hop mode Direct; MeshCore contacts pathLen; MeshCore age windows and ignore list applied in the table but not the tile. useDashboardFilters may persist its own state to localStorage (today's behaviour).

**Task 8.2**

- Task 8.2: minor (deferred): none new beyond the rulings; the 8.1 reviewFixes I3 MeshCore test timed out once under parallel load (passes alone; watch for flake).

**Task 8.3**

- Task 8.3: minor (deferred): the scanner's 30 s re-read keys on the saved switch (today: the draft) — fewer requests, never more. FINAL REPORT ITEM: Classic's "export all" posts ScriptMetadata objects; the server's path check throws (AutoResponderSection.tsx:254-269, scriptRoutes.ts:980) — pre-existing Classic bug, not fixed (Rule X).
- Task 8.3: minor (deferred): word chips only for plain ^(a|b) patterns; the Server › Scripts link on the Scripts card stays admin-only (that page is admin-only).

**Task 8.4**

- Task 8.4: minor (deferred): hardcoded English outside workspace.* (RuleTest.tsx:31-53,88,99; RulePage.tsx:229,341; VariablesPage.tsx:73,116,137).
- Task 8.4: minor (deferred): RuleTest.eventFields re-encodes Classic renderEventInputs (drift risk; extract to automationTesterHelpers).
- Task 8.4: minor (deferred): step-sheet buttons 32 px (Rules.module.css:196); phone BlockFields buttons < 44 px.
- Task 8.4: minor (deferred): runsQuery staleTime Infinity — revisit shows cached runs (rules.ts:26); today re-reads per open.
- Task 8.4: minor (deferred): Runs › Export writes all runs, wording says "runs shown" (RunsTab.tsx:66-67).
- Task 8.4: minor (deferred): Run now SendsLine can read "through 0 devices" (RulePage.tsx:467).
- Task 8.4: minor (deferred): Run now did-not-fire shows detail ?? reason; today shows reason (RulePage.tsx:229).
- Task 8.4: minor (deferred): Reset homes from history not offered in JSON mode (RulePage.tsx:322).
- Task 8.4: minor (deferred): Test not gated on automations:write (route is canWrite; RulePage.tsx:299) — read-only viewer gets 403.
- Task 8.4: minor (deferred): Variables "read by" substring match (VariablesPage.tsx:162) — var.relay matches var.relayCount.
- Task 8.4: minor (deferred): TemplateWizard has no automations:read gate and reads variables/scripts/regions/rules via useBuilderData(true) (TemplateWizard.tsx:36,86).
- Task 8.4: minor (deferred): on the phone with a clean draft, Test appears both as the bottom button and in ⋯.
- Task 8.4: minor (deferred): board tests h5-offline and 7-04-telemetry-latest time out under full-suite load (findBy default timeout).

**Task 8.5**

- Task 8.5: minor (deferred): PacketTable cell() duplicates the default row's 14 cells (Time differs: clock() vs formatPacketTimestamp).
- Task 8.5: minor (deferred): 16-05 toggles are native checkboxes with role=switch; board draws switches.
- Task 8.5: minor (deferred): PacketFilters.tsx imports PacketsPopout.module.css (cross-module CSS).

**Task 9.1**

- Task 9.1: minor (deferred): DeviceNotices try/catch around a context hook to tolerate test stubs (DeviceNotices.tsx:11-17). **[fixed in F.2, A23-M3]**
- Task 9.1: minor (deferred): RebootWait aria-modal without focus capture (RebootWait.tsx:62) — today's modal has the same gap.
- Task 9.1: minor (deferred): over-long comment line in ChatProviders.tsx; reboot wait polls /api/connection without sourceId (today's RebootModal behaviour) — FINAL REPORT ITEM; Maintenance › Reboot now opens the reboot wait (≤44 server reads, nothing on the mesh) — FINAL REPORT ITEM.

**Task 9.2**

- Task 9.2: minor (deferred): NewsSheet scroll-to-top relies on Sheet's DOM (parentElement) with no test (NewsSheet.tsx:37); outlier counts digit-grouped in the summary only (OutlierCleanupPage.tsx:251-262, board).
- Task 9.2: minor (deferred): whenTopLayer assumes the finder modal is DOM-nested in the sheet; a portalled finder would close the form on Esc.

**Task 9.3**

- Task 9.3: minor (deferred): Classic page loads now resolve layout from /api/settings + /api/user/preferences (react-query, 5 min) instead of /api/config — spec §5.1 rules 2-4; FINAL REPORT ITEM. Classic chrome snapshot fixture has offerWorkspaceBanner 'true' and its selector excludes the banner, so it proves less than the plan assumed.
- Task 9.3: minor (deferred): banner overlaps content if .app-header is absent at mount (AppHeader renders first in practice).

**F.2**

- F.2: minor (deferred): Classic fallback from settings?node= drops the node (Admin Commands takes a node deep link); queued Override Frequency stays queued if Use Preset is turned on afterwards (today's Admin Commands); 8-14 and 10-07 tests click without waiting for enabled; CHANNEL_DB_OFFSET "must match server" comment lost.

**JA follow-up**

- JA follow-up: minor (deferred): a source whose /status keeps failing stays 'connecting', so a deep link to an unshown Info group shows Loading… instead of redirecting (the shell's own chips stick the same way).

### F.2 "Not in this pass" (deferred by Ruling F IY)

From `f2-findings.md`, verbatim:

> A1-M3, A1-M6, A23-M2 (FINAL REPORT ITEM: reboot wait reads primary), A23-M5 (server cyclic import — no backend change), A23-M7, B-M4 (25-line dedupe), B-M5 (note), C-M7 (would change today's write order — FINAL REPORT ITEM). Every deferred-minor triage line in the five reports said "fine to defer" except the contact-sheet path (A23-M4, above).

What each one is (from the area reviews):

- **A1-M3**: `useMeshtasticNodeActions.ts:719-766` copies MessagesTab's `handleScanForAdmin` and `AircraftMarkMenuItems`; two copies of a transmitting path can drift.
- **A1-M6**: `useReadStateSync.ts` now holds `ready` state, so Classic MeshCorePage renders once more per source switch (no DOM change).
- **A23-M2**: `useRebootWait.ts` calls `getConnectionStatus()` without a source, so on a non-primary device "Verifying connection" reads the primary radio (today's RebootModal behaviour).
- **A23-M5**: `meshtasticActivityNotifier.ts` and `messagePushNotifier.ts` import each other; move `resolveChannelName` to a util.
- **A23-M7**: `utils/coverage.ts` `splitConfirmParagraphs` strips a trailing line only when it is the English literal `Continue?`.
- **B-M4**: Drifting duplicates between `ChannelThread.tsx` and `DmConversation.tsx` (`isMine`, `nodeName`, `nodeShort`, unread-anchor memo, action context) and a fifth `avatarToken` copy in `DmHeader.tsx`.
- **B-M5**: Note only: `useUnreadCounts`' `queryFn` uses raw `fetch`; a `skipToken` reader avoids re-entering it.
- **C-M7**: `useRadioSaveQueue.ts:174` writes remote sections in `CATEGORIES` order, so a restart scheduled after a restart-causing write can land before a later 'never' section's packet.

### Parked F.2 item

- F.2: parked — r3 banner absent from /unified/packets, /analysis, /reports, /automations, /settings — Ruling IZ: real, deferred; the D18 menu item reaches the Workspace from every page and §5.2(a)'s main surfaces (Dashboard, every source type, unified feeds) now show it — cost if wrong: five more mount points.



### Found after the first draft (JB, JC, carries audit)

- JA follow-up: minor (deferred): a source whose /status keeps failing stays 'connecting', so a deep link to an unshown Info group shows Loading… instead of redirecting.
- JC: minor (deferred): Not now with layout saved but bannerDismissed failing hides the banner before its alert shows (benign: the user is on Classic, banner gone); .error has no max-width (long translations squeeze the text on desktop); menu item has no in-flight guard (two idempotent PUTs, as before); the menu failure test doesn't assert the menu stays open; .menuError sits after the mobile @media block.
- Open carries (Ruling F JD), from the sweep of every `deferred → <task>` line:
  - Workspace `ChannelThread.tsx` renders the whole channel list; Classic windows it to about 100 rows (progress L180/L192, "check in the final review"; F.1 did not).
  - Settings sidebar change dots: deferred to 9.1 and never built (also a final report item).
  - `WorkspaceBanner.module.css` still has an ad-hoc `@media (max-width: 767.98px)` query (Task 1.8 carry to 9.3, L133).
  - Classic `PacketMonitorPanel` relay estimate is still unscoped by source; the Workspace side was scoped in 8.5 (o1). Classic follow-up has no owner.
  - Portalled overlays read `:root` offsets (L78, second item); no later task resolved it.
