"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query in JS, for the cases where the two presentations are
 * different components rather than different styling — a drawer on a phone and
 * a dialog on a desktop cannot be one element with responsive classes.
 *
 * Starts `false` on the server and on the first client render, because there is
 * no viewport to measure during SSR and guessing would mean a hydration
 * mismatch. Anything using this should therefore treat `false` as its default
 * presentation; here that is the phone, which is the app's main target anyway.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const list = window.matchMedia(query);
		setMatches(list.matches);

		const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
		list.addEventListener("change", onChange);
		return () => list.removeEventListener("change", onChange);
	}, [query]);

	return matches;
}
