"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { getStoredName, getUserId, storeName } from "~/lib/user";
import { CODE_LENGTH } from "~/server/lunch/types";
import { api } from "~/trpc/react";

export function HomeForm() {
	const router = useRouter();
	const [userId, setUserId] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [code, setCode] = useState("");

	// localStorage is not available during the server render.
	useEffect(() => {
		setUserId(getUserId());
		setName(getStoredName());
	}, []);

	const create = api.room.create.useMutation({
		onSuccess: ({ code }) => router.push(`/room/${code}`),
	});

	const trimmed = name.trim();
	const ready = userId !== null && trimmed.length > 0;
	const codeReady = code.length === CODE_LENGTH;
	const error = create.error?.message;

	function handleCreate() {
		if (!ready || !userId) return;
		storeName(trimmed);
		create.mutate({ userId, name: trimmed });
	}

	function handleJoin() {
		if (!ready || !codeReady) return;
		storeName(trimmed);
		router.push(`/room/${code}`);
	}

	return (
		<div className="space-y-6">
			{/* shadcn's Input and Button default to a compact desktop scale (h-8).
			    This is a one-handed phone app, so every control is overridden up to
			    a comfortable thumb target rather than left at the default. */}
			{/* Wrapping the Input in the label would associate them, but Base UI
			    renders its own element inside, so the pairing is made explicit.
			    The div keeps the two out of the parent's `space-y-6` rhythm. */}
			<div>
				<label
					className="mb-2 block font-semibold text-muted-foreground text-xs uppercase tracking-widest"
					htmlFor="name"
				>
					Your name
				</label>
				<Input
					autoComplete="given-name"
					className="h-14 rounded-2xl bg-card px-4 text-lg"
					id="name"
					maxLength={24}
					onChange={(e) => setName(e.target.value)}
					placeholder="Ted"
					value={name}
				/>
			</div>

			<Button
				className="h-14 w-full rounded-2xl text-lg active:scale-[0.98]"
				disabled={!ready || create.isPending}
				onClick={handleCreate}
			>
				{create.isPending ? "Setting the table…" : "Start a room"}
			</Button>

			<div className="flex items-center gap-3 text-muted-foreground text-xs">
				<div className="h-px flex-1 bg-border" />
				or join one
				<div className="h-px flex-1 bg-border" />
			</div>

			<div className="flex gap-2">
				<Input
					autoCapitalize="characters"
					className="h-14 rounded-2xl bg-card text-center font-mono text-2xl tracking-[0.4em]"
					inputMode="text"
					onChange={(e) =>
						setCode(
							e.target.value
								.toUpperCase()
								.replace(/[^A-Z0-9]/g, "")
								.slice(0, CODE_LENGTH),
						)
					}
					placeholder="AB12"
					value={code}
				/>
				<Button
					className="h-14 shrink-0 rounded-2xl px-6 font-bold active:scale-[0.98]"
					disabled={!ready || !codeReady}
					onClick={handleJoin}
					variant="outline"
				>
					Join
				</Button>
			</div>

			{error && (
				<p className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive text-sm">
					{error}
				</p>
			)}
		</div>
	);
}
