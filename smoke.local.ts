import assert from "node:assert/strict";

import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";

const caller = createCaller({ db, headers: new Headers() });

const alice = crypto.randomUUID();
const bob = crypto.randomUUID();

const { code } = await caller.room.create({ userId: alice, name: "Alice" });
console.log("created room", code);

await caller.room.join({ code, userId: bob, name: "Bob" });

// A new room is swiping from the moment it exists: no waiting room, and a
// joiner starts on their own without anybody pressing start.
let state = await caller.room.state({ code });
assert.equal(state.phase, "swiping");
assert.equal(state.members.length, 2);
assert.equal(state.deck.length, state.deckSize);
assert.equal(state.results, null);
assert.equal(state.hostId, alice);
console.log("deck size", state.deckSize);

const deck = state.deck;
const shared = deck[0]!;

// Non-members are refused.
await assert.rejects(
	() =>
		caller.room.swipe({
			code,
			userId: crypto.randomUUID(),
			verdicts: [{ restaurantId: shared.id, like: true }],
		}),
	/Join the room/,
);

// Cards outside the deck are refused. A batch is filtered to the deck rather
// than rejected wholesale, so this only throws because *nothing* in it counted.
await assert.rejects(
	() =>
		caller.room.swipe({
			code,
			userId: alice,
			verdicts: [{ restaurantId: "not-a-real-place", like: true }],
		}),
	/None of those cards/,
);

// A batch mixing a real card with a bogus one keeps the real one and drops the
// other, which is what makes an unknown id a non-event rather than a lost round.
const mixed = await caller.room.swipe({
	code,
	userId: alice,
	verdicts: [
		{ restaurantId: shared.id, like: true },
		{ restaurantId: "not-a-real-place", like: true },
	],
});
assert.equal(mixed.recorded, 1, "the bogus card should have been dropped");

// Alice submits her whole deck in one request — yes on the first card only.
// This is what the client does now: verdicts are held in memory while swiping
// and sent together, so a round costs one request rather than twenty.
const submitted = await caller.room.swipe({
	code,
	userId: alice,
	verdicts: deck.map((place, i) => ({
		restaurantId: place.id,
		like: i === 0,
	})),
});
assert.equal(submitted.recorded, deck.length);

// Re-sending an overlapping batch must not inflate anything — the flush paths
// (tab hidden, deadline approaching) overlap with the final submission by
// design, so this is the normal case rather than an edge one.
await caller.room.swipe({
	code,
	userId: alice,
	verdicts: [
		{ restaurantId: shared.id, like: true },
		{ restaurantId: deck[1]!.id, like: false },
	],
});

state = await caller.room.state({ code });
const aliceView = state.members.find((m) => m.userId === alice)!;
assert.equal(
	aliceView.swipedCount,
	deck.length,
	"duplicate swipe inflated the count",
);
assert.ok(aliceView.done);
assert.equal(
	state.phase,
	"swiping",
	"one member finishing must not end the round",
);
assert.equal(state.results, null, "votes leaked before results");

// Bob finishes: yes on the first two cards.
await caller.room.swipe({
	code,
	userId: bob,
	verdicts: deck.map((place, i) => ({ restaurantId: place.id, like: i < 2 })),
});

// Everybody having swiped ends nothing: the round belongs to the clock and to
// the host. Somebody arriving late must still be able to vote in the time left.
state = await caller.room.state({ code });
assert.equal(
	state.phase,
	"swiping",
	"a finished deck must not end the round on its own",
);
assert.ok(state.members.every((m) => m.done));
assert.equal(state.results, null, "votes leaked before the round ended");

// The host counts them.
await caller.room.reveal({ code, userId: alice });
state = await caller.room.state({ code });
assert.equal(state.phase, "results");
assert.ok(state.results);

const ranked = state.results.ranked;
assert.equal(state.results.memberCount, 2);
assert.equal(
	ranked[0]!.place.id,
	shared.id,
	"unanimous pick should rank first",
);
assert.equal(ranked[0]!.likes, 2);
assert.equal(ranked[0]!.unanimous, true);
assert.deepEqual([...ranked[0]!.likedBy].sort(), ["Alice", "Bob"]);
assert.equal(ranked[1]!.likes, 1, "Bob's second pick should be the runner-up");
assert.equal(ranked[1]!.unanimous, false);
assert.equal(ranked.at(-1)!.likes, 0);

// Reset keeps the crew, drops the votes, reshuffles — and goes straight back to
// swiping rather than parking the room in a lobby nobody can leave.
const before = state.deck.map((p) => p.id);
await caller.room.reset({ code, userId: alice });
state = await caller.room.state({ code });
assert.equal(state.phase, "swiping");
assert.equal(state.members.length, 2);
assert.ok(state.members.every((m) => m.swipedCount === 0));
assert.equal(await db.swipe.count({ where: { roomCode: code } }), 0);

const after = state.deck.map((p) => p.id);
assert.notDeepEqual(after, before, "reset should reshuffle the deck");

// A fresh round carries a deadline, and it is in the future.
assert.ok(state.votingEndsAt, "a round should have a deadline");
assert.ok(
	state.votingEndsAt.getTime() > Date.now(),
	"the deadline should not already have passed",
);

// The deadline is what counts the votes when nobody finishes. Winding it into
// the past is the only way to test that without waiting ten minutes; the phase
// flips on the next read, with no scheduler involved.
await caller.room.swipe({
	code,
	userId: alice,
	verdicts: [{ restaurantId: after[0]!, like: true }],
});
await db.room.update({
	where: { code },
	data: { votingEndsAt: new Date(Date.now() - 1000) },
});
state = await caller.room.state({ code });
assert.equal(state.phase, "results", "an expired round should close on read");
assert.equal(
	state.results!.ranked[0]!.place.id,
	after[0]!,
	"the one vote cast before the deadline should still win",
);
assert.equal(state.votingEndsAt, null, "results carry no deadline");

// Ties are reported rather than silently resolved. Alice and Bob each like a
// different spot, so two places sit on one vote and the rule has to be named.
await caller.room.reset({ code, userId: alice });
state = await caller.room.state({ code });
const tieDeck = state.deck;
const [first, second] = [tieDeck[0]!, tieDeck[1]!];
await caller.room.swipe({
	code,
	userId: alice,
	verdicts: [{ restaurantId: first.id, like: true }],
});
await caller.room.swipe({
	code,
	userId: bob,
	verdicts: [{ restaurantId: second.id, like: true }],
});
await caller.room.reveal({ code, userId: alice });
state = await caller.room.state({ code });
assert.ok(state.results?.tie, "two spots on one vote each is a tie");
assert.equal(state.results.tie.count, 2);
assert.ok(
	["walk", "name"].includes(state.results.tie.brokenBy),
	`unexpected tie-break: ${state.results.tie.brokenBy}`,
);
const [tieWinner, tieRunnerUp] = state.results.ranked;
assert.equal(tieWinner!.likes, tieRunnerUp!.likes, "the top two are level");
assert.ok(
	tieWinner!.place.walkMinutes <= tieRunnerUp!.place.walkMinutes,
	"the closer of two level spots should win",
);

// Back to a clean round for the host-only checks below.
await caller.room.reset({ code, userId: alice });
state = await caller.room.state({ code });
const afterTie = state.deck.map((p) => p.id);

// Reveal early, with Bob having swiped nothing this round.
await caller.room.swipe({
	code,
	userId: alice,
	verdicts: [{ restaurantId: afterTie[0]!, like: true }],
});

// Ending the round early is the host's alone: Bob is a member in good standing
// and still cannot throw away votes the others have not cast.
await assert.rejects(
	() => caller.room.reveal({ code, userId: bob }),
	/Only whoever started the room/,
);
state = await caller.room.state({ code });
assert.equal(
	state.phase,
	"swiping",
	"a non-host reveal must not end the round",
);

await caller.room.reveal({ code, userId: alice });
state = await caller.room.state({ code });
assert.equal(state.phase, "results");
assert.equal(
	state.results!.memberCount,
	1,
	"a lurker must not block a unanimous pick",
);
assert.equal(state.results!.ranked[0]!.unanimous, true);

// Unknown room codes read as not-found rather than an empty room.
await assert.rejects(() => caller.room.state({ code: "ZZZZ" }), /No room ZZZZ/);

console.log("smoke ok");
await db.$disconnect();
