"use client";

import {
	AnimatePresence,
	motion,
	type PanInfo,
	useMotionValue,
	useTransform,
} from "motion/react";
import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";

type RoomState = RouterOutputs["room"]["state"];
type Place = RoomState["deck"][number];

/** Past this, letting go decides the card; below it, the card springs back. */
const COMMIT_PX = 110;
const COMMIT_VELOCITY = 550;

/**
 * A dynamic `exit` has to live in `variants` — that is the only form motion
 * feeds `custom` into. Rotation is left out on purpose: it is derived from `x`,
 * so it follows the card off screen by itself.
 */
const CARD_VARIANTS = {
	enter: { scale: 0.96, opacity: 0 },
	center: { scale: 1, opacity: 1 },
	exit: (dir: number) => ({
		x: dir * 600,
		opacity: 0,
		transition: { duration: 0.28 },
	}),
};

export function SwipeDeck({
	room,
	userId,
	onlineIds,
}: {
	room: RoomState;
	userId: string;
	onlineIds: Set<string>;
}) {
	const swipe = api.room.swipe.useMutation();
	const reveal = api.room.reveal.useMutation();

	const me = room.members.find((m) => m.userId === userId);
	const serverCount = me?.swipedCount ?? 0;

	// The card leaves under the thumb immediately; the mutation catches up. The
	// server count is the floor, so a swipe that failed to send is re-offered
	// rather than silently skipped.
	const [localCount, setLocalCount] = useState(serverCount);
	const index = Math.max(localCount, serverCount);
	const [exitDir, setExitDir] = useState(0);

	const stack = room.deck.slice(index, index + 3);
	const top = stack[0];
	const others = room.members.filter((m) => m.userId !== userId);

	function decide(place: Place, like: boolean) {
		setExitDir(like ? 1 : -1);
		setLocalCount(index + 1);
		swipe.mutate({ code: room.code, userId, restaurantId: place.id, like });
	}

	return (
		<main className="flex min-h-dvh flex-col px-5 py-6">
			<div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
				<header className="mb-4">
					<div className="mb-3 flex items-baseline justify-between">
						<span className="font-mono text-white/40 text-xs tracking-widest">
							{room.code}
						</span>
						<span className="text-white/40 text-xs">
							{Math.min(index, room.deckSize)} / {room.deckSize}
						</span>
					</div>
					<div className="h-1 overflow-hidden rounded-full bg-white/10">
						<motion.div
							animate={{
								width: `${(Math.min(index, room.deckSize) / Math.max(room.deckSize, 1)) * 100}%`,
							}}
							className="h-full bg-[--color-ember]"
							transition={{ type: "spring", stiffness: 200, damping: 30 }}
						/>
					</div>
					{others.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/35">
							{others.map((m) => (
								<span key={m.userId}>
									<span
										className={
											onlineIds.has(m.userId) ? "text-white/60" : undefined
										}
									>
										{m.name}
									</span>{" "}
									{m.done ? "✓" : `${m.swipedCount}/${room.deckSize}`}
								</span>
							))}
						</div>
					)}
				</header>

				<div className="relative flex-1">
					{stack.slice(1).map((place, i) => (
						<div
							className="absolute inset-0 origin-bottom"
							key={place.id}
							style={{
								zIndex: 5 - i,
								transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * -12}px)`,
								opacity: 0.5 - i * 0.2,
							}}
						>
							<CardFace place={place} />
						</div>
					))}

					<AnimatePresence custom={exitDir} initial={false}>
						{top ? (
							<TopCard
								exitDir={exitDir}
								key={top.id}
								onDecide={(like) => decide(top, like)}
								place={top}
							/>
						) : null}
					</AnimatePresence>

					{!top && (
						<WaitingForOthers
							onReveal={() => reveal.mutate({ code: room.code, userId })}
							pending={reveal.isPending}
							room={room}
						/>
					)}
				</div>

				{top && (
					<div className="mt-6 flex items-center justify-center gap-6">
						<button
							aria-label="Pass"
							className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/15 text-2xl transition active:scale-90"
							onClick={() => decide(top, false)}
							type="button"
						>
							✕
						</button>
						<button
							aria-label="Like"
							className="flex h-20 w-20 items-center justify-center rounded-full bg-[--color-flame] text-3xl text-[--color-ink] transition active:scale-90"
							onClick={() => decide(top, true)}
							type="button"
						>
							♥
						</button>
					</div>
				)}
			</div>
		</main>
	);
}

function TopCard({
	place,
	exitDir,
	onDecide,
}: {
	place: Place;
	exitDir: number;
	onDecide: (like: boolean) => void;
}) {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-240, 240], [-16, 16]);
	const likeOpacity = useTransform(x, [40, 130], [0, 1]);
	const passOpacity = useTransform(x, [-130, -40], [1, 0]);

	function handleDragEnd(_: unknown, info: PanInfo) {
		const committed =
			Math.abs(info.offset.x) > COMMIT_PX ||
			Math.abs(info.velocity.x) > COMMIT_VELOCITY;
		if (!committed) return;
		onDecide(info.offset.x > 0 || info.velocity.x > 0);
	}

	return (
		<motion.div
			animate="center"
			className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
			custom={exitDir}
			drag="x"
			dragElastic={0.6}
			dragSnapToOrigin
			exit="exit"
			initial="enter"
			onDragEnd={handleDragEnd}
			style={{ x, rotate }}
			variants={CARD_VARIANTS}
		>
			<CardFace place={place}>
				<motion.span
					className="absolute top-6 left-6 rotate-[-12deg] rounded-xl border-4 border-[--color-mint] px-3 py-1 font-black text-2xl text-[--color-mint]"
					style={{ opacity: likeOpacity }}
				>
					YES
				</motion.span>
				<motion.span
					className="absolute top-6 right-6 rotate-[12deg] rounded-xl border-4 border-white/60 px-3 py-1 font-black text-2xl text-white/60"
					style={{ opacity: passOpacity }}
				>
					NAH
				</motion.span>
			</CardFace>
		</motion.div>
	);
}

function CardFace({
	place,
	children,
}: {
	place: Place;
	children?: React.ReactNode;
}) {
	// Own image first, then Google's, then the emoji. `broken` collapses the
	// last two into one path: /api/place-photo 404s whenever there is no API key
	// or the shop simply has no photo, and a card should degrade to its emoji
	// rather than a broken-image icon.
	const [broken, setBroken] = useState(false);
	const googlePhoto = !place.imageUrl && place.placeId !== null && !broken;
	const src = place.imageUrl ?? `/api/place-photo/${place.id}`;

	return (
		<div className="relative flex h-full w-full select-none flex-col justify-end overflow-hidden rounded-[28px] border border-white/10 bg-[--color-ink-soft] p-6">
			{place.imageUrl || googlePhoto ? (
				// Arbitrary remote hosts, so plain <img> rather than next/image and its
				// domain allowlist. Cards are one-screen-sized and short-lived.
				// biome-ignore lint/performance/noImgElement: hosts are arbitrary
				<img
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-60"
					onError={() => setBroken(true)}
					src={src}
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center text-[9rem] opacity-25">
					{place.emoji}
				</div>
			)}
			<div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />

			{/* Attribution is a condition of using Places photos, so it is tied to
			    the same flag that renders one. */}
			{googlePhoto && (
				<span className="absolute top-4 right-4 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white/70">
					Powered by Google
				</span>
			)}

			<div className="relative">
				<p className="font-semibold text-[--color-ember] text-xs uppercase tracking-widest">
					{place.cuisine}
				</p>
				<h2 className="mt-1 font-black text-3xl leading-tight">{place.name}</h2>
				<p className="mt-2 text-sm text-white/60">
					{"$".repeat(place.priceLevel)} · {place.walkMinutes} min walk
				</p>
				{/* Only `true` shows a badge. `null` means nobody has verified this
				    shop, and a "not halal" badge on an unchecked spot would be a
				    claim the data does not support. */}
				{place.halal === true && (
					<p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-[11px] text-emerald-300">
						☪ Halal
					</p>
				)}
				{place.tags.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{place.tags.map((tag) => (
							<span
								className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70"
								key={tag}
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			{children}
		</div>
	);
}

function WaitingForOthers({
	room,
	pending,
	onReveal,
}: {
	room: RoomState;
	pending: boolean;
	onReveal: () => void;
}) {
	const waiting = room.members.filter((m) => !m.done);

	return (
		<div className="flex h-full flex-col items-center justify-center text-center">
			<div className="text-5xl">⏳</div>
			<p className="mt-4 font-bold text-lg">That's your lot</p>
			<p className="mt-1 text-sm text-white/50">
				{waiting.length === 0
					? "Counting the votes…"
					: `Waiting on ${waiting.map((m) => m.name).join(", ")}`}
			</p>
			{waiting.length > 0 && (
				<button
					className="mt-8 rounded-2xl border border-white/15 px-5 py-3 font-bold text-sm transition active:scale-95 disabled:opacity-40"
					disabled={pending}
					onClick={onReveal}
					type="button"
				>
					{pending ? "Revealing…" : "Reveal without them"}
				</button>
			)}
		</div>
	);
}
