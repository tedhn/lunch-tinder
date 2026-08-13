import { TRPCError } from "@trpc/server";
import type { PrismaClient, Restaurant, Room } from "generated/prisma";
import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { normalizeCode, randomRoomCode, shuffle } from "~/server/lunch/deck";
import { tallyRoom, toMemberViews } from "~/server/lunch/tally";
import {
	CODE_LENGTH,
	isRoomPhase,
	type RoomPhase,
	type RoomView,
} from "~/server/lunch/types";

const codeInput = z
	.string()
	.trim()
	.length(CODE_LENGTH)
	.transform(normalizeCode);

/** Client-generated and kept in localStorage — see src/lib/user.ts. */
const userIdInput = z.string().uuid();

const nameInput = z.string().trim().min(1).max(24);

const identity = z.object({ code: codeInput, userId: userIdInput });

/**
 * Any member may start or reset a round; counting the votes early is the host's.
 *
 * The asymmetry is deliberate. Starting and resetting are recoverable — press
 * again, shuffle again — but counting early throws away votes nobody has cast
 * yet, and it only takes one impatient person to do that to five others. A host
 * whose phone dies costs nobody anything either: the deadline still lands, which
 * is why it is a deadline and not a button.
 */
async function requireMembership(
	db: PrismaClient,
	code: string,
	userId: string,
) {
	const member = await db.member.findUnique({
		where: { roomCode_userId: { roomCode: code, userId } },
	});
	if (!member) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Join the room before doing that.",
		});
	}
	return member;
}

/** Rooms opened before `host_id` existed default it to "", which no user id can
 * equal, so those rooms have no host and simply run to their deadline. */
function requireHost(room: Room, userId: string) {
	if (room.hostId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only whoever started the room can count the votes early.",
		});
	}
}

async function requireRoom(db: PrismaClient, code: string): Promise<Room> {
	const room = await db.room.findUnique({ where: { code } });
	if (!room) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `No room ${code}. Check the code, or start a new round.`,
		});
	}
	return room;
}

function phaseOf(room: Room): RoomPhase {
	return isRoomPhase(room.phase) ? room.phase : "lobby";
}

/** Restores the frozen deck order; `findMany` gives no ordering guarantee. */
function orderDeck(deckIds: string[], places: Restaurant[]): Restaurant[] {
	const byId = new Map(places.map((p) => [p.id, p]));
	return deckIds
		.map((id) => byId.get(id))
		.filter((p): p is Restaurant => p !== undefined);
}

/**
 * Progress per member, counted from the swipe rows themselves.
 *
 * `member.swiped_count` is a cache that exists to make a swipe broadcast a row
 * change over Realtime — it is not the truth. Reading the rows here means a
 * count that drifted for any reason corrects itself on the next fetch instead of
 * leaving somebody stuck at 19/20 on everybody's screen with no card left to
 * swipe and no way back.
 */
async function countsByMember(
	db: PrismaClient,
	code: string,
): Promise<Map<string, number>> {
	const grouped = await db.swipe.groupBy({
		by: ["userId"],
		where: { roomCode: code },
		_count: { _all: true },
	});
	return new Map(grouped.map((g) => [g.userId, g._count._all]));
}

async function buildRoomView(db: PrismaClient, room: Room): Promise<RoomView> {
	const [stored, counts] = await Promise.all([
		db.member.findMany({
			where: { roomCode: room.code },
			orderBy: { joinedAt: "asc" },
		}),
		countsByMember(db, room.code),
	]);

	const members = stored.map((m) => ({
		...m,
		swipedCount: counts.get(m.userId) ?? 0,
	}));

	let phase = phaseOf(room);

	// A read that also finishes the round, which is unusual enough to explain.
	//
	// A round ends two ways and two ways only: the deadline passes, or the host
	// says so. Everyone having swiped is deliberately not one of them — a late
	// arrival can still join and vote until the clock runs out, and the room gets
	// the full ten minutes it was promised rather than however long the fastest
	// swiper took.
	//
	// Which leaves the deadline needing something to notice it. Nothing here is
	// scheduled — no cron, no worker — so "the votes are counted at 12:40" has to
	// become true when somebody looks. Every client polls this every 30s and the
	// countdown asks for a read the moment it hits zero, so in practice a round
	// closes within a second of expiring. Idempotent, so concurrent readers
	// racing to close the same room is fine.
	const expired =
		room.votingEndsAt !== null && room.votingEndsAt.getTime() <= Date.now();

	if (phase === "swiping" && expired) {
		await db.room.update({
			where: { code: room.code },
			data: { phase: "results", lastActivity: new Date() },
		});
		phase = "results";
	}

	// The lobby has no need for card data, and shipping it early would let a
	// curious member read the whole deck before anyone starts.
	const deck =
		phase === "lobby"
			? []
			: orderDeck(
					room.deckIds,
					await db.restaurant.findMany({ where: { id: { in: room.deckIds } } }),
				);

	// Individual votes stay on the server until the room reaches "results".
	const results =
		phase === "results"
			? tallyRoom(
					deck,
					members,
					await db.swipe.findMany({ where: { roomCode: room.code } }),
				)
			: null;

	return {
		code: room.code,
		phase,
		hostId: room.hostId,
		members: toMemberViews(members, room.deckIds.length),
		deckSize: room.deckIds.length,
		deck,
		votingEndsAt: phase === "swiping" ? room.votingEndsAt : null,
		results,
	};
}

/** When a round started now would close. */
function roundDeadline(): Date {
	return new Date(Date.now() + env.ROUND_MINUTES * 60_000);
}

export const roomRouter = createTRPCRouter({
	/**
	 * Opens a room with a frozen, shuffled deck and the caller as first member,
	 * already swiping.
	 *
	 * There is no waiting room. Lunch decisions are made by people who are
	 * already hungry, and a screen that says "waiting for others" before anybody
	 * can do anything is a screen where somebody gives up and suggests the usual
	 * place. Everyone swipes their own copy of the same frozen deck whenever they
	 * arrive; the round is decided by the tally, not by starting together.
	 */
	create: publicProcedure
		.input(z.object({ userId: userIdInput, name: nameInput }))
		.mutation(async ({ ctx, input }) => {
			const places = await ctx.db.restaurant.findMany({
				where: { active: true },
				select: { id: true },
			});

			if (places.length === 0) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message:
						"No restaurants seeded yet. Run `bun run db:seed` to fill the deck.",
				});
			}

			// Codes are short enough to collide, so retry rather than assume.
			for (let attempt = 0; attempt < 20; attempt++) {
				const code = randomRoomCode();
				const deckIds = shuffle(
					places.map((p) => p.id),
					code,
				).slice(0, env.DECK_SIZE);

				const created = await ctx.db.room
					.create({
						data: {
							code,
							hostId: input.userId,
							phase: "swiping",
							votingEndsAt: roundDeadline(),
							deckIds,
							members: {
								create: { userId: input.userId, name: input.name },
							},
						},
					})
					.catch((err: unknown) => {
						if (
							err instanceof Error &&
							"code" in err &&
							(err as { code?: string }).code === "P2002"
						) {
							return null; // Code taken — try another.
						}
						throw err;
					});

				if (created) return { code: created.code };
			}

			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Could not allocate a free room code. Try again.",
			});
		}),

	/**
	 * Upsert by userId, so a phone that locks and reconnects resumes as the same
	 * member instead of appearing twice. Joining mid-round is normal, not an edge
	 * case — a late arrival simply has more cards left than everybody else.
	 */
	join: publicProcedure
		.input(z.object({ code: codeInput, userId: userIdInput, name: nameInput }))
		.mutation(async ({ ctx, input }) => {
			const room = await requireRoom(ctx.db, input.code);

			await ctx.db.member.upsert({
				where: {
					roomCode_userId: { roomCode: room.code, userId: input.userId },
				},
				create: {
					roomCode: room.code,
					userId: input.userId,
					name: input.name,
				},
				update: { name: input.name },
			});

			// Rooms opened before the waiting room was removed can still be sitting
			// in "lobby". Whoever arrives next moves them along, so nobody lands on a
			// screen whose only button is gone.
			const wasLobby = phaseOf(room) === "lobby";
			const phase = wasLobby ? "swiping" : phaseOf(room);

			await ctx.db.room.update({
				where: { code: room.code },
				data: {
					phase,
					// A round that starts here starts its clock here. Joining a round
					// already under way must not extend it — that is the one thing a
					// latecomer should not be able to do to everyone else.
					...(wasLobby || (phase === "swiping" && room.votingEndsAt === null)
						? { votingEndsAt: roundDeadline() }
						: {}),
					lastActivity: new Date(),
				},
			});

			return { code: room.code, phase };
		}),

	/**
	 * The single read the whole UI hangs off. Clients refetch this when Realtime
	 * reports a room or member row changed, rather than polling.
	 */
	state: publicProcedure
		.input(z.object({ code: codeInput }))
		.query(async ({ ctx, input }) => {
			const room = await requireRoom(ctx.db, input.code);
			return buildRoomView(ctx.db, room);
		}),

	/**
	 * Moves a room out of "lobby". Nothing creates a lobby room any more — rooms
	 * open straight into swiping — so this exists for rooms created before that
	 * change, and `reset` still routes through the phase it sets.
	 */
	start: publicProcedure.input(identity).mutation(async ({ ctx, input }) => {
		await requireMembership(ctx.db, input.code, input.userId);
		const room = await requireRoom(ctx.db, input.code);

		if (phaseOf(room) !== "lobby") return buildRoomView(ctx.db, room);

		const started = await ctx.db.room.update({
			where: { code: room.code },
			data: {
				phase: "swiping",
				votingEndsAt: roundDeadline(),
				lastActivity: new Date(),
			},
		});
		return buildRoomView(ctx.db, started);
	}),

	/**
	 * Records a batch of verdicts — normally a whole deck in one request.
	 *
	 * The client holds swipes in memory and submits them together, so a round of
	 * 20 cards costs one request rather than 20. The price is that nobody else
	 * sees your progress until it lands, which is why the client also flushes what
	 * it has when the tab is hidden and shortly before the deadline: votes living
	 * only in a phone's memory are one lock-screen away from never existing.
	 *
	 * Idempotent per (room, user, card), so re-submitting a batch — or one that
	 * overlaps an earlier flush — updates verdicts instead of inflating a tally.
	 *
	 * Note this deliberately does not touch `Room.lastActivity`: the member row
	 * change already broadcasts, and a second broadcast would double every
	 * client's refetches.
	 */
	swipe: publicProcedure
		.input(
			identity.extend({
				verdicts: z
					.array(
						z.object({
							restaurantId: z.string().min(1),
							like: z.boolean(),
						}),
					)
					.min(1)
					// A deck cannot exceed DECK_SIZE, so anything approaching this is a
					// client bug or somebody poking at the endpoint by hand.
					.max(200),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireMembership(ctx.db, input.code, input.userId);
			const room = await requireRoom(ctx.db, input.code);

			if (phaseOf(room) !== "swiping") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					// Worth being specific. With batching this is what somebody sees when
					// their whole deck arrives after the votes were counted.
					message: "The votes for this round have already been counted.",
				});
			}

			const inDeck = new Set(room.deckIds);
			// Last verdict per card wins, so a card somebody went back and changed
			// their mind about does not arrive as two rows.
			const verdicts = new Map<string, boolean>();
			for (const v of input.verdicts) {
				if (inDeck.has(v.restaurantId)) verdicts.set(v.restaurantId, v.like);
			}

			if (verdicts.size === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "None of those cards are in this room's deck.",
				});
			}

			await ctx.db.$transaction(async (tx) => {
				// Serialises this member's submissions against each other.
				//
				// Without the lock, two overlapping writes race: under READ COMMITTED
				// each transaction inserts its own rows but counts without seeing the
				// other's uncommitted ones, so both compute the same total and the
				// second write lands one short. That is how a member ended up parked at
				// 19/20 with all 20 swipe rows present — visible to everyone, and
				// unfixable from the UI because there was no card left to swipe. Taking
				// the row lock first means the second transaction counts after the first
				// has committed.
				await tx.$queryRaw`SELECT 1 FROM member WHERE room_code = ${room.code} AND user_id = ${input.userId} FOR UPDATE`;

				for (const [restaurantId, like] of verdicts) {
					await tx.swipe.upsert({
						where: {
							roomCode_userId_restaurantId: {
								roomCode: room.code,
								userId: input.userId,
								restaurantId,
							},
						},
						create: {
							roomCode: room.code,
							userId: input.userId,
							restaurantId,
							like,
						},
						update: { like },
					});
				}

				// Recounted rather than incremented, so overlapping or retried batches
				// converge on the true number.
				const swipedCount = await tx.swipe.count({
					where: { roomCode: room.code, userId: input.userId },
				});

				await tx.member.update({
					where: {
						roomCode_userId: { roomCode: room.code, userId: input.userId },
					},
					data: { swipedCount },
				});
			});

			// Finishing the deck ends nothing. The round runs to its deadline or until
			// the host counts the votes, so this is just a submission.
			return { recorded: verdicts.size };
		}),

	/**
	 * Counts the votes now rather than at the deadline. Host only — see
	 * requireHost. This and the clock running out are the only two ways a round
	 * ends; nothing about everybody having finished their deck ends it.
	 */
	reveal: publicProcedure.input(identity).mutation(async ({ ctx, input }) => {
		await requireMembership(ctx.db, input.code, input.userId);
		const room = await requireRoom(ctx.db, input.code);
		requireHost(room, input.userId);

		const revealed = await ctx.db.room.update({
			where: { code: room.code },
			data: { phase: "results", lastActivity: new Date() },
		});
		return buildRoomView(ctx.db, revealed);
	}),

	/** Same members, fresh deck order, votes wiped, swiping again immediately. */
	reset: publicProcedure.input(identity).mutation(async ({ ctx, input }) => {
		await requireMembership(ctx.db, input.code, input.userId);
		const room = await requireRoom(ctx.db, input.code);

		const places = await ctx.db.restaurant.findMany({
			where: { active: true },
			select: { id: true },
		});

		const deckIds = shuffle(
			places.map((p) => p.id),
			`${room.code}:${Date.now()}`,
		).slice(0, env.DECK_SIZE);

		const [, , updated] = await ctx.db.$transaction([
			ctx.db.swipe.deleteMany({ where: { roomCode: room.code } }),
			ctx.db.member.updateMany({
				where: { roomCode: room.code },
				data: { swipedCount: 0 },
			}),
			ctx.db.room.update({
				where: { code: room.code },
				// Straight back to swiping, not to a lobby: there is no waiting-room
				// screen left to press a button on, so a reset that parked the room in
				// "lobby" would leave everyone looking at a deck nobody can advance.
				// A fresh round gets a fresh deadline.
				data: {
					phase: "swiping",
					votingEndsAt: roundDeadline(),
					deckIds,
					lastActivity: new Date(),
				},
			}),
		]);

		return buildRoomView(ctx.db, updated);
	}),
});
