import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

import { COLORS, FONT, PHONE } from "../theme";

/**
 * The page background — cream with the blush radial the app paints on `body`.
 */
export function Stage({ children }: { children: ReactNode }) {
	return (
		<AbsoluteFill
			style={{
				background: `radial-gradient(120% 60% at 50% 0%, ${COLORS.blush} 0%, transparent 55%), ${COLORS.cream}`,
				fontFamily: FONT,
				color: COLORS.ink,
			}}
		>
			{children}
		</AbsoluteFill>
	);
}

/**
 * A phone-shaped frame for the screens that are meant to read as the app.
 *
 * Deliberately plain — no notch, no bezel highlights. The point of the frame is
 * to say "this is one screen of a phone app", and anything more detailed starts
 * competing with the content inside it.
 */
export function Phone({
	children,
	style,
}: {
	children: ReactNode;
	style?: React.CSSProperties;
}) {
	return (
		<div
			style={{
				width: PHONE.width,
				height: PHONE.height,
				borderRadius: PHONE.radius,
				background: COLORS.cream,
				border: `2px solid ${COLORS.border}`,
				boxShadow: "0 40px 120px rgba(43, 42, 36, 0.18)",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				padding: 40,
				...style,
			}}
		>
			{children}
		</div>
	);
}

/** The deck header: room code, countdown, progress. Shared by the swiping and
 * waiting scenes so they line up frame to frame. */
export function DeckHeader({
	code,
	swiped,
	deckSize,
	secondsLeft,
}: {
	code: string;
	swiped: number;
	deckSize: number;
	secondsLeft: number;
}) {
	const minutes = Math.floor(secondsLeft / 60);
	const seconds = secondsLeft % 60;
	const urgent = secondsLeft <= 60;

	return (
		<div style={{ flexShrink: 0 }}>
			<div
				style={{
					display: "flex",
					alignItems: "baseline",
					justifyContent: "space-between",
					marginBottom: 18,
				}}
			>
				<span
					style={{
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: 26,
						letterSpacing: 6,
						color: COLORS.muted,
					}}
				>
					{code}
					<span style={{ fontFamily: FONT, letterSpacing: 0, marginLeft: 14 }}>
						invite
					</span>
				</span>
				<span style={{ display: "flex", gap: 22, fontSize: 26 }}>
					<span
						style={{
							color: urgent ? "#b3261e" : COLORS.muted,
							fontWeight: urgent ? 700 : 400,
						}}
					>
						{minutes}:{String(seconds).padStart(2, "0")} left
					</span>
					<span style={{ color: COLORS.muted }}>
						{swiped} / {deckSize}
					</span>
				</span>
			</div>
			<div
				style={{
					height: 8,
					borderRadius: 999,
					background: COLORS.mutedFill,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						height: "100%",
						width: `${(swiped / deckSize) * 100}%`,
						background: COLORS.blush,
					}}
				/>
			</div>
		</div>
	);
}
