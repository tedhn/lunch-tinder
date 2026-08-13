import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Phone, Stage } from "./components/Phone";
import { SWIPES } from "./data";
import { Deck, SWIPE_FRAMES } from "./scenes/Deck";
import { Invite } from "./scenes/Invite";
import { Outro } from "./scenes/Outro";
import { Results } from "./scenes/Results";
import { Title } from "./scenes/Title";
import { Waiting } from "./scenes/Waiting";

export const FPS = 30;

/**
 * Scene lengths, in frames. Kept in one place and summed for the composition's
 * duration, so a scene cannot be lengthened without the video getting longer —
 * the failure mode otherwise is a last scene that gets cut off mid-word.
 */
export const SCENES = {
	title: 3 * FPS,
	invite: 4 * FPS,
	// Exactly as long as the swipes it has to show, so the deck never sits idle
	// on a spent stack.
	deck: SWIPES.length * SWIPE_FRAMES,
	waiting: 4 * FPS,
	results: 6 * FPS,
	outro: 4 * FPS,
} as const;

const ORDER = [
	"title",
	"invite",
	"deck",
	"waiting",
	"results",
	"outro",
] as const;

/**
 * Frame each scene starts on: the sum of everything before it. Derived rather
 * than written down, so adding a scene cannot leave a gap or an overlap.
 */
export const STARTS = (() => {
	const starts = {} as Record<(typeof ORDER)[number], number>;
	let at = 0;
	for (const name of ORDER) {
		starts[name] = at;
		at += SCENES[name];
	}
	return starts;
})();

export const DURATION = ORDER.reduce((total, name) => total + SCENES[name], 0);

/** A short fade at both ends of a scene, so scenes meet rather than jump. */
function Fade({
	children,
	duration,
}: {
	children: React.ReactNode;
	duration: number;
}) {
	const frame = useCurrentFrame();
	const opacity = interpolate(
		frame,
		[0, 8, duration - 8, duration],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/** The scenes that are meant to read as the app get the phone frame; the title
 * and outro are cards, not screens. */
function Screen({ children }: { children: React.ReactNode }) {
	return (
		<AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
			<Phone>{children}</Phone>
		</AbsoluteFill>
	);
}

export function LunchTinder() {
	return (
		<Stage>
			<Sequence durationInFrames={SCENES.title} from={STARTS.title}>
				<Fade duration={SCENES.title}>
					<AbsoluteFill>
						<Title />
					</AbsoluteFill>
				</Fade>
			</Sequence>

			<Sequence durationInFrames={SCENES.invite} from={STARTS.invite}>
				<Fade duration={SCENES.invite}>
					<Screen>
						<Invite />
					</Screen>
				</Fade>
			</Sequence>

			<Sequence durationInFrames={SCENES.deck} from={STARTS.deck}>
				<Fade duration={SCENES.deck}>
					<Screen>
						<Deck />
					</Screen>
				</Fade>
			</Sequence>

			<Sequence durationInFrames={SCENES.waiting} from={STARTS.waiting}>
				<Fade duration={SCENES.waiting}>
					<Screen>
						<Waiting />
					</Screen>
				</Fade>
			</Sequence>

			<Sequence durationInFrames={SCENES.results} from={STARTS.results}>
				<Fade duration={SCENES.results}>
					<Screen>
						<Results />
					</Screen>
				</Fade>
			</Sequence>

			<Sequence durationInFrames={SCENES.outro} from={STARTS.outro}>
				<Fade duration={SCENES.outro}>
					<AbsoluteFill>
						<Outro />
					</AbsoluteFill>
				</Fade>
			</Sequence>
		</Stage>
	);
}
