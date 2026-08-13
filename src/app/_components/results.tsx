"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { api, type RouterOutputs } from "~/trpc/react";

type RoomState = RouterOutputs["room"]["state"];

export function Results({ room, userId }: { room: RoomState; userId: string }) {
	const reset = api.room.reset.useMutation();

	const ranked = room.results?.ranked ?? [];
	const memberCount = room.results?.memberCount ?? 0;
	// Nobody swiped anything they liked — worth saying out loud rather than
	// showing a list of zeroes and calling it a winner.
	const anyLikes = ranked.some((r) => r.likes > 0);
	const [winner, ...rest] = ranked;

	return (
		<main className="flex min-h-dvh flex-col px-5 py-8">
			<div className="mx-auto w-full max-w-sm">
				<header className="mb-6 text-center">
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
						{memberCount === 1 ? "1 voter" : `${memberCount} voters`}
					</p>
					<h1 className="mt-1 font-black text-3xl">
						{anyLikes ? "Lunch is served" : "Nobody liked anything"}
					</h1>
				</header>

				{!anyLikes ? (
					<Card className="p-6 text-center text-muted-foreground">
						Tough crowd. Re-shuffle the deck and go again, or widen the list in
						<code className="mx-1 rounded bg-muted px-1.5 py-0.5">
							prisma/seed.ts
						</code>
						.
					</Card>
				) : (
					winner && (
						// The winner is the payoff for the whole round, so it gets an
						// entrance the runners-up do not.
						<motion.div
							animate={{ opacity: 1, scale: 1 }}
							initial={{ opacity: 0, scale: 0.94 }}
							transition={{ type: "spring", stiffness: 260, damping: 24 }}
						>
							<Card className="relative rounded-[28px] p-6 ring-[--color-blush]/40">
								<div className="absolute -top-6 -right-4 text-8xl opacity-20">
									{winner.place.emoji}
								</div>
								<div className="relative">
									{winner.unanimous && (
										<Badge className="bg-[--color-teal]/15 font-bold text-[--color-teal-deep] text-[11px] uppercase tracking-wider">
											Unanimous
										</Badge>
									)}
									<h2 className="mt-3 font-black text-3xl leading-tight">
										{winner.place.name}
									</h2>
									<p className="mt-1 text-muted-foreground text-sm">
										{winner.place.cuisine} · {winner.place.walkMinutes} min walk
										· {"$".repeat(winner.place.priceLevel)}
									</p>
									<p className="mt-3 text-muted-foreground text-sm">
										{winner.likes} of {memberCount} swiped right
										{winner.likedBy.length > 0 &&
											` — ${winner.likedBy.join(", ")}`}
									</p>
									{winner.place.googleUrl && (
										<Button
											className="mt-5 h-12 w-full rounded-2xl bg-[--color-teal] font-bold text-[--color-ink] text-base hover:bg-[--color-teal]/80 active:scale-[0.98]"
											// Base UI clones this element and supplies the label as
											// children, so the anchor is written empty here.
											render={
												<a
													href={winner.place.googleUrl}
													rel="noreferrer noopener"
													target="_blank"
												/>
											}
										>
											Open in Google Maps
										</Button>
									)}
								</div>
							</Card>
						</motion.div>
					)
				)}

				{rest.some((r) => r.likes > 0) && (
					<>
						<p className="mt-8 mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
							Runners-up
						</p>
						<ul className="space-y-2">
							{rest
								.filter((r) => r.likes > 0)
								.map((r) => (
									<li key={r.place.id}>
										<Card
											className="flex-row items-center gap-3 rounded-2xl bg-card px-4"
											size="sm"
										>
											<span className="text-2xl">{r.place.emoji}</span>
											<div className="min-w-0 flex-1">
												<p className="truncate font-semibold">{r.place.name}</p>
												<p className="truncate text-muted-foreground text-xs">
													{r.likedBy.join(", ")}
												</p>
											</div>
											<span className="shrink-0 text-muted-foreground text-sm">
												{r.likes}/{memberCount}
											</span>
										</Card>
									</li>
								))}
						</ul>
					</>
				)}

				<div className="mt-10 space-y-3">
					<Button
						className="h-14 w-full rounded-2xl text-base active:scale-[0.98]"
						disabled={reset.isPending}
						onClick={() => reset.mutate({ code: room.code, userId })}
					>
						{reset.isPending ? "Re-shuffling…" : "Go again, same crew"}
					</Button>
					<Button
						className="h-12 w-full rounded-2xl font-bold"
						render={<Link href="/" />}
						variant="outline"
					>
						Leave room
					</Button>
				</div>
			</div>
		</main>
	);
}
