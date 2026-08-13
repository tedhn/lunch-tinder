"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
			<label className="block">
				<span className="mb-2 block font-semibold text-white/50 text-xs uppercase tracking-widest">
					Your name
				</span>
				<input
					autoComplete="given-name"
					className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-lg outline-none placeholder:text-white/25 focus:border-white/30"
					maxLength={24}
					onChange={(e) => setName(e.target.value)}
					placeholder="Ted"
					value={name}
				/>
			</label>

			<button
				className="w-full rounded-2xl bg-[--color-flame] px-4 py-4 font-bold text-[--color-ink] text-lg transition active:scale-[0.98] disabled:opacity-40"
				disabled={!ready || create.isPending}
				onClick={handleCreate}
				type="button"
			>
				{create.isPending ? "Setting the table…" : "Start a room"}
			</button>

			<div className="flex items-center gap-3 text-white/30 text-xs">
				<div className="h-px flex-1 bg-white/10" />
				or join one
				<div className="h-px flex-1 bg-white/10" />
			</div>

			<div className="flex gap-2">
				<input
					autoCapitalize="characters"
					className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.4em] outline-none placeholder:text-white/20 focus:border-white/30"
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
				<button
					className="shrink-0 rounded-2xl border border-white/15 px-6 font-bold transition active:scale-[0.98] disabled:opacity-30"
					disabled={!ready || !codeReady}
					onClick={handleJoin}
					type="button"
				>
					Join
				</button>
			</div>

			{error && (
				<p className="rounded-xl bg-red-500/10 px-4 py-3 text-red-300 text-sm">
					{error}
				</p>
			)}
		</div>
	);
}
