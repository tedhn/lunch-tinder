/**
 * The cards the video swipes through, and the result it lands on.
 *
 * Every field here is copied from prisma/seed.ts — real spots within 800m of the
 * Ara Damansara office, with their real walk times and price levels. The video
 * shows six of the twenty because that is what fits in the runtime; the deck
 * counter still says 20, which is the actual `DECK_SIZE`.
 *
 * `halal` is unset on all of them, exactly as in the seed file: Google does not
 * model halal status, and the video is not the place to start inventing it.
 */
export type Spot = {
	id: string;
	name: string;
	cuisine: string;
	emoji: string;
	priceLevel: 1 | 2 | 3;
	walkMinutes: number;
	tags: string[];
};

export const DECK_SIZE = 20;

export const SPOTS: Spot[] = [
	{
		id: "yan-wo-seafood",
		name: "Yan Wo Seafood",
		cuisine: "Seafood",
		emoji: "🦐",
		priceLevel: 2,
		walkMinutes: 5,
		tags: ["seafood", "chinese"],
	},
	{
		id: "jatujak",
		name: "Jatujak Bangkok Street Food",
		cuisine: "Thai",
		emoji: "🍤",
		priceLevel: 2,
		walkMinutes: 6,
		tags: ["thai", "street-food", "grill"],
	},
	{
		id: "dozo",
		name: "Dozo",
		cuisine: "Japanese",
		emoji: "🍣",
		priceLevel: 2,
		walkMinutes: 6,
		tags: ["japanese", "sushi", "aircon"],
	},
	{
		id: "heritage-kopitiam",
		name: "Heritage Kopitiam",
		cuisine: "Kopitiam",
		emoji: "☕",
		priceLevel: 1,
		walkMinutes: 7,
		tags: ["kopitiam", "local-favourite", "quick"],
	},
	{
		id: "pj-khao-man-gai",
		name: "PJ Khao Man Gai",
		cuisine: "Thai",
		emoji: "🍗",
		priceLevel: 1,
		walkMinutes: 7,
		tags: ["thai", "chicken-rice", "quick"],
	},
	{
		id: "mongddang",
		name: "Mongddang Korean BBQ",
		cuisine: "Korean BBQ",
		emoji: "🍖",
		priceLevel: 2,
		walkMinutes: 7,
		tags: ["korean", "grill", "long-lunch"],
	},
];

/** Which way each card goes, in order. Two rights, a left, a right — enough to
 * show both stamps and both directions without the video becoming a metronome. */
export const SWIPES: ("like" | "pass")[] = ["like", "pass", "like", "like"];

export const ROOM_CODE = "8DHV";

export const MEMBERS = [
	{ name: "Ted", online: true, done: true },
	{ name: "J", online: true, done: true },
	{ name: "Hafiz", online: false, done: false },
];

/**
 * The tie is the interesting case, so the video shows one: three spots level on
 * votes, settled by the shorter walk and said out loud rather than crowned
 * silently. Mirrors the `tie` field tallyRoom returns.
 */
export const RESULT = {
	winner: SPOTS[0] as Spot,
	likes: 2,
	voters: 3,
	likedBy: ["Ted", "J"],
	tie: { count: 3, brokenBy: "walk" as const },
	runnersUp: [
		{ spot: SPOTS[2] as Spot, likes: 2 },
		{ spot: SPOTS[5] as Spot, likes: 2 },
		{ spot: SPOTS[4] as Spot, likes: 1 },
	],
};
