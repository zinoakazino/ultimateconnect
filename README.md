# Ultimate Connect

Trip app for **Ultimate Health & Beauty** — a few staff and ~20 consultants share the daily
schedule, chat, a trip guide, an interactive map and alerts during the Istanbul trip
(5–9 Nov 2026 — the dates shown on Home are set by staff in *Gérer le voyage*).
It is a **web app** (installable on iPhone, Android and PC), hosted on **Render** with its data in
**Supabase**. Everything is in French and Arabic, light and dark.

## What it does

**Consultants**
- Sign up with a company **invite code**, then **touch their own name** in the list of expected participants:
  the account is already prepared (real name, travel group, flights) and validated at once. Someone who is not
  in the list signs up the usual way and waits for staff to mark them verified. "Mot de passe oublié ?"
  e-mails a reset link.
- Home: trip countdown, **their own flights** (the two travel groups fly at different times: airline, times,
  airports, meeting point at Algiers airport, baggage, hotel arrival, check-out), today's schedule for their group,
  pinned reminder, **roll-call** card ("Je suis là"), useful contacts, and an **SOS** button (alerts staff, with
  position if allowed).
- Group chat (staff can close it), private messages with staff, unread badges.
- Trip guide: emergency contacts, hotel, tips — with *Open in Maps* and *Call* buttons. No map SDK
  or API key needed (Google Maps links).
- **Carte Istanbul** (tab): OpenStreetMap map of the recommended places by category, the hotel,
  the free-walking / transport-only / avoid zones, free-time plans that fit the group's official
  schedule, a "Où suis-je ?" check against the zones and a one-tap offline **Urgence** screen (112,
  hotel address in Turkish for taxis, staff numbers, scams to avoid). Content:
  `src/features/istanbul/istanbul-data.json` (guide in French: `src/features/istanbul/README.md`).
  The same data prints as double-sided flyers, 3 per A4 sheet: the official programme + free-time ideas
  **in one version per travel group** (each with its own flights), and the map + a pocket guide to tick
  (the same for everybody): `tools/flyer/README.md`.
- Alerts feed, language / theme switch, **opt-in** location sharing (transparent toggle,
  foreground only, can be turned off at any time).

**Staff**
- Schedule composer (mark an item important → pinned on Home + alert for everyone; choose *Pour qui ?*:
  everybody, or one travel group only — flights, hotel arrival, check-out…).
- People list: group badge on each person (tap it to move someone to another group: they get an alert),
  filter by group, who has signed up yet (and who has not), both groups' flights, verify consultants,
  message them, see who shares a position (opens Maps), help-request banners, unread dots.
- Group chat with a lock toggle (staff can always post).
- Announcements: choose everyone or specific people, pin to Home, **roll-call** with live
  "1/20 présents" and read receipts.
- Manage the trip (name, dates), the guide places (with coordinates), and the invite code.
- The same **Carte Istanbul**, plus the consultants who share their position as colored pins.

## Stack

Expo SDK 57 · React Native + TypeScript (built for the web with `expo export -p web`) ·
React Navigation · **Supabase** (Postgres + Auth + Realtime, free plan, no card) ·
**Render** static site · i18next (fr, ar) · expo-location ·
Leaflet + OpenStreetMap tiles (no API key) inside an iframe.

## Run it

```bash
npm install
cp .env.example .env      # the two Supabase values (Project Settings → API)
npm run web               # web preview on http://localhost:8081
```

Windows PowerShell may block `npm`/`npx` scripts — use `npm.cmd` / `npx.cmd`.

### Without internet or Supabase (local look-alike)

`tools/db` runs the **real** SQL files on a real Postgres engine (PGlite) behind a small
Supabase look-alike (sign-in, data API, real-time). Nothing leaves your computer.

```bash
npm run db:test           # 25 database tests (row-level security, grants, groups, participants list) + 11 end-to-end tests of src/lib/api.ts + 8 build-guard tests
npm run db:mock           # API on :54321, prints the URL, anon key, codes and test accounts
```

To try the production build against it (the look-alike also serves `dist/` on :8090):

```bash
set EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
set EXPO_PUBLIC_SUPABASE_ANON_KEY=<the key printed by db:mock>
npm run build:web
```

## Data model (Supabase)

`supabase/01-schema.sql` creates everything (tables, row-level security, sign-up checks, triggers);
`supabase/02-seed.sql` adds the codes, the trip dates, the two travel groups with their flights, the 21 expected
participants, the official programme day by day and the guide.

| Table | Who reads | Who writes |
|---|---|---|
| `profiles` | owner, staff | owner (name, phone, location, `location_sharing`); staff only `verified` and `group_id` (the person's travel group). Created by the database at sign-up, role from the code used, name / group from the participants list when one was chosen |
| `config` (invite code, staff code) | staff | staff |
| `trip_groups` (one row per travel group: airline, flights, meeting point, baggage, hotel arrival, check-out) | any member | staff |
| `roster` (the expected participants: name + group, and which account took the name) | staff | staff (and the database, when someone signs up) |
| `trip`, `schedule`, `places` | any member | staff |
| `chat_meta` (lock) | any member | staff |
| `messages` (group chat) | any member | members, as themselves (name and role come from the profile); blocked for consultants while locked |
| `dm_threads`, `dm_messages` | the two participants | only through `send_direct_message()`: staff open a thread, then both reply |
| `notifications` | owner (staff too) | staff create, owner marks `read` |
| `broadcasts` | staff | staff |
| `checkins`, `checkin_responses` | members / staff | staff open and close, consultants answer once while it is open |
| `help_requests` | staff + the sender | members create (status `open`), staff resolve |

"Member" = signed in **and** has a profile. A visitor with only the public key reads and writes
nothing (except asking whether a code is valid). Consultants cannot read other people's profiles or
locations, change their own role or verification, or skip the invite code: the code is checked
**inside the database** when the account is created. Message dates, senders and roll-call names are
written by the database, never trusted from the browser.

## Going live (Supabase + Render)

1. **Supabase** → *New project* (free plan; its OWN project, never one that already serves another app;
   note the project ref in the address bar).
   *Authentication → Sign In / Providers → Email*: turn **Confirm email OFF** (otherwise every sign-up
   waits for an e-mail; Supabase's free mail sender only allows a few per hour).
2. *SQL Editor*: run `supabase/01-schema.sql`, then `supabase/02-seed.sql`. The last result shows the
   **consultant code**, the **staff code** and how many participants have their account ready. (`01-schema.sql` stops by itself, changing nothing, if the
   project already holds another app's tables.)
3. *Project Settings → API Keys* (the **Connect** button at the top shows both too): copy the **publishable
   key** (`sb_publishable_…`; the older long `anon` key `eyJ…` works too) and the **Project URL**
   (always `https://<project ref>.supabase.co`). Both are public values; never use the *secret* key
   (the build and the check below refuse it).
   Check the project from the outside (writes nothing, creates no account):
   `cd tools/db && node live-check.mjs https://<ref>.supabase.co <publishable key> <consultant code>`
4. Put the project on GitHub (private repo), then **Render** → *New + → Static Site* → that repo:
   build `npm ci && npm run build:web`, publish directory `dist`, environment variables
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the Node version, 22.14.0, is read from
   `.node-version`), then *Redirects/Rewrites*: `/*` → `/index.html` (action *Rewrite*).
   `render.yaml` holds the same settings for *New + → Blueprint*. `build:web` first runs
   `tools/check-supabase-env.mjs`, which stops the build on a secret key, a key from another project or a
   malformed address.
5. In Supabase: *Authentication → URL Configuration* → Site URL = the Render address (used by the
   password-reset link).
6. Open the site, sign up with the **staff code** (staff) or the consultant code. Staff then set their own
   consultant code in *Profil → Code d'invitation*.

On iPhone: Safari → Share → *Add to Home Screen*. On Android / desktop Chrome: *Install app*.

## Travel groups and prepared accounts

The trip has two groups that fly at different times (see `02-seed.sql`: group 1 Air Algérie, group 2 Pegasus
landing at Sabiha Gökçen). Everything else (hotel, formation, walks) is the same for both.

- **Each person's account is prepared in advance** in the `roster` table (name + group). At sign-up, once the
  consultants' invite code is typed, the names still free are offered (only to someone who knows the code, and only
  id / name / group number are shown). Taking a name gives the profile that name and group and validates it at once;
  a name can be taken only once (checked inside the database). Someone not in the list signs up as before and
  waits for staff to validate them and give them a group (People tab → tap the group badge).
- **A schedule line for one group only** has `"group": 1` (or 2) in its JSON; lines without it are for everybody.
  A person sees their own group's lines plus the common ones; staff (and people without a group yet) see all of
  them, each tagged `G1` / `G2`. The composer's *Pour qui ?* chips set it.
- **Add someone** (SQL Editor): `insert into public.roster (full_name, group_id) values ('Prénom Nom', 1);`
  A staff member: add `role` = `'staff'`; they take the name with the staff code.
- **Change a flight time** (SQL Editor): `update public.trip_groups set out_dep = '10:00' where id = 1;`
  (columns `out_dep out_arr back_dep back_arr meet_time hotel_arrival checkout_by`, times `HH:MM`, local to each
  city; baggage: `bag_hold_kg` = weight of each checked bag, `bag_hold_count` = how many, `bag_cabin_kg`). The Home card updates by itself; the programme lines of the day are edited in the Programme tab.
- **Free a name** (the person lost their account): delete their user in *Supabase → Authentication → Users*; the name
  goes back into the list.
- Re-running `02-seed.sql` is safe: programme days the staff edited, codes, groups and people already there stay as
  they are (a day still made only of seed lines is refreshed).

Good to know:
- Since 30 May 2026 a new Supabase project does not open new tables to the API by itself (the
  *Automatically expose new tables* setting). `01-schema.sql` grants what the app needs, so leave that
  setting as it is. If the app ever shows **"permission denied for table …"**, run `01-schema.sql` again
  (it can be run as often as needed).
- A free Supabase project **pauses after 7 days without any activity**: open the app now and then
  before the trip (the dashboard can restore it in one click).
- Password-reset e-mails use Supabase's own sender, which is limited (a few per hour, and only to team
  members until a custom SMTP is set). If someone forgets a password, staff can set a new one in
  *Supabase → Authentication → Users*.
- To make another person staff after sign-up: `update public.profiles set role = 'staff' where email = '…';`
- Change the staff code: `update public.config set value = 'NEW-CODE' where key = 'staff_code';`

## Limits to know about

- **No phone push notifications** (a web app cannot receive them without extra servers): alerts show
  in the in-app feed with badges, and new chat messages appear live.
- **Location** is only updated while the app is open (foreground). It is opt-in and visible in
  the profile toggle; staff see the last known position and its age.
- **Offline**: on the **Carte Istanbul**, places, programs, zones and the Urgence screen are bundled in
  the app and open without a connection (only the map background tiles need Internet). Chat, schedule
  and guide need a connection. For maps offline, download Istanbul in Google Maps → *Offline maps*.
- **Map tiles** come from OpenStreetMap's public servers (fine for ~30 people).
- **Arabic on the web** is translated but the layout is not mirrored (React Native Web has no RTL switch).
- No AI assistant or file uploads: they need a paid plan or API key.

## Layout

```
src/
  components/   shared UI (Wordmark, Card, Button, ChatThread, LocationSharer…)
  context/      Auth, Theme, Language, Unread (badges)
  hooks/        live data hooks (messages, threads, check-ins, help requests…)
  lib/          supabase client, api (all reads/writes), live (real-time + refresh), maps, dates, auth errors
  navigation/   auth stack, consultant tabs, staff tabs
  screens/      auth/, consultant/, staff/, shared/
  features/istanbul/  Carte Istanbul: data file, map engine, screens (see its README)
  theme/ i18n/  design tokens; fr.json + ar.json
supabase/         01-schema.sql, 02-seed.sql (run in the Supabase SQL Editor)
render.yaml       Render static-site settings
public/           web manifest + icons + service worker
tools/db/         database tests + local Supabase look-alike (npm run db:test | db:mock) + live-check.mjs (checks a real project)
tools/check-supabase-env.mjs   build guard: refuses a secret key / wrong project before `expo export`
tools/map/        map data check, geometry tests, OpenStreetMap coordinate check
                  (npm run map:check | map:test | map:verify)
tools/flyer/      printable Istanbul flyers (PDF): programme + map, built from the same data (see its README)
```
