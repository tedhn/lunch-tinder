/**
 * Remotion render defaults. Only applies to the CLI — see `bun run video:*`.
 *
 * The video lives in `video/` and shares this project's package.json rather than
 * nesting a second one. The directory is *not* called `remotion/`: this
 * tsconfig sets `baseUrl: "."`, so a folder of that name shadows the package
 * itself and every `import {…} from "remotion"` resolves to the video's own
 * entry point instead.
 *
 * It imports nothing from `src`. The palette and card data are restated in
 * `video/theme.ts` and `video/data.ts`, so the video bundle never pulls in
 * Prisma or the app's CSS pipeline.
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
// The scenes are flat colour and large type; CRF 18 is visually lossless on that
// and keeps a 25-second vertical clip small enough to send to somebody.
Config.setCrf(18);
Config.setCodec("h264");
Config.setConcurrency(4);
