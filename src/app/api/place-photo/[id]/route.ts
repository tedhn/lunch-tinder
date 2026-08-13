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
 * `?n=` picks a photo by index, which is what the detail carousel walks. The
 * resource names for a place come from one Details call and are cached together,
 * so a carousel of five costs one Details call and five Photos calls, not five
 * of each.
 *
 * The API key never leaves the server. It is billable, and a key in the browser
 * is a key on someone else's bill.
 */
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";
import {
	fetchPhotoNames,
	MAX_PHOTOS,
	PHOTO_CACHE_TTL_MS,
} from "~/server/places";

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
 * One photo of a place, as a URL the browser can load directly.
 * Returns null when the place has no photo at that index.
 */
async function fetchPhotoUrl(
	placeId: string,
	index: number,
	apiKey: string,
): Promise<string | null> {
	const names = await fetchPhotoNames(placeId, apiKey);
	const photoName = names?.[index];
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
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	// `?n=` is the carousel's slide index. Anything unparseable is photo 0, which
	// is what a card asks for.
	const requested = Number(request.nextUrl.searchParams.get("n"));
	const index =
		Number.isInteger(requested) && requested >= 0 && requested < MAX_PHOTOS
			? requested
			: 0;

	const apiKey = env.GOOGLE_MAPS_API_KEY;
	// No key configured is the documented default, not an error: the card just
	// keeps showing its emoji.
	if (!apiKey) return new Response(null, { status: 404 });

	const cacheKey = `${id}:${index}`;
	const cached = cache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return Response.redirect(cached.url, 307);
	}

	const restaurant = await db.restaurant.findUnique({
		where: { id },
		select: { placeId: true },
	});

	if (!restaurant?.placeId) return new Response(null, { status: 404 });

	// One retry, because a miss here is not free: the card sets its own fallback
	// on the first error and stays on the emoji for the rest of that mount, so a
	// momentary empty response from Places costs the photo for a whole round.
	const url =
		(await fetchPhotoUrl(restaurant.placeId, index, apiKey)) ??
		(await fetchPhotoUrl(restaurant.placeId, index, apiKey));
	if (!url) return new Response(null, { status: 404 });

	cache.set(cacheKey, { url, expiresAt: Date.now() + PHOTO_CACHE_TTL_MS });

	// 307 rather than 308: the target URL expires, so nothing downstream should
	// treat this mapping as permanent.
	return Response.redirect(url, 307);
}
