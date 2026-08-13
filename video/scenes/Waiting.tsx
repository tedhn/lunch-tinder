import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { DeckHeader } from "../components/Phone";
import { DECK_SIZE, MEMBERS, ROOM_CODE } from "../data";
import { COLORS } from "../theme";

/**
 * The screen for somebody who has finished while the round is still open.
 *
 * The clock is the message. A round ends when the deadline passes or when the
 * host counts the votes — finishing the deck ends nothing, which is what lets a
 * latecomer still vote, and what this screen has to make obvious.
 */
export function Waiting() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Deliberately inside the last minute: this is the beat where the countdown
	// stops being background information and turns red.
	const secondsLeft = Math.max(0, 24 - Math.floor(frame / fps));

	return (
		<>
			<DeckHeader
				code={ROOM_CODE}
				deckSize={DECK_SIZE}
				secondsLeft={secondsLeft}
				swiped={DECK_SIZE}
			/>

			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
				}}
			>
				<div
					style={{
						fontSize: 120,
						transform: `rotate(${Math.sin(frame / 14) * 12}deg)`,
					}}
				>
					⏳
				</div>
				<p style={{ margin: "28px 0 0", fontSize: 46, fontWeight: 700 }}>
					That's your lot
				</p>
				<p style={{ margin: "14px 0 0", fontSize: 32, color: COLORS.muted }}>
					Votes are counted in{" "}
					<span style={{ color: "#b3261e", fontWeight: 700 }}>
						0:{String(secondsLeft).padStart(2, "0")}
					</span>{" "}
					either way.
				</p>

				<div
					style={{
						marginTop: 52,
						width: "100%",
						background: COLORS.creamSoft,
						border: `2px solid ${COLORS.border}`,
						borderRadius: 36,
						overflow: "hidden",
					}}
				>
					{MEMBERS.map((m, i) => (
						<div
							key={m.name}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 20,
								padding: "26px 32px",
								borderTop: i === 0 ? "none" : `2px solid ${COLORS.border}`,
								opacity: interpolate(frame, [8 + i * 6, 24 + i * 6], [0, 1], {
									extrapolateLeft: "clamp",
									extrapolateRight: "clamp",
								}),
							}}
						>
							<span
								style={{
									width: 16,
									height: 16,
									borderRadius: "50%",
									background: m.online ? COLORS.teal : "rgba(124,116,104,0.4)",
								}}
							/>
							<span
								style={{
									flex: 1,
									textAlign: "left",
									fontSize: 32,
									fontWeight: 500,
								}}
							>
								{m.name}
							</span>
							{m.done ? (
								<span
									style={{
										background: "rgba(186,223,219,0.45)",
										color: COLORS.tealDeep,
										fontWeight: 600,
										fontSize: 24,
										borderRadius: 999,
										padding: "8px 20px",
									}}
								>
									done
								</span>
							) : (
								<span style={{ fontSize: 26, color: COLORS.muted }}>
									swiping
								</span>
							)}
						</div>
					))}
				</div>

				<div
					style={{
						marginTop: 44,
						border: `3px solid ${COLORS.border}`,
						borderRadius: 32,
						padding: "22px 40px",
						fontSize: 30,
						fontWeight: 700,
					}}
				>
					Count the votes now
				</div>
				<p style={{ margin: "18px 0 0", fontSize: 24, color: COLORS.muted }}>
					Host only
				</p>
			</div>
		</>
	);
}
