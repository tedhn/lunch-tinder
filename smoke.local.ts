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
			restaurantId: shared.id,
			like: true,
		}),
	/Join the room/,
);

// Cards outside the deck are refused.
await assert.rejects(
	() =>
		caller.room.swipe({
			code,
			userId: alice,
			restaurantId: "not-a-real-place",
			like: true,
		}),
	/not in this room/,
);

// Alice swipes the whole deck: yes on the first card only.
for (const [i, place] of deck.entries()) {
	await caller.room.swipe({
		code,
		userId: alice,
		restaurantId: place.id,
		like: i === 0,
	});
}

// A double-tap must not inflate anything.
await caller.room.swipe({
	code,
	userId: alice,
	restaurantId: shared.id,
	like: true,
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
for (const [i, place] of deck.entries()) {
	await caller.room.swipe({
		code,
		userId: bob,
		restaurantId: place.id,
		like: i < 2,
	});
}

state = await caller.room.state({ code });
assert.equal(state.phase, "results", "round did not auto-reveal");
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

// Reveal early, with Bob having swiped nothing this round.
await caller.room.swipe({
	code,
	userId: alice,
	restaurantId: after[0]!,
	like: true,
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
