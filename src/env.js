import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		// Supabase pooled connection string (port 6543, `?pgbouncer=true`).
		DATABASE_URL: z.string().url(),
		// Supabase direct connection (port 5432). Prisma migrations need this —
		// they cannot run through pgBouncer.
		DIRECT_URL: z.string().url(),
		// How many cards land in a room's deck.
		DECK_SIZE: z.coerce.number().int().positive().default(20),
		// How long a round stays open before the votes are counted regardless of
		// who has finished. Ten minutes is about as long as a group will wait on a
		// colleague who has wandered off to a meeting.
		ROUND_MINUTES: z.coerce.number().int().positive().default(10),
		// Google Maps Platform key, used only by /api/place-photo/[id] and by
		// scripts/fill-place-ids.ts. Optional: without it the cards fall back to
		// their emoji, and nothing else in the app notices. Server-side only —
		// this key is billable, so it must never reach the browser.
		GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// Used only for Realtime subscriptions. All writes go through tRPC, never
		// straight from the browser to Postgres.
		NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		DIRECT_URL: process.env.DIRECT_URL,
		DECK_SIZE: process.env.DECK_SIZE,
		ROUND_MINUTES: process.env.ROUND_MINUTES,
		GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
