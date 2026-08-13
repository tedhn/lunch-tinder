import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { COLORS } from "../theme";

export function Title() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const pop = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
	const lift = interpolate(frame, [6, 26], [40, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const fade = interpolate(frame, [6, 26], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const tagline = interpolate(frame, [22, 42], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				padding: 80,
			}}
		>
			<div style={{ fontSize: 190, transform: `scale(${pop})` }}>🍜</div>
			<h1
				style={{
					margin: "40px 0 0",
					fontSize: 132,
					fontWeight: 900,
					letterSpacing: -4,
					opacity: fade,
					transform: `translateY(${lift}px)`,
				}}
			>
				Lunch Tinder
			</h1>
			<p
				style={{
					margin: "28px 0 0",
					fontSize: 42,
					color: COLORS.muted,
					opacity: tagline,
				}}
			>
				Everyone swipes. Nobody argues. Lunch happens.
			</p>
		</div>
	);
}
