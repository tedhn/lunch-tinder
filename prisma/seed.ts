/**
 * Curated lunch spots — the deck source.
 *
 * The current list is walking distance from the Ara Damansara office. It was
 * drafted by `bun scripts/fetch-nearby.ts` (Places Nearby Search, 800m, up to
 * $$) and then edited by hand: cuisines and emoji corrected where Google's
 * primary type was only "restaurant", ids shortened, and Google's raw `types`
 * rewritten as tags a human would use.
 *
 * That editing pass is the point, not overhead. A radius of restaurants is not
 * a lunch list, and this file being hand-maintained is also what keeps it clear
 * of Google's caching rules: place IDs may be stored indefinitely, but fetched
 * place content — names, price levels, photos — is capped at 30 days. Nothing
 * here is refreshed from Google on a schedule; card photos are fetched live
 * through /api/place-photo/[id] instead.
 *
 * `googleUrl` is derived from the name, so it is a Maps *search* link unless a
 * `placeId` is set, which pins it to the exact shop.
 *
 * Edit this file for your own office and re-run `bun run db:seed`. Rows are
 * upserted by id, so editing a name or walk time updates in place; an entry
 * dropped from the array is deactivated rather than deleted, which keeps past
 * rooms intact.
 *
 * `walkMinutes` is measured from the office, so it is the one field you must
 * localise. Everything else travels fine.
 */
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

export type Seed = {
	id: string;
	name: string;
	cuisine: string;
	emoji: string;
	priceLevel: 1 | 2 | 3;
	walkMinutes: number;
	tags: string[];
	/** Leave undefined unless you have seen the certification or the signage
	 * yourself. Undefined shows no badge at all; `false` says "checked, and it
	 * is not". Google does not model halal status and guessing it from cuisine
	 * is how someone ends up at a lunch they cannot eat, so every entry below —
	 * all of them drafted from Places — is unset. */
	halal?: boolean;
	/** Google place ID, if you have looked one up. Pins the Maps link to the
	 * exact shop instead of leaving Maps to guess from the name, and is what
	 * /api/place-photo/[id] needs to fetch a photo. Fill these in by running
	 * `bun scripts/fill-place-ids.ts`. */
	placeId?: string;
};

/** Exported so scripts/fill-place-ids.ts can read the list without duplicating
 * it. Importing this file does not seed anything — see the guard at the end.
 * Ordered by walking distance, nearest first. */
export const SPOTS: Seed[] = [
	{
		id: "yan-wo-seafood",
		name: "Yan Wo Seafood Restaurant (Aman Suria)",
		cuisine: "Seafood",
		emoji: "🦐",
		priceLevel: 2,
		walkMinutes: 5,
		tags: ["seafood", "chinese"],
		placeId: "ChIJXUUsWNVPzDERzOOnLLbnH0E",
	},
	{
		id: "jatujak",
		name: "Jatujak Bangkok Street Food",
		cuisine: "Thai",
		emoji: "🍤",
		priceLevel: 2,
		walkMinutes: 6,
		tags: ["thai", "street-food", "grill"],
		placeId: "ChIJ0awL4phOzDER8GmP5QWIajk",
	},
	{
		id: "dozo",
		name: "Dozo Cantara Retail, Ara Damansara",
		cuisine: "Japanese",
		emoji: "🍣",
		priceLevel: 2,
		walkMinutes: 6,
		tags: ["japanese", "sushi", "aircon"],
		placeId: "ChIJSd6bantPzDER_G6iGrmQUPw",
	},
	{
		id: "sun-yin-loong",
		name: "Restoran Sun Yin Loong",
		cuisine: "Chinese",
		emoji: "🥡",
		priceLevel: 1,
		walkMinutes: 6,
		tags: ["chinese", "kopitiam", "breakfast"],
		placeId: "ChIJW8bid6ROzDERsL_KPxh6pnw",
	},
	{
		id: "pj-khao-man-gai",
		name: "PJ Khao Man Gai",
		cuisine: "Thai",
		emoji: "🍗",
		priceLevel: 1,
		walkMinutes: 7,
		tags: ["thai", "chicken-rice", "quick"],
		placeId: "ChIJP3zW3NxPzDERkjEL3B1h9PM",
	},
	{
		id: "shan-mu-cafe",
		name: "Shan Mu Cafe PJ",
		cuisine: "Japanese",
		emoji: "🍱",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["japanese", "cafe", "aircon"],
		placeId: "ChIJh4payjBPzDERqJCVQ-5Cyno",
	},
	{
		id: "yan-wo-thai",
		name: "Yan Wo Thai",
		cuisine: "Thai",
		emoji: "🍜",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["thai", "spicy"],
		placeId: "ChIJXYeWlFtPzDERopW991RqxzY",
	},
	{
		id: "kuan-kei",
		name: "Kuan Kei Seafood Restaurant",
		cuisine: "Seafood",
		emoji: "🦑",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["chinese", "seafood", "big-lunch"],
		placeId: "ChIJL_xIxgxPzDERKBU7FJ3Lgow",
	},
	{
		id: "bm-yam-rice",
		name: "大山脚 BM Yam Rice @ Ara Damansara",
		cuisine: "Chinese",
		emoji: "🍚",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["chinese", "yam-rice", "comfort"],
		placeId: "ChIJQX2TsY9PzDER0KCXZXAEBvo",
	},
	{
		id: "sangong-hot-pot",
		name: "Sangong Charcoal Hot Pot • Ara Damansara",
		cuisine: "Hot Pot",
		emoji: "🍲",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["hot-pot", "long-lunch", "aircon"],
		placeId: "ChIJ20KqYgtPzDERlclnQmarZlo",
	},
	{
		id: "heritage-kopitiam",
		name: "Heritage Kopitiam 大马茶室 (Ara Damansara)",
		cuisine: "Kopitiam",
		emoji: "☕",
		priceLevel: 1,
		walkMinutes: 7,
		tags: ["kopitiam", "local-favourite", "quick"],
		placeId: "ChIJ-7CcE8hPzDERlB96Y0bugFU",
	},
	{
		id: "mongddang",
		name: "Mongddang korean bbq(Ara Damansara)",
		cuisine: "Korean BBQ",
		emoji: "🍖",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["korean", "grill", "long-lunch"],
		placeId: "ChIJ8wzU7L9PzDERLB5FUcgYiXU",
	},
	{
		id: "wartek",
		name: "WARTEK",
		cuisine: "Indonesian",
		emoji: "🍚",
		priceLevel: 2,
		walkMinutes: 8,
		tags: ["indonesian", "rice", "spicy"],
		placeId: "ChIJ4y4oKsxPzDERxJG4Ogvehhk",
	},
	{
		id: "ara-thai-buffet",
		name: "Ara Thai Buffet - Steamboat & Grill",
		cuisine: "Thai Buffet",
		emoji: "🍢",
		priceLevel: 2,
		walkMinutes: 8,
		tags: ["buffet", "steamboat", "big-lunch"],
		placeId: "ChIJE2c7PMlPzDEREPFhnmeZ2Es",
	},
	{
		id: "yuen-kee",
		name: "Restoran Yuen Kee Steamed Fish Head",
		cuisine: "Seafood",
		emoji: "🐟",
		priceLevel: 2,
		walkMinutes: 8,
		tags: ["chinese", "fish-head", "sharing"],
		placeId: "ChIJ9bf8ZqROzDERScXV3BkF6eo",
	},
	{
		id: "uncle-soon",
		name: "Uncle Soon Fried Rice • Ara Damansara",
		cuisine: "Fried Rice",
		emoji: "🍳",
		priceLevel: 1,
		walkMinutes: 8,
		tags: ["chinese", "wok-hei", "quick"],
		placeId: "ChIJi3dWJgBPzDER4CG7Jz5uF4o",
	},
	{
		id: "asap-by-lye",
		name: "Asap by Lye",
		cuisine: "Barbecue",
		emoji: "🔥",
		priceLevel: 2,
		walkMinutes: 9,
		tags: ["barbecue", "smoky", "treat"],
		placeId: "ChIJoc0J-2NPzDERQ5n_i14Qn30",
	},
	{
		id: "born-butcher",
		name: "Born Butcher",
		cuisine: "Western",
		emoji: "🥩",
		priceLevel: 2,
		walkMinutes: 9,
		tags: ["western", "steak", "aircon"],
		placeId: "ChIJIeQ9bj1PzDER0gwwen4Sc3A",
	},
	{
		id: "thong-kee",
		name: "Thong Kee Malaysia Kopitiam Ara Damansara",
		cuisine: "Kopitiam",
		emoji: "🍞",
		priceLevel: 1,
		walkMinutes: 10,
		tags: ["kopitiam", "cheap", "quick"],
		placeId: "ChIJcYTwB-lPzDERhy642z5XpXI",
	},
	{
		id: "yat-yeh-hing",
		name: "Restoran Yat Yeh Hing",
		cuisine: "Chinese",
		emoji: "🍲",
		priceLevel: 1,
		walkMinutes: 10,
		tags: ["chinese", "seafood", "no-aircon"],
		placeId: "ChIJO5zNLgBMzDERZjA-q-2p1jU",
	},
];

/**
 * Google Maps URLs, the documented cross-platform form: it opens the native app
 * on a phone and the web map on a desktop. `query_place_id` still needs `query`
 * alongside it, so the name is always included.
 */
function googleMapsUrl(name: string, placeId?: string): string {
	const url = new URL("https://www.google.com/maps/search/");
	url.searchParams.set("api", "1");
	url.searchParams.set("query", name);
	if (placeId) url.searchParams.set("query_place_id", placeId);
	return url.toString();
}

async function main() {
	for (const spot of SPOTS) {
		const data = {
			name: spot.name,
			cuisine: spot.cuisine,
			emoji: spot.emoji,
			priceLevel: spot.priceLevel,
			walkMinutes: spot.walkMinutes,
			tags: spot.tags,
			halal: spot.halal ?? null,
			placeId: spot.placeId ?? null,
			googleUrl: googleMapsUrl(spot.name, spot.placeId),
			active: true,
		};

		await db.restaurant.upsert({
			where: { id: spot.id },
			create: { id: spot.id, ...data },
			update: data,
		});
	}

	// Anything no longer in the list stops appearing in new decks, but the row
	// stays: past rooms hold restaurant ids in `deck_ids` and swipes reference
	// them, so deleting would tear holes in rooms that have already happened.
	const retired = await db.restaurant.updateMany({
		where: { id: { notIn: SPOTS.map((s) => s.id) }, active: true },
		data: { active: false },
	});

	console.log(
		`Seeded ${SPOTS.length} restaurants` +
			(retired.count > 0 ? `, retired ${retired.count} no longer listed` : "") +
			".",
	);
}

// Only when run directly (`bun run db:seed`). Importing SPOTS from a script
// must not quietly write to the database. `import.meta.main` is Bun's, and the
// cast is because this project types against @types/node rather than bun-types.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
	main()
		.catch((err) => {
			console.error(err);
			process.exit(1);
		})
		.finally(() => db.$disconnect());
}
