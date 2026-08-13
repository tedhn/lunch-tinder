/**
 * Discovers lunch spots around the office with Places Nearby Search (New) and
 * prints them as `Seed` entries ready to paste into prisma/seed.ts.
 *
 *   bun scripts/fetch-nearby.ts
 *
 * It prints rather than writing the seed file, and that is the point. What
 * comes back is a radius of restaurants, not a lunch list: it will include the
 * petrol station kiosk, the place that shut last month, and three branches of
 * the same chain. Somebody has to look. The output is shaped so that looking
 * costs one pass down a terminal and the keeping is copy-paste.
 *
 * Two fields it deliberately cannot fill:
 *
 *   `halal`  — Google does not model halal certification, and inferring it from
 *              cuisine is how someone ends up at a lunch they cannot eat. Every
 *              entry comes out without it; add it where you have actually seen
 *              the certification.
 *   `emoji`  — guessed from the place's primary type, which is right often
 *              enough to be a starting point and wrong often enough to skim.
 *
 * On Google's terms: place IDs may be stored indefinitely, but names, price
 * levels and the rest are place *content*, capped at 30 days of caching. Pasted
 * into the seed file they become your own hand-maintained list, which is the
 * same footing the existing entries are on — but a script that wrote them
 * straight into the database on a schedule would not be.
 *
 * See also scripts/fill-place-ids.ts, which does the opposite: it finds the
 * place ID for a spot you already know about and have already written down.
 */

/** The office. Everything else here is relative to it — `walkMinutes` most of
 * all, which is the one field that does not travel. Same coordinates you would
 * put in a Maps search bar, in decimal degrees. */
const OFFICE = { latitude: 3.11796, longitude: 101.59441 };

/** Metres, offered as the default at the prompt. 800 is a bit over a
 * ten-minute walk, which is about the honest ceiling for a lunch break. */
const DEFAULT_RADIUS_METRES = 800;

/** Dollar signs, offered as the default at the prompt. 2 keeps the everyday
 * end and drops the places you go to for a birthday, not a Tuesday. */
const DEFAULT_MAX_PRICE = 2;

/** Nearby Search caps this at 20. */
const MAX_RESULTS = 20;

/** Rough walking pace in metres per minute — 80 is the usual planning figure
 * for a city pavement, and pointedly not a Distance Matrix call: that is a
 * second billed API for a number nobody checks with a stopwatch. */
const METRES_PER_MINUTE = 80;

type Place = {
	id: string;
	displayName?: { text?: string };
	primaryType?: string;
	types?: string[];
	priceLevel?: string;
	businessStatus?: string;
	location?: { latitude: number; longitude: number };
};

/**
 * Google's primary types are granular enough to pick a passable emoji from,
 * and the fallback is a plate. The cuisine label is derived from the same
 * place, so both are worth a skim before pasting.
 */
const BY_TYPE: Record<string, { emoji: string; cuisine: string }> = {
	acai_shop: { emoji: "🍇", cuisine: "Açaí" },
	afghani_restaurant: { emoji: "🍢", cuisine: "Afghan" },
	african_restaurant: { emoji: "🍲", cuisine: "African" },
	american_restaurant: { emoji: "🍔", cuisine: "American" },
	asian_restaurant: { emoji: "🥢", cuisine: "Asian" },
	bagel_shop: { emoji: "🥯", cuisine: "Bagels" },
	bakery: { emoji: "🥐", cuisine: "Bakery" },
	bar: { emoji: "🍺", cuisine: "Bar" },
	bar_and_grill: { emoji: "🍖", cuisine: "Bar & Grill" },
	barbecue_restaurant: { emoji: "🍖", cuisine: "Barbecue" },
	brazilian_restaurant: { emoji: "🥩", cuisine: "Brazilian" },
	breakfast_restaurant: { emoji: "🍳", cuisine: "Breakfast" },
	brunch_restaurant: { emoji: "🥞", cuisine: "Brunch" },
	buffet_restaurant: { emoji: "🍽️", cuisine: "Buffet" },
	cafe: { emoji: "☕", cuisine: "Cafe" },
	cafeteria: { emoji: "🍱", cuisine: "Cafeteria" },
	candy_store: { emoji: "🍬", cuisine: "Sweets" },
	chinese_restaurant: { emoji: "🥡", cuisine: "Chinese" },
	chocolate_shop: { emoji: "🍫", cuisine: "Chocolate" },
	coffee_shop: { emoji: "☕", cuisine: "Coffee" },
	dessert_restaurant: { emoji: "🍰", cuisine: "Dessert" },
	dessert_shop: { emoji: "🍨", cuisine: "Dessert" },
	diner: { emoji: "🥓", cuisine: "Diner" },
	donut_shop: { emoji: "🍩", cuisine: "Donuts" },
	fast_food_restaurant: { emoji: "🍟", cuisine: "Fast Food" },
	fine_dining_restaurant: { emoji: "🍷", cuisine: "Fine Dining" },
	food_court: { emoji: "🍜", cuisine: "Food Court" },
	french_restaurant: { emoji: "🥖", cuisine: "French" },
	greek_restaurant: { emoji: "🥙", cuisine: "Greek" },
	hamburger_restaurant: { emoji: "🍔", cuisine: "Burgers" },
	ice_cream_shop: { emoji: "🍦", cuisine: "Ice Cream" },
	indian_restaurant: { emoji: "🍛", cuisine: "Indian" },
	indonesian_restaurant: { emoji: "🍚", cuisine: "Indonesian" },
	italian_restaurant: { emoji: "🍝", cuisine: "Italian" },
	japanese_restaurant: { emoji: "🍣", cuisine: "Japanese" },
	juice_shop: { emoji: "🧃", cuisine: "Juice" },
	korean_restaurant: { emoji: "🍲", cuisine: "Korean" },
	lebanese_restaurant: { emoji: "🧆", cuisine: "Lebanese" },
	meal_takeaway: { emoji: "🥡", cuisine: "Takeaway" },
	mediterranean_restaurant: { emoji: "🫒", cuisine: "Mediterranean" },
	mexican_restaurant: { emoji: "🌮", cuisine: "Mexican" },
	middle_eastern_restaurant: { emoji: "🥙", cuisine: "Middle Eastern" },
	pizza_restaurant: { emoji: "🍕", cuisine: "Pizza" },
	pub: { emoji: "🍺", cuisine: "Pub" },
	ramen_restaurant: { emoji: "🍜", cuisine: "Ramen" },
	sandwich_shop: { emoji: "🥪", cuisine: "Sandwiches" },
	seafood_restaurant: { emoji: "🦐", cuisine: "Seafood" },
	spanish_restaurant: { emoji: "🥘", cuisine: "Spanish" },
	steak_house: { emoji: "🥩", cuisine: "Steak" },
	sushi_restaurant: { emoji: "🍣", cuisine: "Sushi" },
	tea_house: { emoji: "🍵", cuisine: "Tea" },
	thai_restaurant: { emoji: "🍤", cuisine: "Thai" },
	turkish_restaurant: { emoji: "🥙", cuisine: "Turkish" },
	vegan_restaurant: { emoji: "🌱", cuisine: "Vegan" },
	vegetarian_restaurant: { emoji: "🥗", cuisine: "Vegetarian" },
	vietnamese_restaurant: { emoji: "🥖", cuisine: "Vietnamese" },
};

/** Google's four-step scale onto the app's three dollar signs. UNSPECIFIED and
 * a missing field both fall to 1, which is the safe guess for a lunch radius. */
const PRICE: Record<string, 1 | 2 | 3> = {
	PRICE_LEVEL_FREE: 1,
	PRICE_LEVEL_INEXPENSIVE: 1,
	PRICE_LEVEL_MODERATE: 2,
	PRICE_LEVEL_EXPENSIVE: 3,
	PRICE_LEVEL_VERY_EXPENSIVE: 3,
};

/**
 * A number from the terminal, or the default on a bare Enter. Out-of-range and
 * non-numeric answers re-ask rather than silently falling back — a typo'd
 * radius is a billed call that returns the wrong neighbourhood.
 */
function askNumber(
	question: string,
	fallback: number,
	min: number,
	max: number,
): number {
	for (;;) {
		const answer = prompt(`${question} [${fallback}] `)?.trim();
		if (!answer) return fallback;

		const value = Number(answer);
		if (Number.isFinite(value) && value >= min && value <= max) {
			return Math.round(value);
		}
		console.log(`  Needs to be a number between ${min} and ${max}.`);
	}
}

/** Straight-line metres between two points. Real pavement is longer, which is
 * why the pace below is a walking pace and not a jogging one. */
function metresBetween(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number },
): number {
	const R = 6_371_000;
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const lat1 = toRad(a.latitude);
	const lat2 = toRad(b.latitude);

	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kebab-case id from the name, which is what the seed file uses as a stable
 * key. Collisions are possible across branches of a chain — the printed list
 * makes them visible, and they are yours to rename. */
function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 40) || "spot"
	);
}

async function main() {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		console.error(
			"GOOGLE_MAPS_API_KEY is not set. Add it to .env (see .env.example).",
		);
		process.exit(1);
	}

	const radiusMetres = askNumber(
		"Search radius in metres?",
		DEFAULT_RADIUS_METRES,
		50,
		50_000,
	);
	const maxPrice = askNumber(
		"Highest price level to keep (1 = $, 2 = $$, 3 = $$$)?",
		DEFAULT_MAX_PRICE,
		1,
		3,
	);
	console.log(
		`\nSearching ${radiusMetres}m around the office, up to ${"$".repeat(maxPrice)}…\n`,
	);

	const response = await fetch(
		"https://places.googleapis.com/v1/places:searchNearby",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Goog-Api-Key": apiKey,
				// Every field here has a billing cost, so this asks for exactly what
				// a seed entry needs and nothing else.
				"X-Goog-FieldMask": [
					"places.id",
					"places.displayName",
					"places.primaryType",
					"places.types",
					"places.priceLevel",
					"places.location",
					"places.businessStatus",
				].join(","),
			},
			body: JSON.stringify({
				includedTypes: ["restaurant"],
				maxResultCount: MAX_RESULTS,
				locationRestriction: {
					circle: { center: OFFICE, radius: radiusMetres },
				},
			}),
		},
	);

	if (!response.ok) {
		console.error(`Places nearby failed: ${response.status}`);
		console.error(await response.text());
		process.exit(1);
	}

	const { places = [] } = (await response.json()) as { places?: Place[] };

	// Google returns closed shops unless asked otherwise, and a deck full of
	// shuttered restaurants is the fastest way to lose trust in the app.
	const open = places.filter(
		(p) => !p.businessStatus || p.businessStatus === "OPERATIONAL",
	);
	const closed = places.length - open.length;

	// Nearby Search has no price filter of its own — that exists on Text Search
	// only — so the cap is applied here, after the call. A place Google has no
	// price for counts as 1: unpriced around here means a stall, not a tasting
	// menu, and dropping them would gut the cheap end of the deck.
	const priceOf = (p: Place) => (p.priceLevel ? (PRICE[p.priceLevel] ?? 1) : 1);
	const affordable = open.filter((p) => priceOf(p) <= maxPrice);
	const tooPricey = open.length - affordable.length;

	const entries = affordable.map((place) => {
		const name = place.displayName?.text ?? "Unnamed";
		const guess = place.primaryType ? BY_TYPE[place.primaryType] : undefined;
		const walk = place.location
			? Math.max(
					1,
					Math.round(metresBetween(OFFICE, place.location) / METRES_PER_MINUTE),
				)
			: 10;

		// `types` minus the generic ones makes a decent first pass at tags: they
		// are Google's vocabulary, not yours, so they read as placeholders.
		const tags = (place.types ?? [])
			.filter(
				(t) =>
					![
						"restaurant",
						"food",
						"point_of_interest",
						"establishment",
					].includes(t),
			)
			.slice(0, 3)
			.map((t) => t.replace(/_restaurant$/, "").replace(/_/g, "-"));

		return {
			text: [
				"\t{",
				`\t\tid: "${slugify(name)}",`,
				`\t\tname: ${JSON.stringify(name)},`,
				`\t\tcuisine: "${guess?.cuisine ?? "Restaurant"}",`,
				`\t\temoji: "${guess?.emoji ?? "🍽️"}",`,
				`\t\tpriceLevel: ${priceOf(place)},`,
				`\t\twalkMinutes: ${walk},`,
				`\t\ttags: [${tags.map((t) => `"${t}"`).join(", ")}],`,
				`\t\tplaceId: "${place.id}",`,
				"\t},",
			].join("\n"),
			walk,
		};
	});

	// Nearest first: the list is going to be edited by hand, and walking distance
	// is the thing most likely to decide what stays.
	entries.sort((a, b) => a.walk - b.walk);

	// Every drop is reported. A filter that quietly removes half the results
	// reads as "there is nothing near the office" when it is really "you asked
	// for one dollar sign".
	const dropped = [
		closed > 0 ? `${closed} permanently closed` : null,
		tooPricey > 0 ? `${tooPricey} above ${"$".repeat(maxPrice)}` : null,
	].filter(Boolean);

	console.log(
		`// ${entries.length} spots within ${radiusMetres}m of the office` +
			(dropped.length > 0 ? `, ${dropped.join(", ")} dropped` : "") +
			"\n// Review before pasting into SPOTS in prisma/seed.ts. `halal` is left\n" +
			"// off every entry on purpose — set it only where you have checked.\n",
	);
	for (const entry of entries) console.log(entry.text);

	if (places.length === MAX_RESULTS) {
		console.log(
			`\n// Hit the ${MAX_RESULTS}-result cap, so this is not everything in range.` +
				"\n// Search a smaller radius from a second centre to reach the rest.",
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
