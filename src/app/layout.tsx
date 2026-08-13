import "~/styles/globals.css";

import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Lunch Tinder",
	description: "Swipe on lunch, decide together, argue less.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export const viewport: Viewport = {
	// Matches the top of the page gradient, so the phone's status bar blends
	// into the app rather than banding against it.
	themeColor: "#ffe4d6",
	// The deck is a drag gesture; a double-tap zoom in the middle of it is noise.
	maximumScale: 1,
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${geist.variable}`} lang="en">
			<body className="no-overscroll font-sans antialiased">
				<TRPCReactProvider>{children}</TRPCReactProvider>
				{/* Page views and Web Vitals from Vercel. It only reports once deployed
				    there — locally the script is a no-op — and it collects no cookies,
				    so there is nothing to consent to. */}
				<Analytics />
			</body>
		</html>
	);
}
