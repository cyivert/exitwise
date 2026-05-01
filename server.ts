// Bun entry point. The server itself lives in src/server/ — this file just
// boots the app so that bun run server.ts continues to work.
import { startServer } from "./src/server";

startServer();
