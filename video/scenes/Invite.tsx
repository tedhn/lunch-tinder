import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { ROOM_CODE } from "../data";
import { COLORS } from "../theme";

/**
 * The room code, and the claim that there is no waiting room.
 *
 * Worth its own beat because it is the design decision most likely to be
 * mistaken for a missing feature: rooms open straight into swiping, so the code
 * is an invite rather than a lobby door.
 */
export function Invite() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const enter = spring({ frame, fps, config: { damping: 16 } });
	const letters = ROOM_CODE.split("");

	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				padding: 60,
			}}
		>
			<p
				style={{
					margin: 0,
					fontSize: 28,
					fontWeight: 600,
					letterSpacing: 6,
					textTransform: "uppercase",
					color: COLORS.muted,
					opacity: enter,
				}}
			>
				Room code
			</p>

			<div style={{ display: "flex", gap: 18, marginTop: 28 }}>
				{letters.map((char, i) => {
					const drop = spring({
						frame: frame - 6 - i * 4,
						fps,
						config: { damping: 13 },
					});
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: a room code can repeat a character, and the position is what identifies a tile here
							key={`${char}-${i}`}
							style={{
								fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
								fontSize: 128,
								fontWeight: 800,
								background: COLORS.creamSoft,
								border: `2px solid ${COLORS.border}`,
								borderRadius: 28,
								padding: "18px 30px",
								transform: `translateY(${(1 - drop) * -60}px)`,
								opacity: drop,
							}}
						>
							{char}
						</span>
					);
				})}
			</div>

			<p
				style={{
					margin: "56px 0 0",
					fontSize: 44,
					lineHeight: 1.3,
					fontWeight: 700,
					opacity: interpolate(frame, [30, 50], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
				}}
			>
				No lobby. No "waiting for others".
			</p>
			<p
				style={{
					margin: "20px 0 0",
					fontSize: 34,
					color: COLORS.muted,
					opacity: interpolate(frame, [42, 62], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
				}}
			>
				Share the code. Everyone swipes the same deck,
				<br />
				whenever they get to their phone.
			</p>
		</div>
	);
}
