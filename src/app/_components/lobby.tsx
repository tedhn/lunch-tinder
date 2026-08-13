"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";

type RoomState = RouterOutputs["room"]["state"];

export function Lobby({
	room,
	userId,
	onlineIds,
}: {
	room: RoomState;
	userId: string;
	onlineIds: Set<string>;
}) {
	const [copied, setCopied] = useState(false);
	const start = api.room.start.useMutation();

	async function share() {
		const url = window.location.href;
		// navigator.share is the good path on a phone, which is where this app
		// lives; clipboard is the desktop fallback.
		if (navigator.share) {
			await navigator
				.share({ title: "Lunch Tinder", text: `Room ${room.code}`, url })
				.catch(() => undefined);
			return;
		}
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 1600);
	}

	return (
		<main className="flex min-h-dvh flex-col px-6 py-10">
			<div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
				<div className="text-center">
					<p className="font-semibold text-white/40 text-xs uppercase tracking-widest">
						Room code
					</p>
					<p className="mt-1 font-black font-mono text-6xl tracking-[0.25em]">
						{room.code}
					</p>
					<button
						className="mt-4 rounded-full border border-white/15 px-5 py-2 font-semibold text-sm transition active:scale-95"
						onClick={() => void share()}
						type="button"
					>
						{copied ? "Link copied" : "Share link"}
					</button>
				</div>

				<div className="mt-10 flex-1">
					<p className="mb-3 font-semibold text-white/40 text-xs uppercase tracking-widest">
						In the room · {room.members.length}
					</p>
					<ul className="space-y-2">
						{room.members.map((m) => (
							<li
								className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
								key={m.userId}
							>
								<span
									className={`h-2 w-2 shrink-0 rounded-full ${
										onlineIds.has(m.userId)
											? "bg-[--color-mint]"
											: "bg-white/25"
									}`}
								/>
								<span className="font-semibold">{m.name}</span>
								{m.userId === userId && (
									<span className="text-white/40 text-xs">you</span>
								)}
								{m.userId === room.hostId && (
									<span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">
										host
									</span>
								)}
							</li>
						))}
					</ul>
				</div>

				<div className="pt-8">
					<button
						className="w-full rounded-2xl bg-[--color-flame] px-4 py-4 font-bold text-[--color-ink] text-lg transition active:scale-[0.98] disabled:opacity-40"
						disabled={start.isPending}
						onClick={() => start.mutate({ code: room.code, userId })}
						type="button"
					>
						{start.isPending
							? "Shuffling…"
							: `Start swiping · ${room.deckSize} spots`}
					</button>
					<p className="mt-3 text-center text-white/35 text-xs">
						Anyone can start. Latecomers can still join mid-round.
					</p>
					{start.error && (
						<p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-red-300 text-sm">
							{start.error.message}
						</p>
					)}
				</div>
			</div>
		</main>
	);
}
