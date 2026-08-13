import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

/**
 * Browser Supabase client, used for exactly one thing: subscribing to room and
 * member row changes so the UI refetches instead of polling. Every write goes
 * through tRPC, and the `swipe` table has no RLS policy at all, so this client
 * cannot read anybody's votes.
 *
 * A module-level singleton — a second client would open a second websocket.
 */
export const supabase = createClient(
	env.NEXT_PUBLIC_SUPABASE_URL,
	env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	{
		auth: { persistSession: false },
		realtime: {
			// A busy room is a handful of swipes a second; this is headroom, not a
			// target, and it keeps a runaway loop from flooding the socket.
			params: { eventsPerSecond: 20 },
		},
	},
);
