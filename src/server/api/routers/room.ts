import { TRPCError } from "@trpc/server";
import type { PrismaClient, Restaurant, Room } from "generated/prisma";
import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { normalizeCode, randomRoomCode, shuffle } from "~/server/lunch/deck";
import { allDone, tallyRoom, toMemberViews } from "~/server/lunch/tally";
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
 * Any member may start, reveal or reset. `hostId` is only a lobby badge for
 * whoever opened the room: with three people and one lunch hour, a host whose
 * phone died stranding everyone else is a worse failure than someone else
 * pressing start.
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

async function buildRoomView(db: PrismaClient, room: Room): Promise<RoomView> {
	const phase = phaseOf(room);
	const members = await db.member.findMany({
		where: { roomCode: room.code },
		orderBy: { joinedAt: "asc" },
	});

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
		results,
	};
}

export const roomRouter = createTRPCRouter({
	/** Opens a room with a frozen, shuffled deck and the caller as first member. */
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
							phase: "lobby",
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
	 * member instead of appearing twice. Late joiners are allowed mid-round —
	 * they simply have more cards left than everybody else.
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

			await ctx.db.room.update({
				where: { code: room.code },
				data: { lastActivity: new Date() },
			});

			return { code: room.code, phase: phaseOf(room) };
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

	start: publicProcedure.input(identity).mutation(async ({ ctx, input }) => {
		await requireMembership(ctx.db, input.code, input.userId);
		const room = await requireRoom(ctx.db, input.code);

		if (phaseOf(room) !== "lobby") return buildRoomView(ctx.db, room);

		const started = await ctx.db.room.update({
			where: { code: room.code },
			data: { phase: "swiping", lastActivity: new Date() },
		});
		return buildRoomView(ctx.db, started);
	}),

	/**
	 * Records one verdict. Swipes are idempotent per (room, user, card), so a
	 * double-tap or a retried request cannot inflate a tally.
	 *
	 * Note this deliberately does not touch `Room.lastActivity`: every swipe
	 * already broadcasts a member row change, and a second broadcast per swipe
	 * would double the refetches every client does.
	 */
	swipe: publicProcedure
		.input(
			identity.extend({
				restaurantId: z.string().min(1),
				like: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireMembership(ctx.db, input.code, input.userId);
			const room = await requireRoom(ctx.db, input.code);

			if (phaseOf(room) !== "swiping") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "This round is not accepting swipes.",
				});
			}
			if (!room.deckIds.includes(input.restaurantId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "That card is not in this room's deck.",
				});
			}

			await ctx.db.$transaction(async (tx) => {
				await tx.swipe.upsert({
					where: {
						roomCode_userId_restaurantId: {
							roomCode: room.code,
							userId: input.userId,
							restaurantId: input.restaurantId,
						},
					},
					create: {
						roomCode: room.code,
						userId: input.userId,
						restaurantId: input.restaurantId,
						like: input.like,
					},
					// A re-swipe of the same card updates the verdict rather than adding
					// a second vote.
					update: { like: input.like },
				});

				// Recounted rather than incremented, so duplicate or retried requests
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

			// Auto-reveal once everyone is through the deck, so the round does not
			// wait on somebody remembering to press a button.
			const members = await ctx.db.member.findMany({
				where: { roomCode: room.code },
			});

			if (allDone(members, room.deckIds.length)) {
				await ctx.db.room.update({
					where: { code: room.code },
					data: { phase: "results", lastActivity: new Date() },
				});
				return { phase: "results" as const };
			}

			return { phase: "swiping" as const };
		}),

	/** Ends the round early — for when half the office has already wandered off. */
	reveal: publicProcedure.input(identity).mutation(async ({ ctx, input }) => {
		await requireMembership(ctx.db, input.code, input.userId);
		const room = await requireRoom(ctx.db, input.code);

		const revealed = await ctx.db.room.update({
			where: { code: room.code },
			data: { phase: "results", lastActivity: new Date() },
		});
		return buildRoomView(ctx.db, revealed);
	}),

	/** Same members, fresh deck order, votes wiped. Back to the lobby. */
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
				data: { phase: "lobby", deckIds, lastActivity: new Date() },
			}),
		]);

		return buildRoomView(ctx.db, updated);
	}),
});
