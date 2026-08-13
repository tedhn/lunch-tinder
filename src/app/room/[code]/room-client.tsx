"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Lobby } from "~/app/_components/lobby";
import { Results } from "~/app/_components/results";
import { SwipeDeck } from "~/app/_components/swipe-deck";
import { useRoomChannel } from "~/hooks/use-room-channel";
import { getStoredName, getUserId, storeName } from "~/lib/user";
import { api } from "~/trpc/react";

export function RoomClient({ code }: { code: string }) {
	const utils = api.useUtils();
	const [userId, setUserId] = useState<string | null>(null);
	const [name, setName] = useState("");
	const autoJoined = useRef(false);

	useEffect(() => {
		setUserId(getUserId());
		setName(getStoredName());
	}, []);

	const state = api.room.state.useQuery(
		{ code },
		{
			enabled: userId !== null,
			// Realtime drives updates; this is only a backstop for a dropped socket.
			refetchInterval: 30_000,
			retry: false,
		},
	);

	const onlineIds = useRoomChannel(code, userId);

	const join = api.room.join.useMutation({
		onSuccess: () => void utils.room.state.invalidate({ code }),
	});

	const room = state.data;
	const joined = room?.members.some((m) => m.userId === userId) ?? false;

	// Someone opening a shared link with a name already saved should land in the
	// room, not on a form asking the question their browser already knows.
	useEffect(() => {
		if (!room || joined || !userId || autoJoined.current) return;
		const stored = getStoredName();
		if (!stored) return;
		autoJoined.current = true;
		join.mutate({ code, userId, name: stored });
	}, [room, joined, userId, code, join]);

	if (state.isError) {
		return (
			<Shell>
				<p className="text-center text-white/70">{state.error.message}</p>
				<Link
					className="mt-6 block rounded-2xl border border-white/15 px-4 py-3 text-center font-bold"
					href="/"
				>
					Back
				</Link>
			</Shell>
		);
	}

	if (!room || !userId) {
		return (
			<Shell>
				<p className="animate-pulse text-center text-white/40">
					Opening {code}…
				</p>
			</Shell>
		);
	}

	if (!joined) {
		const trimmed = name.trim();
		return (
			<Shell>
				<h1 className="text-center font-black text-2xl">
					Join room <span className="font-mono tracking-widest">{code}</span>
				</h1>
				<p className="mt-2 mb-8 text-center text-sm text-white/50">
					{room.members.length === 1
						? "1 person is already in."
						: `${room.members.length} people are already in.`}
				</p>
				<input
					className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-lg outline-none placeholder:text-white/25 focus:border-white/30"
					maxLength={24}
					onChange={(e) => setName(e.target.value)}
					placeholder="Your name"
					value={name}
				/>
				<button
					className="mt-4 w-full rounded-2xl bg-[--color-flame] px-4 py-4 font-bold text-[--color-ink] text-lg transition active:scale-[0.98] disabled:opacity-40"
					disabled={trimmed.length === 0 || join.isPending}
					onClick={() => {
						storeName(trimmed);
						join.mutate({ code, userId, name: trimmed });
					}}
					type="button"
				>
					{join.isPending ? "Joining…" : "I'm in"}
				</button>
				{join.error && (
					<p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-red-300 text-sm">
						{join.error.message}
					</p>
				)}
			</Shell>
		);
	}

	if (room.phase === "lobby") {
		return <Lobby onlineIds={onlineIds} room={room} userId={userId} />;
	}

	if (room.phase === "swiping") {
		return <SwipeDeck onlineIds={onlineIds} room={room} userId={userId} />;
	}

	return <Results room={room} userId={userId} />;
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-dvh flex-col justify-center px-6 py-12">
			<div className="mx-auto w-full max-w-sm">{children}</div>
		</main>
	);
}
