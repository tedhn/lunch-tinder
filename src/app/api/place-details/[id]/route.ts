/**
 * The extra detail behind a card — rating, whether it is open, address, hours.
 *
 * Same shape and the same reason as /api/place-photo/[id]: this is fetched when
 * someone asks for it and never written to the database. Google Maps Platform
 * terms cap caching of fetched place content at 30 days, and opening hours are
 * the part of that content most obviously wrong when stale, so the in-memory
 * cache here is minutes rather than days.
 *
 * It is also the most expensive thing the app can do. Ratings and opening hours
 * sit in a higher Places SKU than an id-and-name lookup, so nothing calls this
 * on render — only a deliberate tap on a card.
 */
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";

/** Ten minutes. `openNow` flips on a boundary somewhere in every lunch hour,
 * and a card confidently saying "Open" at 14:45 is worse than saying nothing. */
const CACHE_TTL_MS = 10 * 60 * 1000;

export type PlaceDetails = {
	rating?: number;
	ratingCount?: number;
	openNow?: boolean;
	address?: string;
	hours?: string[];
	/** Google requires these to be shown wherever their content is. */
	attributions: string[];
};

type CacheEntry = { details: PlaceDetails; expiresAt: number };

/** Survives hot reloads in dev, where the module is re-evaluated per edit. */
const globalForDetails = globalThis as unknown as {
	placeDetailsCache: Map<string, CacheEntry> | undefined;
};
const cache =
	globalForDetails.placeDetailsCache ?? new Map<string, CacheEntry>();
globalForDetails.placeDetailsCache = cache;

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	const apiKey = env.GOOGLE_MAPS_API_KEY;
	// No key configured is the documented default, not an error: the card falls
	// back to what the seed file already knows.
	if (!apiKey) return Response.json({ attributions: [] });

	const cached = cache.get(id);
	if (cached && cached.expiresAt > Date.now()) {
		return Response.json(cached.details);
	}

	const restaurant = await db.restaurant.findUnique({
		where: { id },
		select: { placeId: true },
	});

	if (!restaurant?.placeId) return Response.json({ attributions: [] });

	const response = await fetch(
		`https://places.googleapis.com/v1/places/${encodeURIComponent(restaurant.placeId)}`,
		{
			headers: {
				"X-Goog-Api-Key": apiKey,
				// Every field is billable, so this is the shortlist that actually
				// changes a lunch decision.
				"X-Goog-FieldMask": [
					"rating",
					"userRatingCount",
					"currentOpeningHours.openNow",
					"regularOpeningHours.weekdayDescriptions",
					"shortFormattedAddress",
					"attributions",
				].join(","),
			},
		},
	);

	if (!response.ok) {
		console.error(
			`Places details failed for ${id}: ${response.status} ${await response.text()}`,
		);
		// A soft failure: the sheet still opens on seed data alone.
		return Response.json({ attributions: [] });
	}

	const body = (await response.json()) as {
		rating?: number;
		userRatingCount?: number;
		currentOpeningHours?: { openNow?: boolean };
		regularOpeningHours?: { weekdayDescriptions?: string[] };
		shortFormattedAddress?: string;
		attributions?: { provider?: string }[];
	};

	const details: PlaceDetails = {
		rating: body.rating,
		ratingCount: body.userRatingCount,
		openNow: body.currentOpeningHours?.openNow,
		address: body.shortFormattedAddress,
		hours: body.regularOpeningHours?.weekdayDescriptions,
		attributions: (body.attributions ?? [])
			.map((a) => a.provider)
			.filter((p): p is string => Boolean(p)),
	};

	cache.set(id, { details, expiresAt: Date.now() + CACHE_TTL_MS });

	return Response.json(details);
}
