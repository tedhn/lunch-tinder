/**
 * The app's palette, restated for the video.
 *
 * These are the same values as the `@theme` block in src/styles/globals.css
 * (colorhunt.co/palette/fcf9eabadfdbffa4a4ffbdbd). They are duplicated rather
 * than imported because Remotion bundles its own entry point: pulling in the
 * app's CSS would mean wiring Tailwind into a second build for four hex codes.
 * If the app's palette changes, change it here too.
 */
export const COLORS = {
	cream: "#fcf9ea",
	creamSoft: "#ffffff",
	teal: "#badfdb",
	salmon: "#ffa4a4",
	blush: "#ffbdbd",
	ink: "#2b2a24",
	inkSoft: "#1e1d19",
	roseDeep: "#a14a4a",
	tealDeep: "#2c6e68",
	/** `--muted-foreground`, converted from oklch(0.5 0.015 75). */
	muted: "#7c7468",
	/** `--muted`, the pale fill behind a progress track. */
	mutedFill: "#f3efe2",
	border: "rgba(43, 42, 36, 0.14)",
} as const;

/** No webfont: one less thing to fetch at render time, and the system stack is
 * what the app falls back to anyway. Emoji is explicit so the cards keep their
 * colour glyphs in headless Chrome. */
export const FONT =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

export const PHONE = {
	width: 900,
	height: 1560,
	radius: 72,
} as const;
