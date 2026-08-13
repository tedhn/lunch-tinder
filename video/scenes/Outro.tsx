import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { COLORS } from "../theme";

const STACK = [
	"Next.js 15 · React 19",
	"tRPC · Prisma · Postgres",
	"Supabase Realtime",
	"Google Places (New)",
	"shadcn/ui · Motion",
];

export function Outro() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const pop = spring({ frame, fps, config: { damping: 14, mass: 0.7 } });

	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				padding: 70,
			}}
		>
			<div style={{ fontSize: 120, transform: `scale(${pop})` }}>🍜</div>
			<h2
				style={{
					margin: "26px 0 0",
					fontSize: 84,
					fontWeight: 900,
					letterSpacing: -3,
				}}
			>
				Lunch Tinder
			</h2>

			<div
				style={{
					marginTop: 48,
					display: "flex",
					flexDirection: "column",
					gap: 16,
				}}
			>
				{STACK.map((line, i) => (
					<p
						key={line}
						style={{
							margin: 0,
							fontSize: 34,
							color: COLORS.muted,
							opacity: interpolate(frame, [10 + i * 6, 26 + i * 6], [0, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							}),
						}}
					>
						{line}
					</p>
				))}
			</div>

			<p
				style={{
					margin: "58px 0 0",
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: 32,
					fontWeight: 600,
					background: COLORS.creamSoft,
					border: `2px solid ${COLORS.border}`,
					borderRadius: 999,
					padding: "18px 36px",
					opacity: interpolate(frame, [46, 64], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
				}}
			>
				github.com/tedhn/lunch-tinder
			</p>
		</div>
	);
}
