"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
						Room code
					</p>
					<p className="mt-1 font-black font-mono text-6xl tracking-[0.25em]">
						{room.code}
					</p>
					<Button
						className="mt-4 h-10 rounded-full px-5 active:scale-95"
						onClick={() => void share()}
						variant="outline"
					>
						{copied ? "Link copied" : "Share link"}
					</Button>
				</div>

				<div className="mt-10 flex-1">
					<p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
						In the room · {room.members.length}
					</p>
					<ul className="space-y-2">
						{/* Members arrive over Realtime, so rows appear mid-view. `layout`
						    lets the ones already on screen slide down rather than jump. */}
						<AnimatePresence initial={false}>
							{room.members.map((m) => (
								<motion.li
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, x: -12 }}
									initial={{ opacity: 0, y: -8 }}
									key={m.userId}
									layout
									transition={{ type: "spring", stiffness: 400, damping: 32 }}
								>
									<Card
										className="flex-row items-center gap-3 rounded-2xl bg-card px-4"
										size="sm"
									>
										<span
											className={`h-2 w-2 shrink-0 rounded-full ${
												onlineIds.has(m.userId)
													? "bg-[--color-teal]"
													: "bg-muted-foreground/40"
											}`}
										/>
										<span className="font-semibold">{m.name}</span>
										{m.userId === userId && (
											<span className="text-muted-foreground text-xs">you</span>
										)}
										{m.userId === room.hostId && (
											<Badge
												className="ml-auto font-bold text-[10px] uppercase tracking-wider"
												variant="secondary"
											>
												host
											</Badge>
										)}
									</Card>
								</motion.li>
							))}
						</AnimatePresence>
					</ul>
				</div>

				<div className="pt-8">
					<Button
						className="h-14 w-full rounded-2xl text-lg active:scale-[0.98]"
						disabled={start.isPending}
						onClick={() => start.mutate({ code: room.code, userId })}
					>
						{start.isPending
							? "Shuffling…"
							: `Start swiping · ${room.deckSize} spots`}
					</Button>
					<p className="mt-3 text-center text-muted-foreground text-xs">
						Anyone can start. Latecomers can still join mid-round.
					</p>
					{start.error && (
						<p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-destructive text-sm">
							{start.error.message}
						</p>
					)}
				</div>
			</div>
		</main>
	);
}
