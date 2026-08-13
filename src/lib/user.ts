"use client";

/**
 * Anonymous identity. There is no sign-in: a lunch vote does not deserve a
 * password. The id is generated once per browser and kept in localStorage so a
 * phone that locks and reopens rejoins as the same member rather than turning
 * into a second ghost in the member list.
 */

const ID_KEY = "lunch-tinder:user-id";
const NAME_KEY = "lunch-tinder:name";

export function getUserId(): string {
	const existing = window.localStorage.getItem(ID_KEY);
	if (existing) return existing;

	const fresh = crypto.randomUUID();
	window.localStorage.setItem(ID_KEY, fresh);
	return fresh;
}

export function getStoredName(): string {
	return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function storeName(name: string): void {
	window.localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
}
