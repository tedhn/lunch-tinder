import type { Spot } from "../data";
import { COLORS } from "../theme";

/**
 * A deck card, matching CardFace in src/app/_components/swipe-deck.tsx.
 *
 * The photoless branch is the one drawn here — a light card with the emoji as a
 * watermark. The app's other branch pulls a live Google Places photo, which a
 * video has no business baking in: Maps Platform terms cap caching of place
 * photos, and a rendered MP4 is a cache that never expires.
 */
export function SpotCard({ spot }: { spot: Spot }) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				borderRadius: 56,
				background: COLORS.creamSoft,
				boxShadow: `0 2px 0 ${COLORS.border}, 0 30px 60px rgba(43,42,36,0.10)`,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				padding: 48,
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 320,
					opacity: 0.15,
				}}
			>
				{spot.emoji}
			</div>

			<div style={{ position: "relative" }}>
				<p
					style={{
						margin: 0,
						color: COLORS.roseDeep,
						fontSize: 24,
						fontWeight: 600,
						textTransform: "uppercase",
						letterSpacing: 4,
					}}
				>
					{spot.cuisine}
				</p>
				{/* Names run from "Dozo" to "Jatujak Bangkok Street Food", and the card
				    clips its overflow, so the size steps down rather than letting a long
				    one run off the edge. */}
				<h2
					style={{
						margin: "10px 0 0",
						fontSize: spot.name.length > 18 ? 46 : 62,
						lineHeight: 1.08,
						fontWeight: 900,
						letterSpacing: -1,
						overflowWrap: "break-word",
					}}
				>
					{spot.name}
				</h2>
				<p style={{ margin: "16px 0 0", fontSize: 28, color: COLORS.muted }}>
					{"$".repeat(spot.priceLevel)} · {spot.walkMinutes} min walk
				</p>
				<div style={{ display: "flex", gap: 12, marginTop: 24 }}>
					{spot.tags.map((tag) => (
						<span
							key={tag}
							style={{
								background: COLORS.blush,
								color: COLORS.ink,
								borderRadius: 999,
								padding: "8px 18px",
								fontSize: 22,
								fontWeight: 500,
							}}
						>
							{tag}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

/** The YES / NAH stamps that fade in as a card is dragged. */
export function Stamp({
	kind,
	opacity,
}: {
	kind: "like" | "pass";
	opacity: number;
}) {
	const like = kind === "like";
	// Written as an object rather than a computed key, which CSSProperties has no
	// way to narrow.
	const side = like ? { left: 48 } : { right: 48 };

	return (
		<div
			style={{
				position: "absolute",
				top: 96,
				...side,
				opacity,
				transform: `rotate(${like ? -12 : 12}deg)`,
				border: `8px solid ${like ? COLORS.tealDeep : "rgba(43,42,36,0.4)"}`,
				color: like ? COLORS.tealDeep : "rgba(43,42,36,0.4)",
				borderRadius: 24,
				padding: "8px 24px",
				fontSize: 54,
				fontWeight: 900,
				letterSpacing: 2,
			}}
		>
			{like ? "YES" : "NAH"}
		</div>
	);
}
