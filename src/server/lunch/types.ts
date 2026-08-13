import type { Restaurant } from "generated/prisma";

export const ROOM_PHASES = ["lobby", "swiping", "results"] as const;
export type RoomPhase = (typeof ROOM_PHASES)[number];

export const CODE_LENGTH = 4;

/** Rooms are swept once idle for this long. A lunch decision is short-lived. */
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;

/**
 * Note there is no `connected` flag here. Presence is tracked over the Realtime
 * channel rather than in Postgres — writing a heartbeat column would broadcast
 * a row change to every client, which would invalidate their state query, which
 * would heartbeat again.
 */
export type MemberView = {
	userId: string;
	name: string;
	swipedCount: number;
	done: boolean;
};

export type Tallied = {
	place: Restaurant;
	likes: number;
	unanimous: boolean;
	likedBy: string[];
};

/**
 * A tie for first place, and the rule that settled it. Null when the winner won
 * outright. See describeTie — this exists so the results screen can say why,
 * rather than presenting a coin toss as a verdict.
 */
export type TieBreak = {
	/** How many spots share the winning vote count, the winner included. */
	count: number;
	brokenBy: "unanimous" | "walk" | "name";
};

export type RoomView = {
	code: string;
	phase: RoomPhase;
	hostId: string;
	members: MemberView[];
	deckSize: number;
	/** Empty while the room is still in the lobby. */
	deck: Restaurant[];
	/** When the votes get counted regardless of who has finished. Null on rooms
	 * that predate the deadline, and irrelevant once the phase is "results". */
	votingEndsAt: Date | null;
	/** Populated only once the phase is "results" — see tallyRoom. */
	results: {
		ranked: Tallied[];
		memberCount: number;
		tie: TieBreak | null;
	} | null;
};

export function isRoomPhase(value: string): value is RoomPhase {
	return (ROOM_PHASES as readonly string[]).includes(value);
}
