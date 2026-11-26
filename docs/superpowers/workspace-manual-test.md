# Workspace layout: manual test guide (#6365)

A checklist for testing the Workspace by hand on your own machine, against branch `claude/eager-pascal-svegts`. Tick each step. When something is off, report it with the template at the end.

Steps marked **(sends)** put a packet on the mesh. Do those only on a test node, and send text only on the `gauntlet` channel, never Primary.

## 1. Build and start

1. Check out the branch and note the commit:
   ```bash
   git fetch origin claude/eager-pascal-svegts && git checkout claude/eager-pascal-svegts && git pull
   ```
   ```bash
   git rev-parse --short HEAD
   ```
2. The compose file reads `.env`. If you don't have one, copy the example:
   ```bash
   cp .env.example .env
   ```
   `MESHTASTIC_NODE_IP` in it creates a source on first boot. Set it to your test node, or comment it out to start with no devices (the first-run screen).
3. Build and start the SQLite app. Add `-f docker-compose.dev.local.yml` to both commands if you have that file (USB serial nodes).
   ```bash
   COMPOSE_PROFILES=sqlite docker compose -f docker-compose.dev.yml build
   ```
   ```bash
   COMPOSE_PROFILES=sqlite docker compose -f docker-compose.dev.yml up -d
   ```
   Never add `-v` to `down`: it deletes the data volume.
4. Check that the container is up and the build is this branch:
   ```bash
   COMPOSE_PROFILES=sqlite docker compose -f docker-compose.dev.yml ps
   ```
   ```bash
   docker exec meshmonitor-sqlite sh -c 'ls dist/assets | grep WorkspaceApp; grep -l "data-row-target" dist/assets/*.js | head -1'
   ```
   - [ ] `meshmonitor-sqlite` is `Up`.
   - [ ] The first command prints a `WorkspaceApp-*.js` chunk (the Workspace is in the build).
   - [ ] The second prints a file name. That string comes from the keyboard-delete focus fix (follow-ups pass), so the image is at or after it. If it prints nothing, rebuild with `build --no-cache`.
5. Open **http://localhost:8081/meshmonitor**. The SQLite container publishes port 8081; 8080 works only if you run a proxy in front of it.
6. Sign in as `admin` / `changeme`. A default-password warning shows until you change it. Login is rate-limited, so don't hammer a wrong password.

## 2. Switching layouts

The layout is per user. The gate reads, in order: your `layout` preference, then the install's `defaultLayout` setting, then Classic. The browser keeps a copy in localStorage key `mm.layout` so the first paint doesn't wait.

Where they live:
- Your choice: user preference `layout` (`GET`/`PUT /api/user/preferences/layout`). Set from the Classic entry points, or You › Layout in the Workspace.
- Install default: setting `defaultLayout` (`classic` or `workspace`, `POST /api/settings`). Set in Workspace **Server › General**, card "Default layout for new users". Users who already chose keep their choice.
- Banner offer: setting `offerWorkspaceBanner`, the "Offer Workspace to Classic users" switch on the same card. **Off by default**, so the banner doesn't show until you turn it on.

Steps:
- [ ] In Classic, open the user menu (top right). "Try the Workspace layout" is there. Click it: the page switches to the Workspace without a reload.
- [ ] In the Workspace, go to **You › Layout** (`/meshmonitor/you/layout`). Pick Classic: you're back in Classic. Pick Workspace again from the user menu.
- [ ] Reload on any Workspace page: you stay in the Workspace, on the same URL.
- [ ] Banner: in the Workspace, Server › General, turn on "Offer Workspace to Classic users". Then reset your own choice so the banner applies to you:
  ```bash
  ./scripts/api-test.sh login && ./scripts/api-test.sh delete /api/user/preferences/layout
  ```
  (`api-test.sh` defaults to `admin`/`changeme1`; use `API_PASS=changeme` if you haven't changed the password.) Reload: you're in Classic (unless `defaultLayout` is `workspace`), and the "Try the Workspace layout." banner shows on the main pages (Dashboard, Unified Messages/Telemetry, MeshCore and Reticulum pages). "Try it" moves you to the Workspace. "Not now" or × saves Classic and hides the banner for good.
- [ ] Set "Default layout for new users" to Workspace, then sign in as a second user who has never chosen (create one in Overview › Users). They land in the Workspace. Set it back to Classic afterwards.
- [ ] Signed out (anonymous): Classic shows. You › Layout says "Sign in to choose your layout."

## 3. What needs a real node

| Area | Without a node | Needs |
|---|---|---|
| Shell, rail, switcher, layout switch, You pages | Yes | — |
| Server pages, Users, Audit log, Automations editing | Yes | — |
| Add device flow, device states (offline, connecting) | Yes: point a source at an IP with nothing on it | — |
| Chat, DMs, message actions | Read-only on old data | A Meshtastic node (TCP), or an MQTT source for receive-only |
| Map, node page, Overview › Map/Packets/Messages | Shows whatever the DB holds | Live data needs a node or an MQTT source |
| Device settings, Danger zone | No | A Meshtastic node you can reboot |
| MeshCore | No | A MeshCore companion (TCP or serial); a repeater for the admin pages |
| Region feed | No | A MeshCore MQTT broker and a region code |
| Reticulum | No | A Reticulum (rnsd) instance |

An MQTT broker source gives you real traffic without a radio, but it can't send.

## 4. Pass by area

Each step says what you should see. Desktop width first (1280 px or more), phone at the end.

### Shell and rail
- [ ] Left rail: Overview at the top, then one square per device, then "Add device". Each square shows the device's status. Unread counts show as badges.
- [ ] Clicking a square opens that device: its sidebar has search (⌘K / Ctrl+K), then the tools (Map, Nodes with an online count, Dashboard, Automation, Configuration, and "More tools…" holding Info, Packet monitor and Security), then channels, then DMs. MeshCore, region-feed and Reticulum devices have their own sidebars.
- [ ] "Hide sidebar" / "Show sidebar" collapses and restores it.
- [ ] Tab through the rail: every square takes focus with a visible ring. Enter opens it.
- [ ] With no devices: a first-run screen invites you to add one.

### Device switcher
- [ ] At desktop width the rail is the switcher. Hover a square: the device name shows.
- [ ] At phone width (section "Phone"), the header's device square opens a switcher sheet listing every device with its status. One focus ring, on the square.
- [ ] Removing a device while you're on it: "This device is no longer available."

### Chat: channel
- [ ] Open a channel from the sidebar. Messages show as rows (or bubbles, if You › Layout › "Messages as" is Bubbles). A loading state shows first, then the thread.
- [ ] **(sends)** On `gauntlet` only: type a message and press Enter. It appears once, then gets its ack state. Holding Enter down sends once, not a burst.
- [ ] Unread: messages arriving in another channel add to that channel's badge and the rail badge (if the unread-indicator preference is on). Opening the channel clears it.
- [ ] Search in the channel header finds a message by text.

### Chat: DM
- [ ] "Message a node" (or a DM in the sidebar) opens a conversation. "DM with" shows the peer's name.
- [ ] **(sends)** Send a DM to your own test node. It appears with delivery state.
- [ ] The DM list is sorted by latest message and the search box filters by peer.

### Chat: message actions
- [ ] Hover a message: an action bar appears (react, reply, ⋯ "More actions").
- [ ] **(sends)** React with an emoji on a `gauntlet` message: the chip appears with a count of 1.
- [ ] **(sends)** Reply: the composer shows the quoted message; the sent reply links to it.
- [ ] ⋯ → details: hops, SNR and route show. Escape closes only the details, not anything under it.
- [ ] Translate (if configured) shows the translation under the original.

### Chat: keyboard delete
Needs a user allowed to delete messages (admin is).
- [ ] Tab into the thread: a message row takes focus, labelled with sender and time. Enter or Space toggles its details. ArrowRight moves into its action bar.
- [ ] In the action bar: ⋯ → Delete. A confirm opens. Pressing Enter does **not** delete. Click Delete.
- [ ] The message goes, and focus moves to the next message (or the previous one if you deleted the last). Focus does not drop to the page.
- [ ] Same delete with the mouse: focus is not moved, and the next message's action bar does not pop up.
- [ ] Cancel the confirm: nothing moves.

### Overview › Messages / Packets / Map
- [ ] Overview › Messages: every device's messages in one list, with a source column/filter. Export opens the export page; the file holds what's shown.
- [ ] Overview › Packets: packets from every device. Filters narrow the list. "Pop out" opens the packet window without the shell.
- [ ] Overview › Map: all devices' nodes on one map. The layers drawer toggles layers. Analysis opens on the same map.
- [ ] Overview › Telemetry, Dashboard and Reports open and draw.

### Map (device) and node page
- [ ] Device › Map: that device's nodes. Click a node: a peek card. Right-click the map: the context menu (waypoint, local marker, measure). Escape closes the menu only.
- [ ] Open a node page (from the peek, Nodes list or a message sender). Header tiles (last heard, battery, SNR, hops). Tabs: Overview, telemetry, position, traceroutes.
- [ ] Node page menu: favourite, ignore, purge, merge. Merge shows its no-undo warning in red. Purge asks first.
- [ ] **(sends)** Traceroute from the node page: the confirm says it sends; the result strip fills in.
- [ ] Nodes list: sort, filter, column choice. The current node's row is highlighted while its page is open.

### Device settings and Danger
- [ ] Device › Settings: a category list (Identity, LoRa, Channels, Security, Device, modules, Maintenance, the In MeshMonitor group). Search finds a setting by name; pins stick.
- [ ] Change a radio setting (e.g. Device › a display option). A save bar appears with the queued change. "Review" lists it. Leaving the page with a queued edit asks first.
- [ ] **(sends)** Save: the device takes it and a reboot wait shows if the setting needs one.
- [ ] Maintenance › Danger zone (`settings/maintenance/danger`): reboot, shutdown, factory reset, purge. Each opens a confirm. Pressing Enter in the confirm does **not** fire it. Only test Reboot on a node you can reboot **(sends)**; cancel the others.
- [ ] As a user without write permission: rows are read-only and there's no save bar.

### Server pages
- [ ] Server (`/meshmonitor/server`): Devices, General, Notification services, Security & privacy, Backup & maintenance (and Retention), Channel database, Scripts, Map & tiles, Embed, Background jobs (and Solar), Integrations, Analytics. Which ones show depends on your role (admin, settings write, settings read).
- [ ] Each page loads its current values. A change saves with a "Saved" tick; a failed save shows a toast.
- [ ] Server › Devices: the device list, Add device (pick a type, fill the form), edit and disconnect. MeshCore disconnect keeps the device listed.
- [ ] A non-admin settings reader sees Map & tiles read-only and no write controls.

### MeshCore and the region feed
- [ ] A MeshCore companion device: channels, rooms, contacts (Nodes), contact node page.
- [ ] **(sends)** Send on a test channel; send a DM to a contact.
- [ ] Repeater or room admin: the console and its commands, ACL manager. Apply in the ACL manager sends `setperm` (no confirm; Enter does nothing there by design).
- [ ] MeshCore settings: Regions. "Regions nearby" says it sends one discovery request before you open it **(sends)**.
- [ ] Region feed device (type "Listen to a MeshCore observer feed by region"): its header reads "MQTT · region …". It says it is receive-only and has no composer.
- [ ] MeshCore packets, info and automations pages open.

### Reticulum
- [ ] A Reticulum device: Destinations (default), Interfaces, Paths, Map, Dashboard, DMs, Info.
- [ ] Interfaces' rate history charts only Dashboard favourites (by design, Ruling JM).
- [ ] Reticulum settings: the LXMF identity page; RNode shows only in own mode.

### Automations
- [ ] Overview › Automations: the rule list. Create a rule from a template; save; it appears enabled.
- [ ] A rule page: its trigger, conditions and actions, its runs and a run's trace. Variables and templates tabs.
- [ ] "Test" runs the rule without sending, and is hidden for users without write.
- [ ] Device › Automations: that device's built-ins (auto-acknowledge, auto-announce and so on). Their intervals are clamped and warn next to the input.

### Users and Audit log
- [ ] Overview › Users: create a user, edit the permission matrix per source, save. Sign in as that user in a private window: they see only what was granted.
- [ ] Overview › Audit log: your changes from this session are listed with user, time and detail. Filters work.

### Phone (browser device mode at 390 px)
Open devtools, device mode, 390 × 844, and reload.
- [ ] Bottom tab bar: Home · DMs · Activity · You. The active tab is marked.
- [ ] Home: the device's channels and tools. The header device square opens the switcher sheet.
- [ ] Opening a channel pushes it full screen; Back returns. Long-press (or tap) a message opens the actions sheet. Sheets close with a swipe down or Escape, one layer at a time.
- [ ] DMs tab lists conversations. Activity lists replies, reactions and mentions; its device button is easy to hit (44 px).
- [ ] Map on phone: full screen, layers as a sheet (no Packet monitor toggle on phone).
- [ ] You tab: layout, notifications, security, token, password, help.
- [ ] Nothing scrolls sideways at 390 px, apart from wide tables that scroll inside their panel.

## 5. Known open (don't report these)

From `workspace-final-report.md` ("Still open" lists and rulings):
- **DM mark-read can post twice when a DM opens** (KE): the first-unread latch doesn't wait for the poll.
- **Browser Back out of settings drops queued edits**, with no prompt (JP). The in-app leave guard works.
- **Enter in the MeshCore ACL manager does nothing** (JI, JN).
- **Reticulum rate history charts favourites only** (JM).
- **Activity on first visit counts up to 50 items as unseen** (Q7, skipped).
- **ConfirmSheet can cover the danger-zone buttons at 1280 px** (Q6).
- **No change dots in the settings sidebar** (Q1, not built).
- **MeshCore console History loads on open** (Q5).
- An aged MeshCore favourite drops from the Dashboard's Direct tile (O7); a MeshCore message's expired flag is read from its text (S15). Both need Classic edits.
- The Logout row isn't visually disabled while signing out. Lazily mounted drawer content gets no focus-in. "DM with" is empty until the local node id arrives. The GeoJSON hint is a hover `title` only. The switcher row name may run its parts together.
- The Classic banner isn't on every Classic page (5 pages carry it).
- Undrawn MeshCore pages keep Classic sections (no boards exist).
- Translation coverage leaves `workspace.*` keys out while the layout is opt-in (BI, JO). Untranslated Workspace strings show in English.
- Classic and server items listed under "Out of scope" in `plans/2026-11-24-workspace-own-issues.md` (for example the reboot wait's sourceId, Classic DM Mark All Read, server timer re-arms). Report these only if they're new to you; they're out of this branch's scope.

## 6. Reporting a bug

Copy this for each problem:

```
### <short title>
Area: <e.g. Chat: keyboard delete>
Width: <desktop 1280 / phone 390>   Browser: <Chrome 1xx / Firefox / Safari>
User: <admin / reader / anonymous>   Device type: <Meshtastic TCP / MQTT / MeshCore / feed / Reticulum / none>
URL: <path after /meshmonitor>
Steps:
1.
2.
Expected:
Saw:
Console errors: <paste, or none>
Screenshot: <attach if visual>
Happens in Classic too? <yes / no / didn't check>
```

The last line matters most for triage: if Classic does the same, it's a Classic or server bug, which this branch doesn't change.
