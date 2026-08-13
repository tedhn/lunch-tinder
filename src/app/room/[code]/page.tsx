import { notFound } from "next/navigation";

import { RoomClient } from "~/app/room/[code]/room-client";
import { CODE_LENGTH } from "~/server/lunch/types";

export default async function RoomPage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code } = await params;
	const normalized = code.trim().toUpperCase();

	if (normalized.length !== CODE_LENGTH) notFound();

	return <RoomClient code={normalized} />;
}
