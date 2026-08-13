import "server-only";

/**
 * The one place that asks Google which photos a place has.
 *
 * This lives outside the route handlers because both of them need it — the photo
 * route to resolve slide `n`, the details route to report how many slides there
 * are — and a Next.js route file may only export handlers, not helpers.
 *
 * Sharing it is also what keeps the bill down. One Details call per place gets
 * cached here, so a detail sheet opening on a card whose photo already loaded
 * costs nothing extra, and a six-slide carousel is one Details call plus one
 * Photos call per slide actually looked at.
 */

/** Google's photo URLs are signed and expire; an hour is comfortably inside
 * that, and also inside the 30-day cap on caching place content. */
export const PHOTO_CACHE_TTL_MS = 60 * 60 * 1000;

/** How many photos a carousel may walk. Google returns up to 10; each one is a
 * billed Photos call the first time somebody swipes to it, and nobody studies
 * ten pictures of a lunch spot. */
export const MAX_PHOTOS = 6;

type NameCacheEntry = { names: string[]; expiresAt: number };

/** Survives hot reloads in dev, where the module is re-evaluated per edit. */
const globalForPlaces = globalThis as unknown as {
	placePhotoNameCache: Map<string, NameCacheEntry> | undefined;
};
const nameCache =
	globalForPlaces.placePhotoNameCache ?? new Map<string, NameCacheEntry>();
globalForPlaces.placePhotoNameCache = nameCache;

/**
 * The photo resource names Google holds for a place, newest-relevant first.
 * An empty array for the many small shops with no photos; null when the call
 * itself failed, which callers treat as "try again later" rather than "none".
 */
export async function fetchPhotoNames(
	placeId: string,
	apiKey: string,
): Promise<string[] | null> {
	const cached = nameCache.get(placeId);
	if (cached && cached.expiresAt > Date.now()) return cached.names;

	const response = await fetch(
		`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
		{
			headers: {
				"X-Goog-Api-Key": apiKey,
				"X-Goog-FieldMask": "photos",
			},
		},
	);

	if (!response.ok) {
		console.error(
			`Places photos lookup failed for ${placeId}: ${response.status} ${await response.text()}`,
		);
		return null;
	}

	const { photos } = (await response.json()) as { photos?: { name: string }[] };
	const names = (photos ?? []).map((p) => p.name).slice(0, MAX_PHOTOS);

	nameCache.set(placeId, {
		names,
		expiresAt: Date.now() + PHOTO_CACHE_TTL_MS,
	});
	return names;
}
