import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { RESULT } from "../data";
import { COLORS } from "../theme";

/**
 * The payoff, tie and all.
 *
 * The tie is the point of showing this screen rather than a plain winner: three
 * spots level on votes, settled by the shorter walk and *said*, because crowning
 * one of three equal favourites without explanation reads as the app having an
 * opinion it did not earn.
 */
export function Results() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const pop = spring({ frame: frame - 4, fps, config: { damping: 15 } });
	const { winner, likes, voters, likedBy, tie, runnersUp } = RESULT;

	return (
		// Centred rather than top-aligned: the runners-up list is short, and
		// top-aligning left a third of the screen empty under it.
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
			}}
		>
			<div style={{ textAlign: "center", flexShrink: 0 }}>
				<p
					style={{
						margin: 0,
						fontSize: 26,
						fontWeight: 600,
						letterSpacing: 5,
						textTransform: "uppercase",
						color: COLORS.muted,
					}}
				>
					{voters} voters
				</p>
				<h1 style={{ margin: "10px 0 0", fontSize: 72, fontWeight: 900 }}>
					Lunch is served
				</h1>
			</div>

			<div
				style={{
					marginTop: 36,
					position: "relative",
					background: COLORS.creamSoft,
					border: `3px solid rgba(255,189,189,0.9)`,
					borderRadius: 56,
					padding: 44,
					transform: `scale(${0.94 + pop * 0.06})`,
					opacity: pop,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						top: -40,
						right: -20,
						fontSize: 240,
						opacity: 0.18,
					}}
				>
					{winner.emoji}
				</div>

				<div style={{ position: "relative" }}>
					<span
						style={{
							background: COLORS.blush,
							color: COLORS.ink,
							borderRadius: 999,
							padding: "10px 24px",
							fontSize: 24,
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: 2,
						}}
					>
						{tie.count}-way tie
					</span>
					<h2
						style={{
							margin: "26px 0 0",
							fontSize: 66,
							lineHeight: 1.05,
							fontWeight: 900,
							letterSpacing: -1,
						}}
					>
						{winner.name}
					</h2>
					<p style={{ margin: "14px 0 0", fontSize: 30, color: COLORS.muted }}>
						{winner.cuisine} · {winner.walkMinutes} min walk ·{" "}
						{"$".repeat(winner.priceLevel)}
					</p>
					<p style={{ margin: "22px 0 0", fontSize: 30, color: COLORS.muted }}>
						{likes} of {voters} swiped right — {likedBy.join(", ")}
					</p>
					<p
						style={{
							margin: "18px 0 0",
							fontSize: 30,
							lineHeight: 1.35,
							color: COLORS.roseDeep,
							opacity: interpolate(frame, [26, 46], [0, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							}),
						}}
					>
						{tie.count} spots got {likes} votes each. {winner.name} wins because
						it is the shorter walk.
					</p>

					<div
						style={{
							marginTop: 34,
							background: COLORS.teal,
							color: COLORS.ink,
							borderRadius: 28,
							padding: "24px 0",
							textAlign: "center",
							fontSize: 32,
							fontWeight: 700,
						}}
					>
						Open in Google Maps
					</div>
				</div>
			</div>

			<p
				style={{
					margin: "40px 0 16px",
					fontSize: 24,
					fontWeight: 600,
					letterSpacing: 4,
					textTransform: "uppercase",
					color: COLORS.muted,
				}}
			>
				Runners-up
			</p>
			<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
				{runnersUp.map((r, i) => (
					<div
						key={r.spot.id}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 22,
							background: COLORS.creamSoft,
							border: `2px solid ${COLORS.border}`,
							borderRadius: 28,
							padding: "20px 28px",
							opacity: interpolate(frame, [30 + i * 8, 46 + i * 8], [0, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							}),
						}}
					>
						<span style={{ fontSize: 44 }}>{r.spot.emoji}</span>
						<span style={{ flex: 1, fontSize: 32, fontWeight: 600 }}>
							{r.spot.name}
						</span>
						<span style={{ fontSize: 28, color: COLORS.muted }}>
							{r.likes}/{RESULT.voters}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
