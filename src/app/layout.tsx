import "~/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Lunch Tinder",
	description: "Swipe on lunch, decide together, argue less.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export const viewport: Viewport = {
	themeColor: "#1a1014",
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
			</body>
		</html>
	);
}
