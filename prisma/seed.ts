/**
 * Curated lunch spots — the deck source.
 *
 * This list is hand-maintained rather than fetched. `googleUrl` is derived from
 * the name here, so it is a Google Maps *search* link unless you supply a
 * `placeId` — good enough to hand off once a room agrees, and exact if you do.
 *
 * Only the place ID and your own typed-in fields are stored. Google Maps
 * Platform terms cap caching of fetched place content (names, price levels,
 * photos) at 30 days; place IDs are exempt and may be kept indefinitely. Keeping
 * this file hand-written is what avoids that refresh obligation entirely.
 *
 * Edit this file for your own office and re-run `bun run db:seed`. Rows are
 * upserted by id, so editing a name or walk time updates in place, and dropping
 * an entry from the array leaves the old row alone — set `active: false` on it
 * instead if you want it out of future decks.
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
	 * is not". Guessing from cuisine is how someone ends up at a lunch they
	 * cannot eat, so the seed below only marks the spots already tagged halal. */
	halal?: boolean;
	/** Google place ID, if you have looked one up. Pins the Maps link to the
	 * exact shop instead of leaving Maps to guess from the name, and is what
	 * /api/place-photo/[id] needs to fetch a photo. Fill these in by running
	 * `bun scripts/fill-place-ids.ts`. */
	placeId?: string;
};

/** Exported so scripts/fill-place-ids.ts can read the list without duplicating
 * it. Importing this file does not seed anything — see the guard at the end. */
export const SPOTS: Seed[] = [
	{
		id: "pelita",
		name: "Nasi Kandar Pelita",
		cuisine: "Nasi Kandar",
		emoji: "🍛",
		priceLevel: 1,
		walkMinutes: 6,
		tags: ["halal", "quick", "spicy"],
		halal: true,
	},
	{
		id: "village-park",
		name: "Village Park Restaurant",
		cuisine: "Nasi Lemak",
		emoji: "🥥",
		priceLevel: 1,
		walkMinutes: 14,
		tags: ["halal", "local-favourite", "queue"],
		halal: true,
	},
	{
		id: "yut-kee",
		name: "Yut Kee Restaurant",
		cuisine: "Hainanese",
		emoji: "🍤",
		priceLevel: 1,
		walkMinutes: 11,
		tags: ["local-favourite", "old-school"],
	},
	{
		id: "sri-nirwana",
		name: "Sri Nirwana Maju",
		cuisine: "Banana Leaf",
		emoji: "🍌",
		priceLevel: 1,
		walkMinutes: 9,
		tags: ["indian", "vegetarian-friendly", "messy"],
	},
	{
		id: "wong-kee",
		name: "Wong Kee Claypot Chicken Rice",
		cuisine: "Chinese",
		emoji: "🍲",
		priceLevel: 1,
		walkMinutes: 8,
		tags: ["comfort", "slow-cooked"],
	},
	{
		id: "ah-cheng-laksa",
		name: "Ah Cheng Laksa",
		cuisine: "Laksa",
		emoji: "🍜",
		priceLevel: 1,
		walkMinutes: 7,
		tags: ["noodles", "spicy", "quick"],
	},
	{
		id: "restoran-yusoof",
		name: "Restoran Yusoof Dan Zakhir",
		cuisine: "Mamak",
		emoji: "🫓",
		priceLevel: 1,
		walkMinutes: 5,
		tags: ["halal", "quick", "roti"],
		halal: true,
	},
	{
		id: "kim-lian-kee",
		name: "Kim Lian Kee Hokkien Mee",
		cuisine: "Hokkien Mee",
		emoji: "🍝",
		priceLevel: 1,
		walkMinutes: 12,
		tags: ["noodles", "smoky", "heavy"],
	},
	{
		id: "sushi-zanmai",
		name: "Sushi Zanmai",
		cuisine: "Japanese",
		emoji: "🍣",
		priceLevel: 2,
		walkMinutes: 10,
		tags: ["mall", "aircon", "raw"],
	},
	{
		id: "ichiran-style-ramen",
		name: "Menya Musashi",
		cuisine: "Ramen",
		emoji: "🍥",
		priceLevel: 2,
		walkMinutes: 10,
		tags: ["japanese", "aircon", "rich"],
	},
	{
		id: "boat-noodle",
		name: "Boat Noodle",
		cuisine: "Thai",
		emoji: "🛶",
		priceLevel: 1,
		walkMinutes: 10,
		tags: ["halal", "small-bowls", "spicy"],
		halal: true,
	},
	{
		id: "nando-s",
		name: "Nando's",
		cuisine: "Portuguese Grill",
		emoji: "🔥",
		priceLevel: 2,
		walkMinutes: 9,
		tags: ["halal", "chicken", "aircon"],
		halal: true,
	},
	{
		id: "vcr",
		name: "VCR",
		cuisine: "Cafe",
		emoji: "☕",
		priceLevel: 2,
		walkMinutes: 13,
		tags: ["brunch", "coffee", "quiet"],
	},
	{
		id: "merchants-lane",
		name: "Merchant's Lane",
		cuisine: "Cafe",
		emoji: "🥐",
		priceLevel: 2,
		walkMinutes: 15,
		tags: ["brunch", "instagram", "queue"],
	},
	{
		id: "din-tai-fung",
		name: "Din Tai Fung",
		cuisine: "Taiwanese",
		emoji: "🥟",
		priceLevel: 3,
		walkMinutes: 11,
		tags: ["dumplings", "mall", "reliable"],
	},
	{
		id: "restoran-beh-brothers",
		name: "Restoran Beh Brothers",
		cuisine: "Pan Mee",
		emoji: "🍲",
		priceLevel: 1,
		walkMinutes: 9,
		tags: ["noodles", "chilli", "quick"],
	},
	{
		id: "nasi-lemak-wanjo",
		name: "Nasi Lemak Wanjo Kampung Baru",
		cuisine: "Nasi Lemak",
		emoji: "🍚",
		priceLevel: 1,
		walkMinutes: 16,
		tags: ["halal", "local-favourite", "spicy"],
		halal: true,
	},
	{
		id: "ss2-chap-fan",
		name: "Economy Rice Stall",
		cuisine: "Mixed Rice",
		emoji: "🍱",
		priceLevel: 1,
		walkMinutes: 4,
		tags: ["cheap", "quick", "point-and-pick"],
	},
	{
		id: "subway",
		name: "Subway",
		cuisine: "Sandwiches",
		emoji: "🥪",
		priceLevel: 2,
		walkMinutes: 3,
		tags: ["light", "quick", "desk-lunch"],
	},
	{
		id: "salad-atelier",
		name: "Salad Atelier",
		cuisine: "Salads",
		emoji: "🥗",
		priceLevel: 2,
		walkMinutes: 8,
		tags: ["healthy", "light", "build-your-own"],
	},
	{
		id: "restoran-rebung",
		name: "Restoran Rebung",
		cuisine: "Malay Buffet",
		emoji: "🍛",
		priceLevel: 3,
		walkMinutes: 18,
		tags: ["halal", "buffet", "big-lunch"],
		halal: true,
	},
	{
		id: "kedai-kopi-lai-foong",
		name: "Kedai Kopi Lai Foong",
		cuisine: "Beef Noodles",
		emoji: "🐄",
		priceLevel: 1,
		walkMinutes: 12,
		tags: ["old-school", "noodles", "no-aircon"],
	},
	{
		id: "gyu-kaku-lunch-set",
		name: "Gyu-Kaku",
		cuisine: "Yakiniku",
		emoji: "🥩",
		priceLevel: 3,
		walkMinutes: 11,
		tags: ["treat", "aircon", "long-lunch"],
	},
	{
		id: "banh-mi-cafe",
		name: "Bánh Mì Cafe",
		cuisine: "Vietnamese",
		emoji: "🥖",
		priceLevel: 1,
		walkMinutes: 7,
		tags: ["light", "quick", "takeaway"],
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

	console.log(`Seeded ${SPOTS.length} restaurants.`);
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
