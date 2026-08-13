/**
 * Resolves a Google place ID for every spot in prisma/seed.ts.
 *
 * Run it once, paste the printed `placeId` lines into the seed file, re-run
 * `bun run db:seed`. It prints rather than rewrites the file on purpose: place
 * lookup by name is a guess, and a wrong ID silently points a card's photo and
 * Maps link at the wrong shop. Reading 24 matched names takes a minute and
 * catches that.
 *
 * Place IDs are the one piece of Google place data that may be stored
 * indefinitely, which is why this is a one-time backfill and not a job.
 *
 *   GOOGLE_MAPS_API_KEY=... bun scripts/fill-place-ids.ts
 *
 * Costs one billed Text Search request per spot.
 */

/** Biases results toward Kuala Lumpur so "Subway" resolves to a lunch walk away
 * rather than a Subway in another hemisphere. Change this for your own office —
 * it is the same localisation point as `walkMinutes` in the seed file. */
const BIAS = {
	latitude: 3.139,
	longitude: 101.6869,
	radiusMetres: 20_000,
};

type Match = {
	id: string;
	displayName?: { text?: string };
	formattedAddress?: string;
};

async function searchPlace(
	query: string,
	apiKey: string,
): Promise<Match | null> {
	const response = await fetch(
		"https://places.googleapis.com/v1/places:searchText",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Goog-Api-Key": apiKey,
				"X-Goog-FieldMask":
					"places.id,places.displayName,places.formattedAddress",
			},
			body: JSON.stringify({
				textQuery: query,
				maxResultCount: 1,
				locationBias: {
					circle: {
						center: { latitude: BIAS.latitude, longitude: BIAS.longitude },
						radius: BIAS.radiusMetres,
					},
				},
			}),
		},
	);

	if (!response.ok) {
		console.error(`  ✗ ${response.status} ${await response.text()}`);
		return null;
	}

	const { places } = (await response.json()) as { places?: Match[] };
	return places?.[0] ?? null;
}

async function main() {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		console.error(
			"GOOGLE_MAPS_API_KEY is not set. Add it to .env (see .env.example).",
		);
		process.exit(1);
	}

	// Imported lazily so the missing-key message above lands before Prisma's
	// client is pulled in.
	const { SPOTS } = await import("../prisma/seed");

	const lines: string[] = [];

	for (const spot of SPOTS) {
		if (spot.placeId) {
			console.log(`· ${spot.name} — already has a place ID, skipping`);
			continue;
		}

		const match = await searchPlace(`${spot.name} ${spot.cuisine}`, apiKey);
		if (!match) {
			console.log(`✗ ${spot.name} — no match`);
			continue;
		}

		// Print what Google actually matched, not just the ID. This is the whole
		// point of the manual review step.
		console.log(
			`✓ ${spot.name}\n    matched: ${match.displayName?.text ?? "?"} — ${match.formattedAddress ?? "?"}`,
		);
		lines.push(`  ${spot.id}: placeId: "${match.id}",`);
	}

	console.log(
		`\nChecked ${SPOTS.length} spots. Paste each line into the matching entry in prisma/seed.ts:\n`,
	);
	for (const line of lines) console.log(line);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
