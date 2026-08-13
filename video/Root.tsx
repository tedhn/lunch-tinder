import { Composition } from "remotion";

import { DURATION, FPS, LunchTinder } from "./LunchTinder";

/**
 * 1080×1920 because the app is a phone app: a vertical cut is what the thing
 * being demonstrated actually looks like, and what a phone-shaped promo gets
 * watched on.
 */
export function RemotionRoot() {
	return (
		<Composition
			component={LunchTinder}
			durationInFrames={DURATION}
			fps={FPS}
			height={1920}
			id="LunchTinder"
			width={1080}
		/>
	);
}
