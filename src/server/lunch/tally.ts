import type { Member, Restaurant, Swipe } from "generated/prisma";

import type { MemberView, Tallied, TieBreak } from "./types";

export function toMemberViews(
	members: Member[],
	deckSize: number,
): MemberView[] {
	return members
		.map((m) => ({
			userId: m.userId,
			name: m.name,
			swipedCount: m.swipedCount,
			done: deckSize > 0 && m.swipedCount >= deckSize,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Everyone in the room has swiped the whole deck. Absent members still count. */
export function allDone(members: Member[], deckSize: number): boolean {
	if (members.length === 0 || deckSize === 0) return false;
	return members.every((m) => m.swipedCount >= deckSize);
}

/**
 * Ranks the deck by like count. Only ever called once a room reaches "results"
 * — individual votes must never reach a client while people are still swiping.
 *
 * "Participants" are members who swiped at least one card, so a lurker who
 * joined and did nothing cannot make a unanimous pick impossible.
 */
export function tallyRoom(
	deck: Restaurant[],
	members: Member[],
	swipes: Swipe[],
): { ranked: Tallied[]; memberCount: number; tie: TieBreak | null } {
	const participants = members.filter((m) => m.swipedCount > 0);
	const nameOf = new Map(participants.map((m) => [m.userId, m.name]));
	const memberCount = participants.length;

	const likersOf = new Map<string, string[]>();
	for (const swipe of swipes) {
		if (!swipe.like || !nameOf.has(swipe.userId)) continue;
		const bucket = likersOf.get(swipe.restaurantId);
		if (bucket) bucket.push(swipe.userId);
		else likersOf.set(swipe.restaurantId, [swipe.userId]);
	}

	const ranked: Tallied[] = deck.map((place) => {
		const likers = likersOf.get(place.id) ?? [];
		return {
			place,
			likes: likers.length,
			unanimous: memberCount > 0 && likers.length === memberCount,
			likedBy: likers.map((id) => nameOf.get(id) as string),
		};
	});

	ranked.sort(
		(a, b) =>
			b.likes - a.likes ||
			Number(b.unanimous) - Number(a.unanimous) ||
			a.place.walkMinutes - b.place.walkMinutes ||
			a.place.name.localeCompare(b.place.name),
	);

	return { ranked, memberCount, tie: describeTie(ranked) };
}

/**
 * Whether the top spot was actually a tie, and what settled it.
 *
 * The sort above already breaks ties — closest walk, then alphabetically — but
 * doing that silently is the problem: two spots on three votes each, one of them
 * crowned with no explanation, reads as the app having an opinion it did not
 * earn. Naming the rule turns "why that one?" into a sentence, and if the room
 * disagrees, "Go again" is right there.
 *
 * Null when there is nothing to explain: no votes at all, or a clear winner.
 */
function describeTie(ranked: Tallied[]): TieBreak | null {
	const winner = ranked[0];
	const runnerUp = ranked[1];
	if (!winner || !runnerUp || winner.likes === 0) return null;
	if (winner.likes !== runnerUp.likes) return null;

	const count = ranked.filter((r) => r.likes === winner.likes).length;

	// Read in the same order as the sort, so the reason given is the rule that
	// actually decided it.
	if (winner.unanimous !== runnerUp.unanimous) {
		return { count, brokenBy: "unanimous" };
	}
	if (winner.place.walkMinutes !== runnerUp.place.walkMinutes) {
		return { count, brokenBy: "walk" };
	}
	return { count, brokenBy: "name" };
}
