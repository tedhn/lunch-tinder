import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DeckHeader } from "../components/Phone";
import { SpotCard, Stamp } from "../components/SpotCard";
import { DECK_SIZE, ROOM_CODE, SPOTS, SWIPES } from "../data";
import { COLORS } from "../theme";

/** Frames per card: a beat to read it, a beat to throw it. */
export const SWIPE_FRAMES = 60;
/** Where in that cycle the thumb takes hold, and where the card leaves. */
const DRAG_START = 18;
const THROW_START = 30;
const THROW_END = 50;

/** Long enough that the deck scene never runs the clock into the red. */
const START_SECONDS = 9 * 60 + 58;

/**
 * The swipe deck, mid-round.
 *
 * The stack, the rotation-follows-x drag, the stamps and the progress bar are
 * all the real thing — see TopCard in src/app/_components/swipe-deck.tsx. What
 * is faked is the thumb: each card throws itself on a fixed cadence.
 */
export function Deck() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cycle = Math.min(Math.floor(frame / SWIPE_FRAMES), SWIPES.length - 1);
	const local = frame - cycle * SWIPE_FRAMES;
	const direction = SWIPES[cycle] === "like" ? 1 : -1;

	// Only counts a card once it has actually left, so the number never leads the
	// picture.
	const swiped = cycle + (local >= THROW_END ? 1 : 0);
	const secondsLeft = START_SECONDS - Math.floor(frame / fps);

	// A short drag, then the throw. The drag is what makes the stamp readable: on
	// a right swipe the YES sits at the card's top-left, so by the time the card
	// is leaving the frame the stamp has already gone with it.
	const x = interpolate(
		local,
		[DRAG_START, THROW_START, THROW_END],
		[0, direction * 90, direction * 1200],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);
	const rotate = interpolate(
		local,
		[DRAG_START, THROW_START, THROW_END],
		[0, direction * 4, direction * 18],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);
	const stamp = interpolate(local, [DRAG_START, THROW_START], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	// The card underneath rises to meet the gap as the top one goes. Position and
	// scale only — the cards stay fully opaque, because a translucent front card
	// lets the one behind it show through its own text.
	const rise = interpolate(local, [THROW_START, THROW_END], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const top = SPOTS[cycle];
	const next = SPOTS[cycle + 1];
	const third = SPOTS[cycle + 2];

	return (
		<>
			<DeckHeader
				code={ROOM_CODE}
				deckSize={DECK_SIZE}
				secondsLeft={secondsLeft}
				swiped={swiped}
			/>

			<div style={{ position: "relative", flex: 1, marginTop: 28 }}>
				{/* The cards behind are lifted far enough that their top edge clears the
				    top card. A few pixels — which is what the app uses on a real phone —
				    disappears entirely at this scale, and a deck that does not look like
				    a deck is the one thing this scene has to get right. */}
				{third && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							transform: "scale(0.9) translateY(-96px)",
						}}
					>
						<SpotCard spot={third} />
					</div>
				)}
				{next && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							transform: `scale(${0.95 + rise * 0.05}) translateY(${-48 + rise * 48}px)`,
						}}
					>
						<SpotCard spot={next} />
					</div>
				)}
				{top && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							transform: `translateX(${x}px) rotate(${rotate}deg)`,
						}}
					>
						<SpotCard spot={top} />
						<Stamp
							kind={SWIPES[cycle] === "like" ? "like" : "pass"}
							opacity={stamp}
						/>
					</div>
				)}
			</div>

			{/* The two buttons, pulsing on the frame the card commits. */}
			<div
				style={{
					flexShrink: 0,
					display: "flex",
					justifyContent: "center",
					gap: 48,
					marginTop: 36,
				}}
			>
				<Pill active={direction === -1 && local >= THROW_START} kind="pass" />
				<Pill active={direction === 1 && local >= THROW_START} kind="like" />
			</div>
		</>
	);
}

function Pill({ kind, active }: { kind: "like" | "pass"; active: boolean }) {
	const like = kind === "like";
	const size = like ? 132 : 108;

	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: like ? 62 : 52,
				color: like ? COLORS.ink : COLORS.ink,
				background: like ? COLORS.salmon : "transparent",
				border: like ? "none" : `4px solid ${COLORS.border}`,
				boxShadow: like ? "0 16px 40px rgba(255,164,164,0.5)" : "none",
				transform: `scale(${active ? 0.9 : 1})`,
			}}
		>
			{like ? "♥" : "✕"}
		</div>
	);
}
