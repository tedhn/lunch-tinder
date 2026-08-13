# Lunch Tinder

Everyone in the room swipes through the same deck of lunch spots. Nobody sees
anybody else's votes until the round ends. The top pick wins, and a Google Maps
link takes it from there.

Built on the [T3 stack](https://create.t3.gg) — Next.js App Router, tRPC,
Prisma, Tailwind — with Supabase as the database and Supabase Realtime for
cross-phone sync.

## Where the deck comes from

A curated list you maintain in [`prisma/seed.ts`](prisma/seed.ts). Each row
carries a `googleUrl` used purely as a hand-off once a room has decided — an
ordinary `maps.google.com` search link built from the restaurant name, so there
is no API key, no quota and no billing account anywhere in this project.

Give a spot an optional `placeId` and the link pins to that exact shop instead
of letting Maps guess from the name. Place IDs are the one piece of Google data
you may store indefinitely.

Two dead ends worth documenting, so nobody re-investigates them:

- **Grab has no discovery API.** `developer.grab.com` is partner-only with no
  self-serve signup, and the GrabFood partner API is a *merchant* integration:
  receive orders, sync your own menu and store hours. There is no consumer
  "restaurants near this lat/lng" endpoint. Unofficial scrapers are paid per
  run, break whenever Grab changes its markup, and likely violate its terms.
- **Google Places would work, but it is not free of strings.** Nearby Search
  does return restaurants near a point. The catch is the Google Maps Platform
  terms: fetched place content (names, price levels, photos) may only be cached
  for 30 days, photo bytes may not be copied into your own storage, attribution
  is required wherever that content appears, and it may not be shown on a
  non-Google map. A permanent `restaurant` table therefore needs a refresh job
  and a photo proxy — more code than the ingest itself.

The pragmatic middle, if you want discovery: run Places once as a lookup aid,
keep the place ID, and type the name, cuisine, emoji and walk time in by hand.
Nothing Google-sourced persists except the exempt ID, and nothing else in the
app has to change.

## Setup

1. **Create a Supabase project**, then copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — pooled connection, port 6543, with `?pgbouncer=true`
   - `DIRECT_URL` — direct connection, port 5432 (migrations cannot use a pooler)
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API

2. **Push the schema, lock it down, fill the deck:**

```bash
bun install && bun run db:push && bun run db:policies && bun run db:seed
```

`db:policies` is the step that is easy to forget: it enables row level security
and adds `room` and `member` to the Realtime publication. Without it, Realtime
delivers nothing and the UI silently falls back to a 30-second poll. Re-run it
after any `db:push` that recreates tables. If your pooled connection refuses the
DDL, paste [`prisma/sql/supabase-policies.sql`](prisma/sql/supabase-policies.sql)
into the Supabase SQL editor instead.

3. **Run it:**

```bash
bun run dev
```

Open two browsers (or a phone and a laptop) on the same room code to see sync.

## How it fits together

```
browser ──tRPC mutation──▶ Next route handler ──Prisma──▶ Supabase Postgres
   ▲                                                             │
   └────── Realtime "something changed" ◀── publication ──────────┘
                    (then refetch room.state over tRPC)
```

Realtime is used strictly as a *signal*, never as a data source. A row change
on `room` or `member` invalidates the `room.state` query; the server then
decides what that client is allowed to see. This is what keeps votes secret
mid-round: the `swipe` table has RLS enabled and **no policy at all**, so the
anon key cannot read it under any circumstances, and `room.state` only tallies
once the room's phase is `results`.

Presence — the green dots — rides on the Realtime channel rather than a
`last_seen_at` column. A heartbeat write would broadcast a row change, which
would trigger a refetch, which would heartbeat again.

### Room rules

- **Identity** is an anonymous UUID in `localStorage`. No sign-in; a lunch vote
  does not deserve a password. A phone that locks and reopens rejoins as the
  same member instead of becoming a second ghost in the list.
- **Deck order** is shuffled once at room creation and frozen into
  `room.deck_ids`, so "3 of 5 finished" refers to the same cards for everyone.
- **There is no lobby.** A room opens straight into swiping and a joiner starts
  on their own. A screen whose only content is "waiting for others" is where
  somebody gives up and suggests the usual place.
- **A round ends two ways**: `room.voting_ends_at` passes (`ROUND_MINUTES`,
  ten by default), or the host counts the votes early. Finishing the deck ends
  nothing — that is what lets a latecomer still vote, and what stops the room
  being cut short by whoever swipes fastest. No cron: whichever client reads the
  room next closes an expired one.
- **Counting early is the host's alone.** Starting and resetting are
  recoverable; counting throws away votes nobody has cast yet, and it takes one
  impatient person to do that to five others.
- **Verdicts are batched.** The client holds them in memory and submits a whole
  deck in one request, flushing early if the tab is hidden or the deadline is
  close. Writes are idempotent per (room, member, card), so overlapping batches
  converge rather than inflating a tally.
- **A tie says so.** The tally reports which rule broke it — closest walk, then
  alphabetically — because crowning one of three equal favourites silently reads
  as an opinion the app did not earn.

## Layout

| Path | What lives there |
| --- | --- |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Restaurants, rooms, members, swipes |
| [`prisma/seed.ts`](prisma/seed.ts) | The curated deck — edit this for your office |
| [`prisma/sql/supabase-policies.sql`](prisma/sql/supabase-policies.sql) | RLS and the Realtime publication |
| [`src/server/lunch/`](src/server/lunch) | Seeded shuffle, tally, room view types |
| [`src/server/api/routers/room.ts`](src/server/api/routers/room.ts) | Every mutation the app can make |
| [`src/hooks/use-room-channel.ts`](src/hooks/use-room-channel.ts) | Realtime subscription and presence |
| [`src/app/_components/`](src/app/_components) | Home form, swipe deck, results |
| [`src/app/api/place-photo/[id]/`](src/app/api/place-photo/%5Bid%5D) | Card photos, proxied live from Google |
| [`scripts/fetch-nearby.ts`](scripts/fetch-nearby.ts) | Draft a deck from Places Nearby Search |
| [`video/`](video) | The Remotion promo — see below |

## The promo video

A 29-second vertical clip built with [Remotion](https://www.remotion.dev): the
title, the room code, four swipes, the waiting screen with the clock running
down, the tie being explained, and the stack.

```bash
bun run video:studio   # preview and scrub in the browser
bun run video:render    # out/lunch-tinder.mp4 — 1080x1920, ~4MB
bun run video:still -- --frame=246   # one frame, for a thumbnail
```

Two things worth knowing before editing it. The directory is `video/`, not
`remotion/`, because `tsconfig.json` sets `baseUrl: "."` and a folder of that
name shadows the package — every `import … from "remotion"` would resolve to the
video's own entry point. And it shares no code with the app: the palette and the
card data are restated in `video/theme.ts` and `video/data.ts` so the render
never pulls in Prisma or Tailwind. Change the app's palette and you change that
file too.

The cards show the emoji fallback rather than Google photos on purpose. Maps
Platform terms cap how long fetched place content may be cached, and a rendered
MP4 is a cache that never expires.

## Housekeeping

Rooms are ephemeral by design — a lunch decision does not outlive lunch.
Nothing sweeps them yet; `room.last_activity` is there for it. A Supabase
scheduled function deleting rooms idle for a couple of hours is the natural
home for that (`ROOM_IDLE_MS` in `src/server/lunch/types.ts` is the intended
cutoff).
