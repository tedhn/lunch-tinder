"use client";

import {
	AnimatePresence,
	motion,
	type PanInfo,
	useMotionValue,
	useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { api, type RouterOutputs } from "~/trpc/react";

type RoomState = RouterOutputs["room"]["state"];
type Place = RoomState["deck"][number];

/** Past this, letting go decides the card; below it, the card springs back. */
const COMMIT_PX = 110;
const COMMIT_VELOCITY = 550;

/** Pointer travel, in px, still counted as a tap rather than a small drag. A
 * thumb never lands perfectly still, so zero would make the card feel dead. */
const TAP_SLOP = 8;

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
	const [detailFor, setDetailFor] = useState<Place | null>(null);

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
						<span className="font-mono text-muted-foreground text-xs tracking-widest">
							{room.code}
						</span>
						<span className="text-muted-foreground text-xs">
							{Math.min(index, room.deckSize)} / {room.deckSize}
						</span>
					</div>
					<div className="h-1 overflow-hidden rounded-full bg-muted">
						<motion.div
							animate={{
								width: `${(Math.min(index, room.deckSize) / Math.max(room.deckSize, 1)) * 100}%`,
							}}
							className="h-full bg-[--color-blush]"
							transition={{ type: "spring", stiffness: 200, damping: 30 }}
						/>
					</div>
					{others.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
							{others.map((m) => (
								<span key={m.userId}>
									<span
										className={
											onlineIds.has(m.userId) ? "text-foreground" : undefined
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
								onOpen={() => setDetailFor(top)}
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
						<Button
							aria-label="Pass"
							className="size-16 rounded-full border-2 text-2xl active:scale-90"
							onClick={() => decide(top, false)}
							variant="outline"
						>
							✕
						</Button>
						<Button
							aria-label="Like"
							className="size-20 rounded-full text-3xl active:scale-90"
							onClick={() => decide(top, true)}
						>
							♥
						</Button>
					</div>
				)}
			</div>

			<AnimatePresence>
				{detailFor && (
					<DetailSheet
						onClose={() => setDetailFor(null)}
						onDecide={(like) => {
							const place = detailFor;
							setDetailFor(null);
							decide(place, like);
						}}
						place={detailFor}
					/>
				)}
			</AnimatePresence>
		</main>
	);
}

function TopCard({
	place,
	exitDir,
	onDecide,
	onOpen,
}: {
	place: Place;
	exitDir: number;
	onDecide: (like: boolean) => void;
	onOpen: () => void;
}) {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-240, 240], [-16, 16]);
	const likeOpacity = useTransform(x, [40, 130], [0, 1]);
	const passOpacity = useTransform(x, [-130, -40], [1, 0]);

	// `onTap` fires at the end of a drag as well as on a genuine tap, so a swipe
	// that springs back would otherwise open the sheet. This records whether the
	// pointer travelled, and clears on the next press rather than on a timer.
	const draggedRef = useRef(false);

	function handleDragEnd(_: unknown, info: PanInfo) {
		draggedRef.current =
			Math.abs(info.offset.x) > TAP_SLOP || Math.abs(info.offset.y) > TAP_SLOP;

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
			onTap={() => {
				if (!draggedRef.current) onOpen();
			}}
			onTapStart={() => {
				draggedRef.current = false;
			}}
			style={{ x, rotate }}
			variants={CARD_VARIANTS}
		>
			<CardFace place={place} tappable>
				<motion.span
					className="absolute top-20 left-6 rotate-[-12deg] rounded-xl border-4 border-[--color-teal-deep] px-3 py-1 font-black text-2xl text-[--color-teal-deep]"
					style={{ opacity: likeOpacity }}
				>
					YES
				</motion.span>
				<motion.span
					className="absolute top-20 right-6 rotate-[12deg] rounded-xl border-4 border-foreground/40 px-3 py-1 font-black text-2xl text-foreground/40"
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
	tappable,
	children,
}: {
	place: Place;
	tappable?: boolean;
	children?: React.ReactNode;
}) {
	// Own image first, then Google's, then the emoji. `broken` collapses the
	// last two into one path: /api/place-photo 404s whenever there is no API key
	// or the shop simply has no photo, and a card should degrade to its emoji
	// rather than a broken-image icon.
	const [broken, setBroken] = useState(false);
	const googlePhoto = !place.imageUrl && place.placeId !== null && !broken;
	const hasPhoto = Boolean(place.imageUrl) || googlePhoto;
	const src = place.imageUrl ?? `/api/place-photo/${place.id}`;

	// A photo card carries its own scrim and reads white; a photoless one is an
	// ordinary light card. Type colour has to follow that, so it is picked once
	// here rather than repeated on every line below.
	const title = hasPhoto ? "text-white" : "text-foreground";
	const sub = hasPhoto ? "text-white/70" : "text-muted-foreground";

	return (
		<Card
			className={`relative h-full w-full select-none justify-end gap-0 overflow-hidden rounded-[28px] p-6 ${
				hasPhoto ? "bg-[--color-ink]" : ""
			}`}
		>
			{hasPhoto ? (
				// Arbitrary remote hosts, so plain <img> rather than next/image and its
				// domain allowlist. Cards are one-screen-sized and short-lived.
				// biome-ignore lint/performance/noImgElement: hosts are arbitrary
				<img
					alt=""
					className="absolute inset-0 h-full w-full object-cover"
					onError={() => setBroken(true)}
					src={src}
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center text-[9rem] opacity-15">
					{place.emoji}
				</div>
			)}
			{hasPhoto && (
				<div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
			)}

			{/* Attribution is a condition of using Places photos, so it is tied to
			    the same flag that renders one. */}
			{googlePhoto && (
				<span className="absolute top-4 right-4 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white/70">
					Powered by Google
				</span>
			)}

			{/* A tap target with no affordance is a tap target nobody finds. Only
			    the top card is interactive, which is why this is passed in rather
			    than assumed. */}
			{tappable && (
				<span
					className={`absolute top-4 left-4 rounded-full px-2.5 py-1 text-[11px] ${
						hasPhoto
							? "bg-black/50 text-white/80"
							: "bg-muted text-foreground/70"
					}`}
				>
					Tap for details
				</span>
			)}

			<div className="relative">
				<p
					className={`font-semibold text-xs uppercase tracking-widest ${
						hasPhoto ? "text-[--color-blush]" : "text-[--color-rose-deep]"
					}`}
				>
					{place.cuisine}
				</p>
				<h2 className={`mt-1 font-black text-3xl leading-tight ${title}`}>
					{place.name}
				</h2>
				<p className={`mt-2 text-sm ${sub}`}>
					{"$".repeat(place.priceLevel)} · {place.walkMinutes} min walk
				</p>
				{/* Only `true` shows a badge. `null` means nobody has verified this
				    shop, and a "not halal" badge on an unchecked spot would be a
				    claim the data does not support. */}
				{place.halal === true && (
					<Badge
						className={`mt-2 font-semibold ${
							hasPhoto
								? "bg-[--color-teal]/20 text-[--color-teal]"
								: "bg-[--color-teal]/15 text-[--color-teal-deep]"
						}`}
					>
						☪ Halal
					</Badge>
				)}
				{place.tags.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{place.tags.map((tag) => (
							<Badge
								className={
									hasPhoto ? "bg-white/15 text-white/80" : "text-foreground/70"
								}
								key={tag}
								variant={hasPhoto ? "default" : "secondary"}
							>
								{tag}
							</Badge>
						))}
					</div>
				)}
			</div>

			{children}
		</Card>
	);
}

type PlaceDetails = {
	rating?: number;
	ratingCount?: number;
	openNow?: boolean;
	address?: string;
	hours?: string[];
	attributions: string[];
};

/**
 * Everything the card does not have room for, over the top of the deck.
 *
 * The seed fields render immediately; the Places fields arrive when they
 * arrive. That split is deliberate — the sheet is useful the instant it opens,
 * and a rating fading in a moment later costs nothing, whereas a spinner in
 * front of the name would.
 */
function DetailSheet({
	place,
	onClose,
	onDecide,
}: {
	place: Place;
	onClose: () => void;
	onDecide: (like: boolean) => void;
}) {
	const [details, setDetails] = useState<PlaceDetails | null>(null);

	useEffect(() => {
		// Nothing to ask Google about a place with no place ID.
		if (place.placeId === null) return;

		const aborted = new AbortController();
		fetch(`/api/place-details/${place.id}`, { signal: aborted.signal })
			.then((r) => (r.ok ? (r.json() as Promise<PlaceDetails>) : null))
			.then((d) => d && setDetails(d))
			.catch(() => undefined);

		return () => aborted.abort();
	}, [place.id, place.placeId]);

	// Escape closes, because this is a modal and a laptop is a supported way to
	// argue about lunch.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const hasPhoto = Boolean(place.imageUrl) || place.placeId !== null;

	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			onClick={onClose}
		>
			{/* Clicks inside the sheet must not reach the dismiss-on-backdrop
			    handler above. Escape and the close button are the keyboard and
			    assistive paths out. */}
			<motion.div
				animate={{ y: 0 }}
				className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-[28px] bg-card sm:rounded-[28px]"
				exit={{ y: 40, opacity: 0 }}
				initial={{ y: 40 }}
				onClick={(e) => e.stopPropagation()}
				transition={{ type: "spring", stiffness: 320, damping: 32 }}
			>
				<div className="relative h-40 shrink-0 bg-[--color-ink]">
					{hasPhoto ? (
						// biome-ignore lint/performance/noImgElement: hosts are arbitrary
						<img
							alt=""
							className="h-full w-full object-cover"
							src={place.imageUrl ?? `/api/place-photo/${place.id}`}
						/>
					) : (
						<div className="flex h-full items-center justify-center text-6xl">
							{place.emoji}
						</div>
					)}
					<Button
						aria-label="Close"
						className="absolute top-3 right-3 size-9 rounded-full bg-black/50 text-white hover:bg-black/70"
						onClick={onClose}
						variant="ghost"
					>
						✕
					</Button>
				</div>

				{/* The one scrolling region. Opening hours are seven lines on their
				    own, so the sheet has to give somewhere. */}
				<div className="min-h-0 flex-1 overflow-y-auto p-6">
					<p className="font-semibold text-[--color-rose-deep] text-xs uppercase tracking-widest">
						{place.cuisine}
					</p>
					<h2 className="mt-1 font-black text-2xl leading-tight">
						{place.name}
					</h2>

					<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
						<span>{"$".repeat(place.priceLevel)}</span>
						<span>·</span>
						<span>{place.walkMinutes} min walk</span>
						{details?.rating !== undefined && (
							<>
								<span>·</span>
								<span>
									★ {details.rating.toFixed(1)}
									{details.ratingCount !== undefined &&
										` (${details.ratingCount})`}
								</span>
							</>
						)}
					</div>

					{details?.openNow !== undefined && (
						<Badge
							className={`mt-3 font-semibold ${
								details.openNow
									? "bg-[--color-teal]/20 text-[--color-teal-deep]"
									: "bg-destructive/10 text-destructive"
							}`}
						>
							{details.openNow ? "Open now" : "Closed now"}
						</Badge>
					)}

					{place.halal === true && (
						<Badge className="mt-3 ml-2 bg-[--color-teal]/15 font-semibold text-[--color-teal-deep]">
							☪ Halal
						</Badge>
					)}

					{place.tags.length > 0 && (
						<div className="mt-4 flex flex-wrap gap-1.5">
							{place.tags.map((tag) => (
								<Badge key={tag} variant="secondary">
									{tag}
								</Badge>
							))}
						</div>
					)}

					{details?.address && (
						<p className="mt-4 text-muted-foreground text-sm">
							{details.address}
						</p>
					)}

					{details?.hours && details.hours.length > 0 && (
						<div className="mt-4">
							<p className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
								Hours
							</p>
							<ul className="space-y-0.5 text-muted-foreground text-sm">
								{details.hours.map((line) => (
									<li key={line}>{line}</li>
								))}
							</ul>
						</div>
					)}

					{place.googleUrl && (
						<Button
							className="mt-5 h-12 w-full rounded-2xl bg-[--color-teal] font-bold text-[--color-ink] hover:bg-[--color-teal]/80"
							// Base UI clones this element and supplies the label as
							// children, so the anchor is written empty here.
							render={
								<a
									href={place.googleUrl}
									rel="noreferrer noopener"
									target="_blank"
								/>
							}
						>
							Open in Google Maps
						</Button>
					)}

					{/* Required wherever Google's place content is shown, and the
					    third-party attributions with it when there are any. */}
					{place.placeId !== null && (
						<p className="mt-4 text-[11px] text-muted-foreground">
							Powered by Google
							{details?.attributions.length
								? ` · ${details.attributions.join(", ")}`
								: ""}
						</p>
					)}
				</div>

				<div className="flex shrink-0 gap-3 border-t p-4">
					<Button
						className="h-12 flex-1 rounded-2xl"
						onClick={() => onDecide(false)}
						variant="outline"
					>
						✕ Pass
					</Button>
					<Button
						className="h-12 flex-1 rounded-2xl font-bold"
						onClick={() => onDecide(true)}
					>
						♥ Like
					</Button>
				</div>
			</motion.div>
		</motion.div>
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
			<motion.div
				animate={{ rotate: [0, 12, -12, 0] }}
				className="text-5xl"
				transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
			>
				⏳
			</motion.div>
			<p className="mt-4 font-bold text-lg">That's your lot</p>
			<p className="mt-1 text-muted-foreground text-sm">
				{waiting.length === 0
					? "Counting the votes…"
					: `Waiting on ${waiting.map((m) => m.name).join(", ")}`}
			</p>
			{waiting.length > 0 && (
				<Button
					className="mt-8 h-12 rounded-2xl px-5 font-bold active:scale-95"
					disabled={pending}
					onClick={onReveal}
					variant="outline"
				>
					{pending ? "Revealing…" : "Reveal without them"}
				</Button>
			)}
		</div>
	);
}
