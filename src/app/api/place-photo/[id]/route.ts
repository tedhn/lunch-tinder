/**
 * Card photos, served straight from Google Places.
 *
 * This route exists because of a constraint rather than a preference: Google
 * Maps Platform terms forbid copying place photos into your own storage, and
 * cap caching of any fetched place content at 30 days. So nothing is
 * downloaded. A request here resolves a fresh, short-lived Google photo URL and
 * redirects the browser to it, which keeps the image bytes on Google's CDN
 * where the terms expect them.
 *
 * Two Places calls are needed per cold image — Details for the photo resource
 * name, then Photos for the URL — so results are memoised for an hour. That
 * matters: both are billed per request, and a room of six people all opening
 * the same 20-card deck would otherwise be 240 paid calls for 20 photos.
 *
 * The API key never leaves the server. It is billable, and a key in the browser
 * is a key on someone else's bill.
 */
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";

/** Google's photo URLs are signed and expire; an hour is comfortably inside
 * that, and also inside the 30-day cap on caching place content. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Tall enough for a full-bleed card on a phone at 2x without paying for a
 * resolution nobody sees. */
const MAX_HEIGHT_PX = 1200;

type CacheEntry = { url: string; expiresAt: number };

/** Survives hot reloads in dev, where the module is re-evaluated per edit. */
const globalForPhotos = globalThis as unknown as {
	placePhotoCache: Map<string, CacheEntry> | undefined;
};
const cache = globalForPhotos.placePhotoCache ?? new Map<string, CacheEntry>();
globalForPhotos.placePhotoCache = cache;

/**
 * A place's first photo, as a URL that the browser can load directly.
 * Returns null when the place has no photos, which is common for small shops.
 */
async function fetchPhotoUrl(
	placeId: string,
	apiKey: string,
): Promise<string | null> {
	const details = await fetch(
		`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
		{
			headers: {
				"X-Goog-Api-Key": apiKey,
				"X-Goog-FieldMask": "photos",
			},
		},
	);

	if (!details.ok) {
		console.error(
			`Places details failed for ${placeId}: ${details.status} ${await details.text()}`,
		);
		return null;
	}

	const { photos } = (await details.json()) as {
		photos?: { name: string }[];
	};
	const photoName = photos?.[0]?.name;
	if (!photoName) return null;

	// `skipHttpRedirect` asks for the URL as JSON instead of a 302 to the image,
	// so the redirect this route issues points at the image itself rather than
	// bouncing the browser through Google's redirector a second time.
	const media = await fetch(
		`https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${MAX_HEIGHT_PX}&skipHttpRedirect=true`,
		{ headers: { "X-Goog-Api-Key": apiKey } },
	);

	if (!media.ok) {
		console.error(
			`Places photo failed for ${placeId}: ${media.status} ${await media.text()}`,
		);
		return null;
	}

	const { photoUri } = (await media.json()) as { photoUri?: string };
	return photoUri ?? null;
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	const apiKey = env.GOOGLE_MAPS_API_KEY;
	// No key configured is the documented default, not an error: the card just
	// keeps showing its emoji.
	if (!apiKey) return new Response(null, { status: 404 });

	const cached = cache.get(id);
	if (cached && cached.expiresAt > Date.now()) {
		return Response.redirect(cached.url, 307);
	}

	const restaurant = await db.restaurant.findUnique({
		where: { id },
		select: { placeId: true },
	});

	if (!restaurant?.placeId) return new Response(null, { status: 404 });

	const url = await fetchPhotoUrl(restaurant.placeId, apiKey);
	if (!url) return new Response(null, { status: 404 });

	cache.set(id, { url, expiresAt: Date.now() + CACHE_TTL_MS });

	// 307 rather than 308: the target URL expires, so nothing downstream should
	// treat this mapping as permanent.
	return Response.redirect(url, 307);
}
