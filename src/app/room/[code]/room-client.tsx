"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Results } from "~/app/_components/results";
import { SwipeDeck } from "~/app/_components/swipe-deck";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
				<p className="text-center text-muted-foreground">
					{state.error.message}
				</p>
				<Button
					className="mt-6 h-12 w-full rounded-2xl font-bold"
					render={<Link href="/" />}
					variant="outline"
				>
					Back
				</Button>
			</Shell>
		);
	}

	if (!room || !userId) {
		return (
			<Shell>
				<p className="animate-pulse text-center text-muted-foreground">
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
				<p className="mt-2 mb-8 text-center text-muted-foreground text-sm">
					{room.members.length === 1
						? "1 person is already in."
						: `${room.members.length} people are already in.`}
				</p>
				<Input
					className="h-14 rounded-2xl bg-card px-4 text-lg"
					maxLength={24}
					onChange={(e) => setName(e.target.value)}
					placeholder="Your name"
					value={name}
				/>
				<Button
					className="mt-4 h-14 w-full rounded-2xl text-lg active:scale-[0.98]"
					disabled={trimmed.length === 0 || join.isPending}
					onClick={() => {
						storeName(trimmed);
						join.mutate({ code, userId, name: trimmed });
					}}
				>
					{join.isPending ? "Joining…" : "I'm in"}
				</Button>
				{join.error && (
					<p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-destructive text-sm">
						{join.error.message}
					</p>
				)}
			</Shell>
		);
	}

	if (room.phase === "results") {
		return <Results room={room} userId={userId} />;
	}

	// "lobby" only survives on rooms created before the waiting room was removed;
	// `join` promotes them, and the deck is what both phases show now.
	return <SwipeDeck onlineIds={onlineIds} room={room} userId={userId} />;
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-dvh flex-col justify-center px-6 py-12">
			<div className="mx-auto w-full max-w-sm">{children}</div>
		</main>
	);
}
