"use client";

import { useEffect, useRef, useState } from "react";

import { supabase } from "~/lib/supabase";
import { api } from "~/trpc/react";

/**
 * Keeps one room in sync across every phone in it.
 *
 * Two jobs, both over a single Realtime channel:
 *
 *   1. Postgres changes on `room` and `member` invalidate the `room.state`
 *      query, so the server stays the only thing that decides what a client is
 *      allowed to see. The rows themselves are ignored — they are a signal to
 *      refetch, not data.
 *   2. Channel presence answers "who is actually looking at this right now",
 *      which is deliberately *not* a database column: a heartbeat write would
 *      broadcast a row change, which would trigger a refetch, which would
 *      heartbeat again.
 *
 * Returns the set of userIds currently connected.
 */
export function useRoomChannel(code: string, userId: string | null) {
	const utils = api.useUtils();
	const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

	// Held in a ref so the debounce survives re-renders without re-subscribing.
	const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!code || !userId) return;

		const invalidateSoon = () => {
			// A round that everyone finishes at once produces a burst of member
			// updates; one refetch covers all of them.
			if (refetchTimer.current) clearTimeout(refetchTimer.current);
			refetchTimer.current = setTimeout(() => {
				void utils.room.state.invalidate({ code });
			}, 80);
		};

		const channel = supabase
			.channel(`room:${code}`, { config: { presence: { key: userId } } })
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "room",
					filter: `code=eq.${code}`,
				},
				invalidateSoon,
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "member",
					filter: `room_code=eq.${code}`,
				},
				invalidateSoon,
			)
			.on("presence", { event: "sync" }, () => {
				setOnlineIds(new Set(Object.keys(channel.presenceState())));
			})
			.subscribe((status) => {
				if (status === "SUBSCRIBED") {
					void channel.track({ userId });
					// The socket may have missed changes while it was connecting.
					void utils.room.state.invalidate({ code });
				}
			});

		return () => {
			if (refetchTimer.current) clearTimeout(refetchTimer.current);
			void supabase.removeChannel(channel);
		};
	}, [code, userId, utils]);

	return onlineIds;
}
