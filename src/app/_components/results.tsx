"use client";

import Link from "next/link";

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
					<p className="font-semibold text-white/40 text-xs uppercase tracking-widest">
						{memberCount === 1 ? "1 voter" : `${memberCount} voters`}
					</p>
					<h1 className="mt-1 font-black text-3xl">
						{anyLikes ? "Lunch is served" : "Nobody liked anything"}
					</h1>
				</header>

				{!anyLikes ? (
					<p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
						Tough crowd. Re-shuffle the deck and go again, or widen the list in
						<code className="mx-1 rounded bg-white/10 px-1.5 py-0.5">
							prisma/seed.ts
						</code>
						.
					</p>
				) : (
					winner && (
						<div className="relative overflow-hidden rounded-[28px] border border-[--color-ember]/40 bg-[--color-ink-soft] p-6">
							<div className="absolute -top-6 -right-4 text-8xl opacity-20">
								{winner.place.emoji}
							</div>
							<div className="relative">
								{winner.unanimous && (
									<span className="inline-block rounded-full bg-[--color-mint]/20 px-3 py-1 font-bold text-[--color-mint] text-[11px] uppercase tracking-wider">
										Unanimous
									</span>
								)}
								<h2 className="mt-3 font-black text-3xl leading-tight">
									{winner.place.name}
								</h2>
								<p className="mt-1 text-sm text-white/60">
									{winner.place.cuisine} · {winner.place.walkMinutes} min walk ·{" "}
									{"$".repeat(winner.place.priceLevel)}
								</p>
								<p className="mt-3 text-sm text-white/50">
									{winner.likes} of {memberCount} swiped right
									{winner.likedBy.length > 0 &&
										` — ${winner.likedBy.join(", ")}`}
								</p>
								{winner.place.googleUrl && (
									<a
										className="mt-5 block rounded-2xl bg-[--color-mint] px-4 py-3.5 text-center font-bold text-[--color-ink] transition active:scale-[0.98]"
										href={winner.place.googleUrl}
										rel="noreferrer noopener"
										target="_blank"
									>
										Open in Google Maps
									</a>
								)}
							</div>
						</div>
					)
				)}

				{rest.some((r) => r.likes > 0) && (
					<>
						<p className="mt-8 mb-3 font-semibold text-white/40 text-xs uppercase tracking-widest">
							Runners-up
						</p>
						<ul className="space-y-2">
							{rest
								.filter((r) => r.likes > 0)
								.map((r) => (
									<li
										className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
										key={r.place.id}
									>
										<span className="text-2xl">{r.place.emoji}</span>
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold">{r.place.name}</p>
											<p className="truncate text-white/40 text-xs">
												{r.likedBy.join(", ")}
											</p>
										</div>
										<span className="shrink-0 text-sm text-white/50">
											{r.likes}/{memberCount}
										</span>
									</li>
								))}
						</ul>
					</>
				)}

				<div className="mt-10 space-y-3">
					<button
						className="w-full rounded-2xl bg-[--color-flame] px-4 py-4 font-bold text-[--color-ink] transition active:scale-[0.98] disabled:opacity-40"
						disabled={reset.isPending}
						onClick={() => reset.mutate({ code: room.code, userId })}
						type="button"
					>
						{reset.isPending ? "Re-shuffling…" : "Go again, same crew"}
					</button>
					<Link
						className="block rounded-2xl border border-white/15 px-4 py-3.5 text-center font-bold"
						href="/"
					>
						Leave room
					</Link>
				</div>
			</div>
		</main>
	);
}
