"use client";

import { HeartIcon, XIcon } from "lucide-react";
import {
	AnimatePresence,
	motion,
	type PanInfo,
	useMotionValue,
	useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "~/components/ui/carousel";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerFooter,
	DrawerTitle,
} from "~/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useMediaQuery } from "~/hooks/use-media-query";
import { api, type RouterOutputs } from "~/trpc/react";

type RoomState = RouterOutputs["room"]["state"];
type Place = RoomState["deck"][number];

/** Past this, letting go decides the card; below it, the card springs back. */
const COMMIT_PX = 110;
const COMMIT_VELOCITY = 550;

/** Pointer travel, in px, still counted as a tap rather than a small drag. A
 * thumb never lands perfectly still, so zero would make the card feel dead. */
const TAP_SLOP = 8;

/** How early to send whatever has been swiped so far, so a slow swiper's votes
 * are in before the round closes rather than rejected a second after it. */
const FLUSH_BEFORE_DEADLINE_MS = 8_000;

/**
 * How far along somebody else is, in words.
 *
 * Since verdicts are submitted in a batch, a member's count is 0 until their
 * round lands and then jumps to the full deck. Printing "0/20" for somebody who
 * is actually on card 14 would be worse than saying nothing, so an unsubmitted
 * member reads as "swiping". A number only appears when there is a real partial
 * count behind it, which happens when a flush has already sent part of a round.
 */
function progressLabel(
	member: RoomState["members"][number],
	deckSize: number,
): string {
	if (member.done) return "done";
	if (member.swipedCount > 0) return `${member.swipedCount}/${deckSize}`;
	return "swiping";
}

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
	const me = room.members.find((m) => m.userId === userId);
	const serverCount = me?.swipedCount ?? 0;

	// Verdicts live here until they are submitted — one request for a deck rather
	// than one per card. A Map so a card swiped twice counts once, and in a ref as
	// well as state because the flush paths below (tab hidden, deadline near) run
	// outside React's render cycle and would otherwise send a stale copy.
	const [verdicts, setVerdicts] = useState<Map<string, boolean>>(new Map());
	const verdictsRef = useRef(verdicts);
	verdictsRef.current = verdicts;

	// Whatever the server has, plus whatever is still in hand. Submitted verdicts
	// are counted twice over — once locally, once by the server — which is why
	// this is a union of card ids rather than a sum of two numbers.
	const submittedRef = useRef<Set<string>>(new Set());
	const index = Math.max(serverCount, verdicts.size);

	const reveal = api.room.reveal.useMutation();
	const swipe = api.room.swipe.useMutation({
		// A phone leaving the office wifi is the common case, and this request now
		// carries a whole round rather than one card.
		retry: 2,
		retryDelay: (attempt) => 400 * 2 ** attempt,
		onSuccess: (_data, variables) => {
			for (const v of variables.verdicts)
				submittedRef.current.add(v.restaurantId);
		},
	});

	/**
	 * Sends everything not yet accepted by the server.
	 *
	 * Called when the deck runs out, when the tab is hidden, and shortly before
	 * the deadline. Overlapping calls are safe: the endpoint is idempotent per
	 * card, so the worst case is re-sending a verdict the server already has.
	 */
	const flush = useCallback(() => {
		const pending = [...verdictsRef.current]
			.filter(([restaurantId]) => !submittedRef.current.has(restaurantId))
			.map(([restaurantId, like]) => ({ restaurantId, like }));

		if (pending.length === 0) return;
		swipe.mutate({ code: room.code, userId, verdicts: pending });
	}, [room.code, userId, swipe]);

	// A locked phone or a switched tab must not take the round's votes with it.
	// `visibilitychange` is the one lifecycle event iOS Safari reliably fires
	// before it freezes a page; `pagehide` covers the rest.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") flush();
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", flush);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", flush);
		};
	}, [flush]);

	// And a few seconds before the deadline, because a batch that arrives after
	// the round closes is rejected — the votes of somebody still on card 12 when
	// the clock ran out would otherwise all be lost rather than just the cards
	// they had not reached.
	useEffect(() => {
		if (!room.votingEndsAt) return;

		const lead = room.votingEndsAt.getTime() - FLUSH_BEFORE_DEADLINE_MS;
		const wait = lead - Date.now();
		// Already inside the window: send now rather than scheduling the past.
		if (wait <= 0) {
			flush();
			return;
		}

		const timer = setTimeout(flush, wait);
		return () => clearTimeout(timer);
	}, [room.votingEndsAt, flush]);

	const [exitDir, setExitDir] = useState(0);
	// Two pieces of state rather than one nullable: the sheet has a closing
	// animation, so its content has to outlive the close. `detailFor` therefore
	// stays set after dismissal and is only replaced on the next open.
	const [detailFor, setDetailFor] = useState<Place | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);

	const stack = room.deck.slice(index, index + 3);
	const top = stack[0];
	const others = room.members.filter((m) => m.userId !== userId);

	function decide(place: Place, like: boolean) {
		setExitDir(like ? 1 : -1);

		const next = new Map(verdictsRef.current).set(place.id, like);
		verdictsRef.current = next;
		setVerdicts(next);

		// The last card is the one that sends the round. Read from `next` rather
		// than waiting for a re-render: this is the click that finished the deck.
		if (next.size >= room.deck.length) flush();
	}

	return (
		<main className="flex min-h-dvh flex-col px-5 py-6">
			<div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
				<header className="mb-4">
					<div className="mb-3 flex items-baseline justify-between gap-3">
						{/* The room code doubles as the invite, now that there is no lobby
						    screen to hold a share button. */}
						<ShareCode code={room.code} />
						<div className="flex shrink-0 items-baseline gap-3 text-xs">
							<Countdown endsAt={room.votingEndsAt} />
							<span className="text-muted-foreground">
								{Math.min(index, room.deckSize)} / {room.deckSize}
							</span>
						</div>
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
					{/* A failed submission is a whole round of votes, not one card, so it
					    gets a retry rather than a shrug. The verdicts are still in memory
					    at this point — pressing this sends the same batch again. */}
					{swipe.isError && (
						<div className="mt-2 flex items-center justify-between gap-2">
							<p className="text-[11px] text-destructive">
								Votes not sent yet.
							</p>
							<Button
								className="h-6 px-2 text-[11px]"
								disabled={swipe.isPending}
								onClick={flush}
								variant="outline"
							>
								{swipe.isPending ? "Sending…" : "Retry"}
							</Button>
						</div>
					)}
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
									{m.done ? "✓" : progressLabel(m, room.deckSize)}
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
								onOpen={() => {
									setDetailFor(top);
									setDetailOpen(true);
								}}
								place={top}
							/>
						) : null}
					</AnimatePresence>

					{!top && (
						<WaitingForOthers
							isHost={room.hostId === userId}
							onlineIds={onlineIds}
							onReveal={() => reveal.mutate({ code: room.code, userId })}
							pending={reveal.isPending}
							room={room}
							userId={userId}
						/>
					)}
				</div>

				{top && (
					<div className="mt-6 flex items-center justify-center gap-6">
						<Button
							aria-label="Pass"
							className="size-16 rounded-full border-2 active:scale-90"
							onClick={() => decide(top, false)}
							variant="outline"
						>
							<XIcon className="size-7" />
						</Button>
						<Button
							aria-label="Like"
							className="size-20 rounded-full shadow-lg shadow-primary/30 active:scale-90"
							onClick={() => decide(top, true)}
						>
							<HeartIcon className="size-9 fill-current" />
						</Button>
					</div>
				)}
			</div>

			{detailFor && (
				<DetailSheet
					onDecide={(like) => {
						setDetailOpen(false);
						if (detailFor) decide(detailFor, like);
					}}
					onOpenChange={setDetailOpen}
					open={detailOpen}
					place={detailFor}
				/>
			)}
		</main>
	);
}

/**
 * Time left before the votes get counted regardless.
 *
 * Also what ends the round on time. Nothing on the server is scheduled: reading
 * the room is what closes an expired one, so when this hits zero it asks for a
 * fresh read and the phase flips to results. The 30s backstop poll would get
 * there eventually; this makes it land on the second.
 *
 * Null on rooms created before the deadline existed — those still end the old
 * way, when everyone finishes or the host says so.
 */
function Countdown({ endsAt }: { endsAt: Date | null }) {
	const utils = api.useUtils();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!endsAt) return;
		const tick = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(tick);
	}, [endsAt]);

	const msLeft = endsAt ? endsAt.getTime() - now : null;

	useEffect(() => {
		if (msLeft === null || msLeft > 0) return;
		void utils.room.state.invalidate();
	}, [msLeft, utils]);

	if (msLeft === null) return null;

	const seconds = Math.max(0, Math.ceil(msLeft / 1000));
	const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

	// Under a minute the deadline stops being background information.
	return (
		<span
			className={
				seconds <= 60
					? "font-semibold text-destructive"
					: "text-muted-foreground"
			}
		>
			{seconds === 0 ? "counting…" : `${label} left`}
		</span>
	);
}

/**
 * The room code, and the way to hand it to someone. Native share on a phone,
 * clipboard everywhere else — the same split the lobby used before the waiting
 * room was removed.
 */
function ShareCode({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function share() {
		const url = window.location.href;
		if (navigator.share) {
			await navigator
				.share({ title: "Lunch Tinder", text: `Room ${code}`, url })
				.catch(() => undefined);
			return;
		}
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 1600);
	}

	return (
		<Button
			className="-ml-2 h-7 gap-2 rounded-full px-2 font-mono text-muted-foreground text-xs tracking-widest"
			onClick={() => void share()}
			variant="ghost"
		>
			{code}
			<span className="font-sans tracking-normal">
				{copied ? "copied" : "invite"}
			</span>
		</Button>
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
	photoCount: number;
	attributions: string[];
};

/**
 * Everything the card does not have room for.
 *
 * Two presentations of the same content: a swipe-down Drawer on a phone, where
 * the sheet coming up from the thumb matches how the deck is already being
 * handled, and a centred Dialog on a desktop, where a bottom sheet on a 27"
 * screen is a long way from the pointer. They are different components rather
 * than one component with responsive classes, so the choice is made in JS.
 *
 * The seed fields render immediately; the Places fields arrive when they
 * arrive. That split is deliberate — the sheet is useful the instant it opens,
 * and a rating fading in a moment later costs nothing, whereas a spinner in
 * front of the name would.
 */
function DetailSheet({
	place,
	open,
	onOpenChange,
	onDecide,
}: {
	place: Place;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDecide: (like: boolean) => void;
}) {
	const [details, setDetails] = useState<PlaceDetails | null>(null);
	// Matches Tailwind's `sm`. Below it, the drawer; at or above, the dialog.
	const isDesktop = useMediaQuery("(min-width: 640px)");

	useEffect(() => {
		// Nothing to ask Google about a place with no place ID, and nothing to ask
		// at all until the sheet is actually open — these calls are billed.
		if (!open || place.placeId === null) return;

		const aborted = new AbortController();
		fetch(`/api/place-details/${place.id}`, { signal: aborted.signal })
			.then((r) => (r.ok ? (r.json() as Promise<PlaceDetails>) : null))
			.then((d) => d && setDetails(d))
			.catch(() => undefined);

		return () => aborted.abort();
	}, [open, place.id, place.placeId]);

	// Both presentations share everything below the chrome. The name rides on the
	// photo rather than sitting above the tabs: it is the one thing that must be
	// readable before anything else has loaded, and putting it here buys the tabs
	// the full width of the sheet.
	const photo = (
		<div className="relative shrink-0">
			<DetailPhoto photoCount={details?.photoCount ?? 0} place={place} />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pt-16 pb-5">
				<p className="font-semibold text-[--color-blush] text-xs uppercase tracking-widest">
					{place.cuisine}
				</p>
				<h2 className="mt-1 font-black text-3xl text-white leading-tight">
					{place.name}
				</h2>
			</div>
		</div>
	);
	const body = <DetailBody details={details} place={place} />;
	// Lucide rather than ✕ and ♥: the glyphs sit on different baselines in most
	// fonts, so one label always looked a pixel lower than the other.
	const actions = (
		<div className="flex w-full gap-3">
			<Button
				className="h-13 flex-1 rounded-2xl text-base active:scale-[0.98]"
				onClick={() => onDecide(false)}
				variant="outline"
			>
				<XIcon className="size-5" />
				Pass
			</Button>
			<Button
				className="h-13 flex-1 rounded-2xl text-base active:scale-[0.98]"
				onClick={() => onDecide(true)}
			>
				<HeartIcon className="size-5 fill-current" />
				Like
			</Button>
		</div>
	);

	if (isDesktop) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				{/* `p-0` and `gap-0` because the photo is full-bleed to the dialog's
				    own rounded corners; padding is applied per-section instead. The
				    built-in close button is replaced by one with a scrim, since the
				    default's dark glyph lands on a photo. */}
				<DialogContent
					className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
					showCloseButton={false}
				>
					<DialogTitle className="sr-only">{place.name}</DialogTitle>
					<div className="relative shrink-0">
						{photo}
						<DialogClose
							render={
								<Button
									aria-label="Close"
									className="absolute top-3 right-3 z-10 size-9 rounded-full bg-black/50 text-white hover:bg-black/70"
									variant="ghost"
								/>
							}
						>
							✕
						</DialogClose>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto p-6">{body}</div>
					{/* `mx-0 mb-0` undoes the component's `-mx-4 -mb-4`, which assumes a
					    dialog with `p-4` to bleed into. This one is `p-0`, so without
					    that reset the footer hangs 16px outside the rounded corners and
					    the Like button is clipped. */}
					<DialogFooter className="mx-0 mb-0 border-t bg-card p-4">
						{actions}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		// `showSwipeHandle` earns its place here: the drawer is dismissed with the
		// same downward flick the deck has trained the thumb to make.
		<Drawer onOpenChange={onOpenChange} open={open} showSwipeHandle>
			<DrawerContent className="max-h-[85dvh]">
				<DrawerTitle className="sr-only">{place.name}</DrawerTitle>
				<div className="relative shrink-0">
					{photo}
					<DrawerClose
						render={
							<Button
								aria-label="Close"
								className="absolute top-3 right-3 z-10 size-9 rounded-full bg-black/50 text-white hover:bg-black/70"
								variant="ghost"
							/>
						}
					>
						✕
					</DrawerClose>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-6">{body}</div>
				{/* The extra bottom padding clears a phone's home indicator, which
				    otherwise sits on top of the buttons. */}
				<DrawerFooter className="border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					{actions}
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

/**
 * The header: a carousel of the place's Google photos, or the emoji when there
 * are none.
 *
 * Slides are `<img src=".../place-photo/id?n=2">` rather than a list of URLs
 * fetched up front, for two reasons. Google's photo URLs are signed and expire,
 * so they cannot be held; and each one is a billed call, so a slide nobody
 * swipes to should not cost anything. Lazy loading on all but the first is what
 * makes that true.
 */
function DetailPhoto({
	place,
	photoCount,
}: {
	place: Place;
	photoCount: number;
}) {
	// `photoCount` arrives with the Places response, a moment after the sheet
	// opens. Until then show the one photo the card was already showing, so the
	// header never starts empty and then jumps.
	const slides = place.imageUrl
		? null
		: Array.from({ length: Math.max(photoCount, 1) }, (_, i) => i);
	const hasPhoto = Boolean(place.imageUrl) || place.placeId !== null;

	if (!hasPhoto) {
		return (
			<div className="flex h-80 shrink-0 items-center justify-center bg-[--color-ink] text-8xl sm:h-96">
				{place.emoji}
			</div>
		);
	}

	// A single photo does not need a carousel's controls or its dots.
	if (!slides || slides.length === 1) {
		return (
			<div className="h-80 shrink-0 bg-[--color-ink] sm:h-96">
				{/* biome-ignore lint/performance/noImgElement: hosts are arbitrary */}
				<img
					alt=""
					className="h-full w-full object-cover"
					src={place.imageUrl ?? `/api/place-photo/${place.id}`}
				/>
			</div>
		);
	}

	return (
		<Carousel
			className="h-80 shrink-0 bg-[--color-ink] sm:h-96"
			opts={{ loop: true }}
		>
			{/* `-ml-4`/`pl-4` is the component's default gutter, undone here: these
			    are full-bleed photos, not cards in a row. */}
			<CarouselContent className="ml-0 h-80 sm:h-96">
				{slides.map((n) => (
					<CarouselItem className="h-80 pl-0 sm:h-96" key={n}>
						{/* biome-ignore lint/performance/noImgElement: hosts are arbitrary */}
						<img
							alt=""
							className="h-full w-full object-cover"
							loading={n === 0 ? "eager" : "lazy"}
							src={`/api/place-photo/${place.id}?n=${n}`}
						/>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious className="left-3 border-0 bg-black/50 text-white hover:bg-black/70 hover:text-white" />
			<CarouselNext className="right-3 border-0 bg-black/50 text-white hover:bg-black/70 hover:text-white" />
			{/* Top-left, not bottom-centre: the name sits over the bottom of the
			    photo now. */}
			<span className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white/80">
				{slides.length} photos
			</span>
		</Carousel>
	);
}

/**
 * The scrolling part, split into tabs.
 *
 * Hours and Location are their own tabs rather than more of one long column
 * because they answer different questions — "can we still go" and "where is it"
 * — and because seven lines of opening hours pushed everything else off a phone
 * screen. Name and cuisine are not here at all; they sit over the photo.
 *
 * A tab appears only when it has something in it. `details` lands a moment after
 * the sheet opens, and a place with no place ID never gets any, so this is often
 * just the one Overview tab with no tab bar at all.
 */
function DetailBody({
	place,
	details,
}: {
	place: Place;
	details: PlaceDetails | null;
}) {
	const hasHours = Boolean(details?.hours?.length);
	const hasLocation = Boolean(details?.address);

	return (
		<Tabs defaultValue="overview">
			{(hasHours || hasLocation) && (
				<TabsList className="w-full">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					{hasHours && <TabsTrigger value="hours">Hours</TabsTrigger>}
					{hasLocation && <TabsTrigger value="location">Location</TabsTrigger>}
				</TabsList>
			)}

			<TabsContent className="pt-3" value="overview">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
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

				{(details?.openNow !== undefined || place.halal === true) && (
					<div className="mt-3 flex flex-wrap gap-2">
						{details?.openNow !== undefined && (
							<Badge
								className={`font-semibold ${
									details.openNow
										? "bg-[--color-teal]/20 text-[--color-teal-deep]"
										: "bg-destructive/10 text-destructive"
								}`}
							>
								{details.openNow ? "Open now" : "Closed now"}
							</Badge>
						)}
						{place.halal === true && (
							<Badge className="bg-[--color-teal]/15 font-semibold text-[--color-teal-deep]">
								☪ Halal
							</Badge>
						)}
					</div>
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

				<MapsLink place={place} />
				<Attribution details={details} place={place} />
			</TabsContent>

			{hasHours && (
				<TabsContent className="pt-3" value="hours">
					<ul className="space-y-1 text-muted-foreground text-sm">
						{details?.hours?.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
					<Attribution details={details} place={place} />
				</TabsContent>
			)}

			{hasLocation && (
				<TabsContent className="pt-3" value="location">
					<p className="text-muted-foreground text-sm">{details?.address}</p>
					<MapsLink place={place} />
					<Attribution details={details} place={place} />
				</TabsContent>
			)}
		</Tabs>
	);
}

function MapsLink({ place }: { place: Place }) {
	if (!place.googleUrl) return null;

	return (
		<Button
			className="mt-5 h-12 w-full rounded-2xl bg-[--color-teal] font-bold text-[--color-ink] hover:bg-[--color-teal]/80"
			// Base UI clones this element and supplies the label as children, so the
			// anchor is written empty here.
			render={
				<a href={place.googleUrl} rel="noreferrer noopener" target="_blank" />
			}
		>
			Open in Google Maps
		</Button>
	);
}

/** Required wherever Google's place content is shown, and the third-party
 * attributions with it when there are any. Per-tab, because each tab is showing
 * that content in its own right. */
function Attribution({
	place,
	details,
}: {
	place: Place;
	details: PlaceDetails | null;
}) {
	if (place.placeId === null) return null;

	return (
		<p className="mt-4 text-[11px] text-muted-foreground">
			Powered by Google
			{details?.attributions.length
				? ` · ${details.attributions.join(", ")}`
				: ""}
		</p>
	);
}

/**
 * What somebody who has finished sees while the round is still open.
 *
 * This is the screen with the least to do and the most to explain, so it carries
 * the full roster: who is online, how far each person has got, and how long
 * until the votes are counted anyway. The alternative — "waiting on Ted" and a
 * spinner — is the version where people start asking out loud whether the app is
 * broken or Ted is just slow.
 */
function WaitingForOthers({
	room,
	userId,
	onlineIds,
	pending,
	isHost,
	onReveal,
}: {
	room: RoomState;
	userId: string;
	onlineIds: Set<string>;
	pending: boolean;
	isHost: boolean;
	onReveal: () => void;
}) {
	const waiting = room.members.filter((m) => !m.done);
	const host = room.members.find((m) => m.userId === room.hostId);

	return (
		<div className="flex h-full flex-col items-center justify-center px-1 text-center">
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
					? "Everyone has swiped — the clock decides when it counts."
					: `Still swiping: ${waiting.map((m) => m.name).join(", ")}`}
			</p>

			{/* The round runs to the clock even when everybody has finished, which
			    means this line is the answer to "so what happens now". Latecomers can
			    still join and vote in the time that is left, which is the reason the
			    last swipe does not end anything. */}
			{room.votingEndsAt && (
				<p className="mt-2 text-muted-foreground text-xs">
					Votes are counted in <Countdown endsAt={room.votingEndsAt} />.
				</p>
			)}

			<Card className="mt-6 w-full gap-0 divide-y rounded-2xl p-0 text-left">
				{room.members.map((m) => (
					<div className="flex items-center gap-3 px-4 py-2.5" key={m.userId}>
						<span
							className={`size-2 shrink-0 rounded-full ${
								onlineIds.has(m.userId)
									? "bg-[--color-teal]"
									: "bg-muted-foreground/40"
							}`}
							title={onlineIds.has(m.userId) ? "On the app" : "Away"}
						/>
						<span className="min-w-0 flex-1 truncate font-medium text-sm">
							{m.name}
							{m.userId === userId && (
								<span className="ml-1.5 text-muted-foreground text-xs">
									you
								</span>
							)}
						</span>
						{m.done ? (
							<Badge className="bg-[--color-teal]/15 font-semibold text-[--color-teal-deep]">
								done
							</Badge>
						) : (
							<span className="shrink-0 text-muted-foreground text-xs">
								{progressLabel(m, room.deckSize)}
							</span>
						)}
					</div>
				))}
			</Card>
			{/* Ending the round early throws away votes not yet cast, so it belongs
			    to whoever opened the room. Everyone else is told who that is rather
			    than shown a button that would only return a 403. */}
			{/* Offered whether or not anyone is still swiping: the round no longer
			    ends by itself when the last person finishes, so without this the host
			    would be watching a clock they are allowed to skip. */}
			{isHost ? (
				<Button
					className="mt-6 h-12 rounded-2xl px-5 font-bold active:scale-95"
					disabled={pending}
					onClick={onReveal}
					variant="outline"
				>
					{pending ? "Counting…" : "Count the votes now"}
				</Button>
			) : (
				<p className="mt-6 max-w-[16rem] text-muted-foreground text-xs">
					{host
						? `${host.name} started this room and can count the votes early.`
						: "The round ends when the clock does."}
				</p>
			)}
		</div>
	);
}
