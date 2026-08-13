import { HomeForm } from "~/app/_components/home-form";

export default function HomePage() {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
			<div className="w-full max-w-sm">
				<div className="mb-10 text-center">
					<div className="mb-3 text-6xl">🍜</div>
					<h1 className="font-black text-4xl tracking-tight">Lunch Tinder</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Everyone swipes. Nobody argues. Lunch happens.
					</p>
				</div>

				<HomeForm />
			</div>
		</main>
	);
}
