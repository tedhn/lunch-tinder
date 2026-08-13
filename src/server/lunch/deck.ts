import { CODE_LENGTH } from "./types";

/** No 0/O/1/I/L — these get misread when a code is shouted across a desk. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomRoomCode(): string {
	let code = "";
	for (let i = 0; i < CODE_LENGTH; i++) {
		code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
	}
	return code;
}

export function normalizeCode(input: string): string {
	return input.trim().toUpperCase();
}

/** Deterministic PRNG so a given seed always produces the same deck order. */
function mulberry32(seed: number) {
	return function next() {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function seedFrom(str: string): number {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/**
 * Shuffled once per room and then frozen into `Room.deckIds`, never per client.
 * Every member must see the same order or the "3 of 5 finished" progress counts
 * mean nothing.
 */
export function shuffle<T>(items: T[], seed: string): T[] {
	const out = items.slice();
	const rand = mulberry32(seedFrom(seed));
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j] as T, out[i] as T];
	}
	return out;
}
