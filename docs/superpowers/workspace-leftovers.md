# Workspace leftovers: triage and fix plan (#6365)

Leftovers pass after the final report (`workspace-final-report.md`, HEAD 94deaa8). This file sorts every open final-report item and deferred minor into three buckets, then lists the bucket (a) fixes as tasks for this session.

## Buckets

- **(a)** Workspace-side fix of about 20 lines or fewer, with no backend change and no Classic behaviour change. Fixed this session (tasks L1 to L7 below).
- **(b)** Needs a Classic or backend change, or a product decision. Not fixed. Tags:
  - **b1**: Classic or server change.
  - **b2**: product decision.
  - **b3**: Workspace-only, but over the 20-line limit or needs a visual or design call. These are left deferred unless you say otherwise.
- **(c)** Already fixed, obsolete or not actionable. Tags:
  - **c-fix**: fixed, with the commit or code cited.
  - **c-ruled**: an accepted ruling that records today's behaviour or a deliberate design; nothing is left to do.
  - **c-info**: a process note, a test-history note or a report fact; nothing to change.

## How this was checked

- About 65 items were checked against the code at 94deaa8 by three read-only passes plus spot checks: every known candidate, every plausible (a) item, and the Classic and server items the brief named. These carry a file:line.
- The rest are bucketed by the kind of change they need: a refactor, a Classic or server edit, a ruling, or a note. They were **not** each re-opened. A b3 or c-info item might already be gone, and the bucket still holds either way.

## Known candidates (checked)

| Item | Bucket | Evidence |
|---|---|---|
| r3 banner missing on /unified/packets, /analysis, /reports, /automations, /settings (IZ) | b1 | Mounted at App.tsx:2341 and inline in UnifiedMessagesPage.tsx:279, MeshCoreSourcePage.tsx:143 and ReticulumSourcePage.tsx:133. The five pages are Classic pages (main.tsx:187-217), so this is about 2 lines each in Classic files. UnifiedTelemetryPage also has none. |
| ChannelThread renders the whole history; Classic shows about 100 | c-info (measured) | No difference from Classic. Both start from the poll's newest 100 messages per source (pollRoutes.ts:296, all channels together) and page in 100 more on scroll-to-top through the shared useMessagingView.ts:171-216. Classic has no render window: ChannelsTab.tsx:1110 is only a comment. Rows are memoised (MessageRowD.tsx:308). A Workspace-only slice would fight the shared pagination and the unread anchor (ChannelThread.tsx:195-201). Recommendation: no change. |
| Ad-hoc `@media (max-width: 767.98px)` in WorkspaceBanner.module.css | c-info | There is no shared breakpoint token or custom-media. Workspace modules use `min-width: 768px` with the phone styles as the base, and useIsPhone.ts says "phone below 768 px". 767.98px is the exact complement, so the query is correct, just written the other way round. |
| Banner `.error` has no max-width | a (L1) | WorkspaceBanner.module.css `.error` is `flex: none`. |
| Menu item has no double-click guard | a (L1) | TryWorkspaceMenuItem.tsx `choose` has no busy state. |
| Menu-failure test doesn't assert the menu stays open | a (L1) | r3-classic-banner.test.tsx:124-130 asserts only the alert. |
| Info deep link shows "Loading…" forever when /status keeps failing | a (L2) | useWorkspaceSources.ts:41-46: `statusOf` returns 'connecting' while `live` is null, and useSourceStatuses (useDashboardData.ts:252-268, `retry: false`) leaves data undefined after an error. InfoPage.tsx:235 waits on 'connecting'. The same root cause produces Task 1.6's "Connecting forever". |
| Settings sidebar change dots (DR) | b2 | Never built, so this is a new feature. |
| Ruling BI: `workspace.*` kept out of i18n coverage | b2 | The preview gate is gone. |
| Classic DM Mark All Read sends no sourceId | b1 | MessagingContext.tsx:203 `markMessagesAsRead(…, allDMs)` sends no source. |
| Classic SearchModal labels a DM by `to` and opens `from` | b1 | Classic SearchModal. |
| ApiService reads a 403 body twice | b1 | api.ts:504. A shared service. |
| Classic PacketMonitorPanel relay estimate is unscoped | b1 | The Classic follow-up has no owner. |
| Waypoint rebroadcast resend, and no rate limiter (BK) | b1 | Server. |

## Final report items

| Item | Bucket | Note |
|---|---|---|
| D4 drop set (cd650fe + df61732) | c-info | Instructions for shipping, not a defect. |
| o2-info cold deep link | c-fix | 5c04ab3, c8d4646. Its remaining minor is L2. |
| Layout-choice save failures | c-fix | 3e00f28. Its JC minors are in L1. |
| BI i18n exclusion | b2 | See the bucket (b) list. |
| BK waypoint resend, no limiter | b1 | |
| CM manual Fix All enrichment is unpaced | b1 | Needs a pacing limit, which needs your call. |
| DA a Users save clears MeshCore `remote_admin` grants | b1 | |
| Classic relay-estimate pools sources | b1 | |
| DM settings read /api/poll once, with no 30 s refresh | c-ruled | Fewer requests than today, and no new timer. |
| DP, ED, GI-a: the leave guard misses browser Back | b2 | Needs a router blocker, which means changing the router. |
| DR change dots | b2 | |
| EL MQTT keeps its own save bar | c-ruled | |
| 5.3 / C-M7 remote write order (restart sections not last) | b2 | Changes today's write order. |
| ER Firmware page not restyled | b3 | A 1,500-line flash flow. |
| GC remote Bluetooth; GE/GH remote config-URL share and import are Classic-only | b2 | |
| GF remote module locks seeded as supported | c-ruled | Today's behaviour. |
| GG-a remote JSON export may be stale | c-ruled | |
| GI-b Classic remote URL import drops sourceId | b1 | |
| GI-c PRIVACY: an elided positionPrecision maps to 32 | b1 | Still at channelLoadingUtils.ts:64. |
| SECURITY: /api/solar/trigger has optionalAuth only | b1 | solarRoutes.ts:81. |
| No cooldown on "Run analysis now" / "Fetch Estimates Now" | b1 | |
| GZ-M5 Edit re-enables a disabled source (both layouts) | b2 | Changing the body would make the layouts diverge. |
| HC phone status line is 30 px | c-ruled | |
| h5/i4 no connection history or "offline since" | b1 | Needs a server field. |
| Remote admin allows 10 attempts | c-ruled | Today's behaviour. |
| News auto-open before GO | c-fix | Built in Task 9.2 (GO). |
| Not built in 6.6: serial-port list, device colour, per-bridge rewrites | b1 | No endpoint or stored field exists. |
| HI canvas note s8n2 misstates the reboot guard | c-info | A canvas note; no code. |
| HM a channel key shown as 4+4 hex to writers | c-ruled | |
| HO / HU narrower per-source checks | c-ruled | Follows the CLAUDE.md per-source rule. |
| 7.4 undrawn MeshCore pages keep Classic sections | b3 | |
| HP / 8.3 / 8.4 server re-arms on save (auto-announce, traceroute, LocalStats, time sync, geofence, distance delete, cron reschedule, baselines, trace-path) | b1 | Server schedulers. |
| HR re-hosted MeshCore views with no boards | b3 | No canvas exists for them. |
| 7.6 LXMF composer shows "N/200" | c-fix | The counter is gone; 9-01-reticulum-shell.test.tsx:128 asserts it is absent (00c54cd). |
| 7.6 Reticulum dashboard mounts the shared grid whole | c-fix | ReticulumDashboardPage.tsx:13 mounts DeviceDashboard (2cda6d8, Task 8.1). |
| Build memory / container restarts | c-info | |
| HV sort replaced by the user's order | c-ruled | The filters were restored. |
| 8.3 Classic "export all" posts metadata | b1 | AutoResponderSection.tsx:254-269. |
| 8.3 per-source Auto Key Management / Remote Admin Scanner saves wait for a reconnect | b1 | |
| 8.3 Auto Welcome per source doesn't mark existing nodes | b1 | Unverified server behaviour. |
| 8.4 Run now with no device in a sending step | c-ruled | The confirm says so. |
| 8.4 rules with no limit (Weather bot, Net check-in) | b2 | Mesh checklist: ask before choosing a limit. |
| 8.5 Quiet nodes bulk delete doesn't protect favourites | b1 | |
| 8.5 Pop out opens the primary's window | b1 | The window takes no source. |
| 8.5 Radio card shows LocalStats | c-info | |
| 9.1 / A23-M2 reboot wait reads /api/connection without sourceId | b1 | useRebootWait is shared with Classic RebootModal. |
| Maintenance › Reboot opens the wait | c-ruled | |
| Board-test cold-load findBy timeouts under load | c-info | Pre-existing; the gate runs had 0 failed. |
| 9.3 Classic layout resolution via /api/settings + prefs; IU banner stacking | c-ruled | |
| messageRoutes DELETE /:id uses `channel !== 0` (DMs are -1) | b1 | Still at messageRoutes.ts:245. |

## Deferred minors, by task

Items checked in this pass carry a file:line. The others are bucketed by kind (see "How this was checked").

**0.2.** i5 "Message" substring trap: c-info (a build-time note). Contact-sheet path: c-fix (F.2 A23-M4).

**1.1 / 1.2.** Key length enforced at the route only: c-info (1.2 covered it). 1.2 had no minors.

**1.3.** Deep link lost to the Classic catch-all before the gate resolves: c-fix. The gate is gone (cd650fe), and the mirror renders first.

**1.5.**
- /source/x/settings with no hash: c-fix (Phase 5 settings frame).
- Portalled overlays read `:root` offsets: b3. It needs a screenshot survey of every portal.
- Duplicate Settings/Toast providers: b3.
- Category moves don't scroll: c-fix (resolved by the 1.6 carry, per JD's sweep).
- SectionNav decodeURIComponent: b1 (Classic).

**1.6.**
- RF1 asserts a data-scroll marker: c-info.
- Rail hides its scrollbar: b2 (design).
- Hash bridge double-fires: b3.
- Map/Nodes highlight together: c-fix (Phase 3 gave the map its own route).
- No status reply → "Connecting" forever: **a (L2)**, the same cause as JA.
- openId/.srOnly/.drawerButton duplication: b3.
- Drawer toggle lacks aria-controls and a focus move: **a (L2)**, WorkspaceShell.tsx:262-267.
- Phone-width polling: c-fix (1.7 carry, per JD).
- source.sidebar.reports/automations keys: c-info. Both call sites pass English defaults (overviewTools.ts:31,35; DashboardSidebar.tsx:1098,1106).
- Rail unread ignores the unreadIndicatorEnabled preference: b3.

**1.7.**
- Home tab aria-current on routes it doesn't link to: **a (L2)**, TabBar.tsx:87 / PhoneShell.tsx activeTab.
- Disabled tabs are bare spans: **a (L2)**, TabBar.tsx:77.
- Switcher unread badge has no label: **a (L2)**, DeviceSwitcherSheet.tsx:94-97.
- Remembered Home can be a disabled device: b3.
- Sign out has no in-flight guard: **a (L1)**, YouHome.tsx:91.
- a-chat-D-phone check cannot fail: c-info.
- Sheet focus-return tests: b3.
- Rotation remounts: c-ruled.
- Sign-in sheet is long: c-fix (Phase 6 redrew it).

**1.8.**
- Duplicate default-source control: c-fix (6.4 carry, per JD).
- GeneralLayoutCard has no loading/error state, and the default-layout select stays disabled silently: **a (L1)**, GeneralLayoutCard.tsx:53-55,125-129.
- Must-fix banner failures: c-fix (3e00f28).
- LayoutPage double PUT: **a (L1)**, LayoutPage.tsx `choose`/`save`. Failed prefs load shows defaults: b3.
- setLayout hardcodes its path; Server card reuses a key; 50 ms sleeps; Try-it test doesn't assert the hide: b3/c-info (test hygiene).
- Ad-hoc media query: c-info (see above).

**2.1.** Missing tests, the OneTimeReveal key collision, clipboard silence, form= Enter untested, pre-populated live region: b3. These are test additions and small a11y changes with no user report.

**2.2.**
- markAircraft counts: c-ruled (plan-mandated).
- requestNeighborInfo on MeshCore returns silently: b3.
- Hook test gaps: b3.
- String-key map: c-info (unused).
- tsconfig.tests error: b1 (pre-existing test type).

**2.3.**
- ChannelThread split: b3.
- MessageRowD memo defeated: b3 (needs profiling).
- ChannelInfoSheet purge closes on failure: **b1**. purgeChannelMessages is the shared useMeshtasticMessageActions.ts:275, it swallows errors, and App also uses it. A fix means returning a result from a Classic hook.
- Purge label vs Classic: c-ruled.
- Mark-all-read confirm is dead: c-info.
- Sidebar badges count MQTT: b3.
- MessageRowD and menu a11y: b3.
- renderChat scrollIntoView shim: c-info (`??=`; jsdom lacks the method, so it is harmless).
- guest_note says "Sign in" above a "Login" button: **a (L3)**, en.json:9269 vs auth.login.
- Tests after code: c-info.
- dbPending renders nothing: **a (L3)**, ChannelThread.tsx `dbPending ? null`.
- CHANNEL_DB_OFFSET: c-fix (F.2 A1-M4).

**2.4.**
- purgeNodeData swallows errors; inline purge duplicates App; no refetch: b1/b3 (shared request paths).
- Reticulum Organise/Data reason: c-info. No Reticulum node menu is reachable; every caller passes meshtastic, mqtt or meshcore (NodeActionMenus.tsx:106-112).
- NodeActionMenus is about 700 lines: b3.
- MQTT mirror purge option: b1 (today's modal flaw).
- 10-01 fixture/NOW and two-state test notes: c-info.

**2.5.**
- No sendReason test: b3.
- 10-09 comment says 236 bytes: **a (L7)**. It is 212 (10-09-translate.test.tsx:24).
- Focus return from the details panel / ⋯ menu: b3.
- 4 tab stops per row: b3 (roving tabindex).
- ⋯ menu clipping: b3 (visual).
- Hardcoded translate counter: c-ruled (copies Classic).
- swallowClick / contextmenu edge cases: c-info (fail safe).

**2.6.**
- SearchMessages duplicates SearchModal JSX: b3.
- DmList vs DmInbox ordering: **a (L3)**, DmList.tsx:44 vs DmInbox.tsx:97.
- peerOf with no poll opens /dm/<local>: **a (L3)**, SearchMessages.tsx:63,91-92.
- Phone search page traps focus away from the tab bar: b3.
- navigator.platform: c-fix (F.2 A23-M8).
- Duplicate channel-database GET: c-info (cached).
- mark_read_failed string: c-info.

**2.7.**
- Reaction dedupe on packet id; missing tests; EMPTY singletons; scan counts: b3.
- 404 before the permission check reveals source existence: b1 (server; security-adjacent).

**2.8.**
- Refetch of every loaded page; first-visit badge: b3.
- Unseen dot hidden from AT: **a (L3)**, ActivityList.tsx:135,140.
- useOptionalSocket: c-ruled (AW).
- -10px margin: b3.
- Phone mark-all-read test: b3.

**2.9.** Push dedup framing, MeshCore vs Meshtastic mention parity, the import cycle (A23-M5), the unused field, missing tests, awaited notifier, report wording: b1. All server-side.

**3.1.**
- Center on Map on phone: c-fix (3.2 added the phone map).
- AJ state-cleared assertion; MapContext coverage test: b3.
- Stale comments, new Set per render, hardcoded "Not available in 3D", DeviceMap size: b3.
- NodesTab whitespace: c-fix (F.2 A1-M2).
- Paged history refetch: c-ruled (Classic parity).

**3.2.**
- Packet monitor toggle in the phone Layers sheet: b2 (needs a ruling on desktop-only).
- Fixed 2.5 s wait; dispatchEvent click: b3 (e2e).
- Swipe hint read aloud: **a (L3)**, NodePeek.tsx:133.
- Tile aria-haspopup: b3.
- Duplicate .srOnly: c-fix. PhoneMap.module.css has one (line 99).
- Old Vitest run: c-info.
- Focus wait behind the error boundary; effect deps: b3.

**3.3.** NodesTable CSS size and `:global` reach; column save failure swallowed; hidden-column no-op; avatarStyle copy; role 0 label; self-referential note; toolbar wrap (ruled); Online chip staleness; restoreAllMocks; spacer hover: b3 or c-ruled. None is a user-facing bug that fits 20 lines with no visual call.

**3.4.**
- Test scope notes; invalid tab segment (AD); renumbering shots: c-info/c-ruled.
- f4 sidebar Nodes row not active on the node page: **a (L2)**, DeviceSidebar.tsx:76,132.
- Message gate term; duplicate query key; CSS size; SignalTrendBadge fallback: b3.

**3.5.**
- Override sheet has no `submitOnEnter={false}`: c-info. OverridePositionSheet saves locally and transmits nothing (usePositionOverrideForm.ts:4), so the standing rule does not apply.
- Doc comment: c-fix (F.2 A23-M6).
- 15-25 "Request" check is trivial: **a (L7)**, 15-25-request-telemetry.json.
- Telemetry string: c-info.
- Merge colour: b2.
- Admin-tab mergeOpen: b3.

**3.6.**
- Local-marker delete has no busy state: c-fix. DeleteMarkerSheet passes `busy` (LocalMarkerSheet.tsx:113-131).
- GeofenceRow cast; geofence Cancel (ruled); missing tests; useMapEditing returns JSX; Measure reseed; 10-08 flake: b3/c-ruled/c-info.
- Esc on the map menu doesn't return focus: **a (L3)**, MapContextMenu.tsx:79-83. The disabled Measure reason: b3.

**4.1.** 50 ms sleeps; stale SidebarMode member; showList; negative assertion; 10-01 flake: b3/c-info.

**4.2.** All 13: b3 or c-ruled. The phone handoff was resolved by 4.3; the two pin instances, the 3D refit, the copied nodeOptions, the radiogroup arrows and the test gaps are each over 20 lines or need a design call; 5-06 is D9d.

**4.3.** Matcher looseness; CSS reach; index placement; radio rows / Tools aria / inspector size; `:global` precedent; 18-05 flake: b3/c-info.

**4.4.**
- "Show 0 issues" during reload: b3.
- Latte contrast of the status chips: c-fix. The text is `var(--color-text)` and the tone moved to the border and tint (ReportsList.module.css:99-113).
- Ruling wording: c-info.
- footnote_run claim: c-fix. en.json:8818 now says "when that is on or when you run it".
- Untested coverage URL; subtitle drop: b3.
- Phone finding sheet guard: c-info. The sheet closes on the first press (MeshIssuesPhoneSections.tsx:156-159).
- .byNodePhone selectors: c-info (guarded by Playwright).

**4.5.**
- 6-07 test gap; fragile CSS; duplicate doc block; back-link check; Classic Mqtt re-indent: b3/c-info.
- SolarPage invented key and hardcoded "Low"/"OK": **a (L7)**, SolarPage.tsx:98,161.
- Explorer filter count: c-fix (TracerouteExplorerPage.tsx:36-48).

**4.6.** Reaction chip filter; row re-render per poll; receptions clip; empty-state flash; ExportForm copy; duplicate rules; mouse-only row; re-pin test: b3. The phone channel chip truncation is b3 too: it needs a screenshot first.

**4.7.**
- Paused text; D9b "All"; Ruling Q drops; font size; RSSI behind the cue: c-ruled.
- "via {relayByte}" and "${r} h" outside en.json: **a (L7)**, PacketDetailPanel.tsx:86 and OverviewPackets.tsx:200, plus three tests.
- One-colour chart; duplicated option lists: b3.
- MQTT canClear unscoped: b1 (inherited).
- RelayModal mounts usePoll: b3.
- Pop-out nested providers: b3.
- Source column truncates: **a (L7)**, PacketStream.module.css:55.
- Pop-out relay unscoped: b1 (needs sourceId on rows).

**4.8.** Time presets; hand-written tests; write-only grant (brief-mandated); duplicates; file sizes: b1/b3/c-ruled.

**5.1.** apiService stubs; untested moved branches; destructure lists: b3/c-info.

**5.2.**
- "Loads once" test; a SaveBar entry dropped on leave (5.3 carry, resolved per JD): b3/c-fix.
- TAK fold: c-ruled.
- Stepper float: c-fix. SettingNumber.tsx:49 rounds to the step's places.
- AdvancedCard empty id; unnamed list; no `<main>`; untested purge busy; 15 s retry: b3.

**5.3.**
- Write order: b2 (see C-M7).
- Request-level proof: c-info.
- Discard drops router state: c-ruled (shortcut comment).
- Fallback-label test: c-info.

**5.4.**
- usePins swallows write errors: **a (L6)**, usePins.ts:18.
- Misleading comment; filter persists; font stack; gating note: b3.
- Placeholder truncation: b3 (visual).

**5.7.**
- Danger-zone Reboot shows no RebootModal (M7): b3.
- Firmware wizard has no side padding: **a (L7)**, Maintenance.module.css:190-195 (check the Sheet first).
- Remote Shut down gate: c-fix (5.9 routed it).
- 12-03 e2e wait: c-fix (named "Fix in F.2"; F.2 promoted it).

**5.8.**
- N1 bridge leave guard: c-ruled (as Classic).
- N2 report wording: c-info.
- N3 "Saved" dock: c-info. No bridge dock was found in src/workspace now.

**6.1.**
- M1/M3/M6: c-info.
- WaypointSheet error indent: **a (L3)**, WaypointSheet.tsx:217.
- **Esc on a stacked confirm closes the parent (CR): a (L4).** useDialogA11y listens on `document`, so every open Sheet closes on one Esc. UsersPage works around it (UsersPage.tsx:303), but a busy confirm still loses its parent. ChannelInfoSheet (ChannelInfoSheet.tsx:87,190) has no workaround. The fix is a top-layer check in the Workspace Sheet, not the shared hook.

**6.2.** Logo colour; autofill error; Reload by text; title survives; 50 ms sleep: b3/c-ruled.

**6.3.**
- Theme rows show the stored theme after a local Apply: **a (L6)**, AppearancePage.tsx:96,106.
- Map & tiles managers hidden from viewers: b3. The gate is write (MapTilesPage.tsx:58); read-only managers are 15 to 30 lines.
- Forced-password + news on first sign-in: c-info (unverified, as Classic).

**6.4.**
- N1 orphaned GeoJSON hint: **a (L7)**. `workspace.server.geojson_no_popup_hint` (en.json:9108) is unused.
- N2 error placement: b3 (visual).
- N3/N4 RowMenu focus: b3.

**6.5.**
- Integrations header says "admins only": **a (L6)**. The page is gate="write" (IntegrationsPage.tsx:69; en.json:9204).
- 13-10 stale comment: b3.
- Privacy rows hidden from non-admin readers: **a (L6)**, SecurityPrivacyPage.tsx:57-70.

**K1.**
- Switch transitions have no reduced-motion guard: **a (L2)**, kit.module.css:156,168.
- 9 px hit-area overlap: b2. Shrinking it drops the 44 px phone target.

**6.6.**
- Devices CSS size; shared primitives; the `any`; Passive Mode twice: b3.
- Esc guard assumes aria-modal: c-info (covered by L4's top-layer check).
- "Connecting" first row: c-ruled.
- HA port width / kebab: b3.

**6.7.**
- Phone switcher focus ring: b2 (design).
- Abort listener left on the signal: **a (L2)**, useSourceForm.ts:587-588.
- Joined connect bound to the starter's signal: b3.

**7.1.**
- Prettier churn: c-info.
- Node action target: c-fix (7.2 re-pointed it).
- serverFields findByRole 1 s: **a (L7)**, serverFields.test.tsx:25,39.

**7.3.**
- Session label / guest help clipping: b3 (visual).
- AclManager has no `<form>`: **a (L6)**.
- SettingValue uses `!==`: **a (L6)**, SettingValue.tsx:38 vs RepeaterSettingsCategory.tsx:176.
- History first page; second runtime (M5); M7: b3.

**7.4.**
- The 1280 px confirm covering the buttons: b3.
- Observer clear test: b3.
- Discover double press shows "failed": **a (L6)**, DiscoverMenu.tsx:51 / sweepStore.ts:30.
- Clean outliers dialog: c-ruled.

**7.5.**
- (a) Receive-only line says "Open a Meshtastic source": **a (L7)**, ReadOnlyNote.tsx:45,62; RegionFeedPage.tsx:476.
- (b) Stub runtime cast: b3. It is about 30 lines and touches the useMeshCore types.
- Age filters vs header count: b3.
- Observers clip: b3.

**7.6.**
- Rate history charts only favourites: b2.
- M7 re-read: b3.
- Double blank line: b3.

**8.1.** Tile vs view count differences; useDashboardFilters localStorage: b3/c-ruled.

**8.2.** None new: c-info.

**8.3.**
- 30 s re-read keyed on the saved switch: c-ruled.
- Classic export-all: b1.
- Word chips; admin-only link: c-ruled.

**8.4.**
- Hardcoded English in RuleTest/RulePage/VariablesPage (about 35 strings): b3 (about 80 lines).
- RuleTest field re-encoding: b3.
- Step-sheet buttons 32 px on phone: **a (L5)**, Rules.module.css:196-197.
- runsQuery staleTime Infinity: b3.
- Runs › Export: **a (L5)**. Verify the wording; RunsTab.tsx:66-67 exports `runs`, not `shown`.
- "through 0 devices": **a (L5)**, RulePage.tsx:484.
- Did-not-fire detail vs reason: b2.
- Reset homes in JSON mode: b3.
- Test not gated on automations:write: **a (L5)**, RulePage.tsx:294,308-311,419.
- "read by" substring match: **a (L5)**, VariablesPage.tsx:162.
- TemplateWizard read gate: b3.
- Phone Test appears twice with a clean draft: **a (L5)**, RulePage.tsx:294.
- Board timeouts: c-info.

**8.5.** PacketTable cell copy; native switches; cross-module CSS: b3.

**9.1.**
- DeviceNotices try/catch: c-fix (F.2 A23-M3).
- RebootWait aria-modal has no focus capture: **a (L4)**, RebootWait.tsx:62.
- Long comment line: b3.

**9.2.** NewsSheet scroll test and digit grouping; whenTopLayer and a portalled finder: b3/c-info. A portalled finder does not exist today.

**9.3.** Classic layout resolution: c-ruled. The banner with no `.app-header` at mount: c-info (AppHeader renders first).

**F.2 minors.**
- settings?node= drop; queued Override Frequency: b1 (Classic Admin Commands behaviour).
- **8-14 and 10-07 click without waiting for enabled: a (L7)**, 8-14-automations.test.tsx:38-55 and 10-07-dm-conversation.test.tsx:24-25.
- Lost "must match server" comment: b3.

**F.2 "Not in this pass".**
- A1-M3 duplicated transmitting path: b3.
- A1-M6 one extra render: c-info.
- A23-M2 reboot wait source: b1.
- A23-M5 server import cycle: b1.
- A23-M7 English "Continue?" literal in utils/coverage.ts:397: b1. The file is shared with Classic CoverageMqttRecordingSection.
- B-M4 chat duplicates: b3.
- B-M5 raw fetch note: c-info.
- C-M7 write order: b2.

**Parked F.2 item.** r3 banner on five more pages: b1 (see the known candidates).

**JC minors.**
- Not now hides the banner before its alert: c-info (benign; JC says so).
- `.error` max-width; `.menuError` order; menu in-flight guard; menu-open assertion: **a (L1)**.

**JD open carries.**
- ChannelThread window: c-info (measured above).
- Change dots: b2.
- Media query: c-info.
- Classic relay estimate: b1.
- Portalled overlays and `:root`: b3.

**JA.** Info "Loading…" when /status keeps failing: **a (L2)**.

## Bucket (b): short list for the requester

See the chat summary for recommendations. Every b1/b2 item is in the tables above. The b3 items stay deferred as one group.

## Outcome

All seven tasks are done (00e5608..a8d5f6d), plus a final-review fix wave (b4fb1ff). L6 item 5 was not done (Ruling JI). Evidence and rulings are in the final report's "Leftovers pass" section.

## Fix tasks (bucket a)

Standing rules for every task:
- The design boards win on layout.
- Rule X: Classic changes only by behaviour-preserving extraction, and Classic tests need no edits.
- No new intervals.
- Never add a second polling observer to a query the shell already polls.
- Escape closes only the top layer.
- `submitOnEnter={false}` on confirms that transmit or destroy.
- Tests wait for a button to be enabled before clicking it.
- Guard keyboard sends against key repeat.
- No backend change. Locale edits go in `public/locales/en.json`, under `workspace.*` keys only.
- Each item stays at about 20 lines or fewer. If an item turns out bigger, or needs a Classic edit, stop and report it instead of doing it.

### Task L1: banner, menu item and layout saves

1. `src/components/WorkspaceBanner/WorkspaceBanner.module.css`:
   - Give `.error` a max-width (about `40ch`) so a long translation cannot squeeze the banner text.
   - Move `.menuError` above the mobile `@media` block.
2. `TryWorkspaceMenuItem.tsx`: add an in-flight guard. While the save is pending, the button is disabled and a second click does nothing.
3. `r3-classic-banner.test.tsx` (around lines 124-130, the failed-save menu test): also assert that the menu is still open after the failure (the "Try the Workspace layout" item is still in the document).
4. You › Layout (`LayoutPage.tsx`): give `choose` and `save` an in-flight guard, so the controls are disabled while a PUT is pending.
5. `GeneralLayoutCard.tsx`:
   - Show a loading note and an error note for the install-settings query, using StateView or the card's existing note style.
   - When the admin's prefs fail to load, the default-layout select says why it is disabled instead of staying silently disabled. Add `workspace.*` keys as needed.
6. `YouHome.tsx:91` Sign out: add an in-flight guard (disabled while signing out; no second call).
7. Add tests for 2, 4 and 6: a double click sends one request.

### Task L2: shell status and shell accessibility

1. Shell status for a source whose `/status` never answers.
   - Problem: `useWorkspaceSources.ts:41-46` `statusOf` returns 'connecting' while `live` is null. `useSourceStatuses` (`hooks/useDashboardData.ts:252-268`, `retry: false`) leaves data undefined after an error, so the source shows "Connecting" forever, and `InfoPage.tsx:235` shows "Loading…" forever on a deep link to an unshown Info group.
   - Fix: when the status query for that source is in error with no data, report 'offline'. Read the error state passively from the same cached query, as the `useCachedSourceStatus` pattern at `useDashboardData.ts:276` does: an observer with `enabled: false` on the same key. It must make no new request, no new interval and no second polling observer.
   - The query key's auth element comes from `useDashboardAuthGate`. Derive it the same way, or export the existing helper without changing its behaviour.
   - Add a test: a source whose status request fails shows offline, and the Info deep link redirects to `info`.
2. `DeviceSwitcherSheet.tsx:94-97`: label the unread badge for screen readers. Mirror TabBar.tsx:67 / PhoneShell.tsx:187: hide the badge from AT and put `workspace.shell.device_unread` in the row's name.
3. `TabBar.tsx:77`: a disabled tab must be announced as a disabled link. Use `role="link"` with `aria-disabled`.
4. `TabBar.tsx:87` / `PhoneShell.tsx` activeTab: set `aria-current="page"` only when the current path is under the tab's `to`. Today Home is marked current on `/overview/*` routes it does not link to.
5. `WorkspaceShell.tsx:262-267`, the desktop/tablet drawer toggle:
   - Add `aria-controls` that points at the drawer's id.
   - On open, move focus into the drawer. On close by Esc or by the toggle, return focus to the toggle.
6. `DeviceSidebar.tsx:76,132`: the Nodes row is also active on the node page (`/source/:id/node/:nodeId`).
7. `settings/kit/kit.module.css:156,168`: add `@media (prefers-reduced-motion: reduce)` to turn off the `.switch` and `.switch::after` transitions.
8. `useSourceForm.ts:587-588` (connectSourceAndWait): remove the abort listener when the timer fires first.

### Task L3: chat, DMs, activity, map

1. `ChannelThread.tsx`: while `dbPending`, render `<StateView kind="loading" />` instead of nothing.
2. `en.json` `workspace.chat.guest_note`: say "Log in" to match the `auth.login` button ("Login"). Only en.json carries the key.
3. `DmList.tsx:44`: sort by `receivedAt ?? timestamp`, as DmInbox.tsx:97 does. Use the shared `getMessageSortTime` if one exists.
4. `SearchMessages.tsx:63,91-92` `peerOf`:
   - With no local node id known, a DM must not resolve to our own node. Use the message's own local marker if it has one; otherwise fall back to the non-local end.
   - If neither is possible, the result row does not navigate to a DM until the local id is known.
   - Test the no-poll case.
5. `ActivityList.tsx:135,140`: an unseen row's accessible name says it is unread, using a visually hidden text with a new `workspace.*` key. The dot stays aria-hidden.
6. `NodePeek.tsx:133`: the swipe-up hint is `aria-hidden="true"`.
7. `MapContextMenu.tsx`: on close by Escape or by selecting an item, return focus to the element that had focus when the menu opened (the Map actions button on the keyboard path).
8. `WaypointSheet.tsx:217`: drop `styles.pad` from the error line so it lines up with the fields. Delete `.pad` if nothing else uses it.

### Task L4: Escape closes only the top layer; dialog focus

1. `src/workspace/patterns/Sheet.tsx`:
   - Problem: each open Sheet's Escape listener (through the shared `hooks/useDialogA11y.ts`, on `document`) fires on one Esc press. A confirm stacked on a sheet (UsersPage Manage → Deactivate/Delete; ChannelInfoSheet → purge) closes its parent too, even while the confirm is busy.
   - Fix: make a Sheet act on Escape only when it is the topmost open Sheet. Keep a small module-level stack of open sheets, so a non-top sheet ignores the key.
   - Do not change `hooks/useDialogA11y.ts`, which Classic dialogs use.
   - Keep `UsersPage.tsx:303`'s workaround working, or simplify it if it becomes redundant (its test 13-18-users must stay green).
   - Add a test: Esc with a confirm open over a sheet closes only the confirm. While the confirm is busy, Esc closes nothing.
2. ConfirmSheet usages that transmit or destroy but lack `submitOnEnter={false}`: `settings/LoraCategory.tsx:259` (applies a LoRa recipe to the radio) and `settings/LeaveGuard.tsx:92` (discards edits). Check the other ConfirmSheet usages in src/workspace and add the prop wherever the confirm transmits or destroys. List what you checked in the report.
3. `patterns/RebootWait.tsx:62` (role=dialog, aria-modal): move focus into the dialog on mount (tabIndex -1 on the card, or its first control), and keep Tab inside it, reusing Sheet's trap approach if it is small.

### Task L5: automations

1. `VariablesPage.tsx:162`: "read by" matches the whole variable name. `var.relay` must not match `var.relayCount`. Escape the name in the pattern.
2. `RulePage.tsx` Test:
   - Disable the Test action for viewers without automations:write (the test route needs write) in all three places (lines about 294, 308-311 and 419).
   - On the phone with a clean draft, do not offer Test in the ⋯ menu when the bottom Test button already shows.
3. `RulePage.tsx:484`: the Run now SendsLine must never read "through 0 devices". When no send names a source, keep the existing `run.no_source` wording.
4. `RunsTab.tsx:66-67`: Export writes `runs` while the list shows `shown`. Make the label and the content agree; prefer exporting what is shown. If the label already says "all runs", leave it and say so.
5. `Rules.module.css:196-197`: phone step-sheet buttons are at least 44 px (`.stepSheet[data-phone] .fields button`).

### Task L6: settings and MeshCore admin

1. `AppearancePage.tsx:96,106`: the Dark and Light theme rows show the applied theme after a local Apply. Read the context value (`s.darkTheme` / `s.lightTheme`); keep a fallback for a deleted theme.
2. `en.json` `workspace.server.integrations_scope`: drop "admins only". The page is open to settings writers (IntegrationsPage.tsx:69, gate="write").
3. `SecurityPrivacyPage.tsx:57-70`: readers who are not admins see the Privacy rows read-only through the existing `useReadOnly` mechanism, as today's Classic SettingsTab shows them. Writes stay admin-only as today; no new write path.
4. `usePins.ts:18`: a failed pin save shows the shared toast as well as rolling back.
5. **Not done (Ruling JI, moved to b3):** `meshcore/remote/AclManager.tsx`: wrap its fields in a `<form>` so Enter applies, with the same handler as the Apply button. ACL apply sends to a remote node, so check whether that counts as transmitting. If it does, Enter must not send without the existing confirm. Report your call.
6. `meshcore/remote/SettingValue.tsx:38`: `changed` uses `repeaterValuesEqual` (as RepeaterSettingsCategory.tsx:176), not `!==`.
7. `meshcore/DiscoverMenu.tsx:51` / `sweepStore.ts:30`: a second press while a sweep is running neither starts one nor shows "Discovery failed". Use a ref guard or a "skipped" result.

### Task L7: copy, CSS and test hygiene

1. `SolarPage.tsx:98,161`:
   - Replace the invented key `analysis.solar_monitoring.patterns` with a `workspace.*` key in en.json.
   - Replace the hardcoded "Low"/"OK" with keys.
2. `PacketDetailPanel.tsx:86` "via {relayByte}" and `OverviewPackets.tsx:200` "${r} h": move them into `workspace.*` keys with interpolation, and keep the three tests that read "via 0x12" passing.
3. `PacketStream.module.css:55`: widen `.colSource` so the header no longer truncates (about 64 px). Check 18-01 at 1280 px.
4. `Maintenance.module.css:190-195`: the firmware wizard gets side padding matching the sheet body, if the parent does not already supply it (board 12-09).
5. Show `workspace.server.geojson_no_popup_hint` (en.json:9108, now unused) as help next to the "Disable popup" menu item or its layer row (MapTilesPage.tsx:332).
6. `ReadOnlyNote.tsx`: the MeshCore region feed's receive-only line (RegionFeedPage.tsx:476) uses a feed-specific reason (a new `workspace.*` key), not "Open a Meshtastic source to send."
7. Tests:
   - `serverFields.test.tsx:25,39`: give the findByRole calls a longer timeout.
   - `15-25-request-telemetry.json`: drop the trivial "Request" must-string (check whether the file is generated from `checks/s15.json`, and change the source if so).
   - `10-09-translate.test.tsx:24`: the comment says 212 bytes.
   - `8-14-automations.test.tsx:38-55` and `10-07-dm-conversation.test.tsx:24-25`: find each button with findByRole and wait for it to be enabled before clicking.
