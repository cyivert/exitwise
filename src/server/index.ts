import { join } from "path";
import { PORT, USE_DEMO_API } from "./config";
import { handleApiRequest } from "./routes";
import { buildSecurityHeaders } from "./utils/response";

// Entry point for the Bun HTTP server. Routes /api/* through the modular
// router and serves the built SPA from ./dist for everything else.

const DIST_PATH = join(process.cwd(), "dist");

if (USE_DEMO_API) {
  console.warn(
    "Using local demo API because DATABASE_URL points to Railway private host.",
  );
}

export function startServer() {
  Bun.serve({
    port: PORT,
    async fetch(req: Request) {
      const url = new URL(req.url);
      const headers = buildSecurityHeaders();

      // API routing.
      if (url.pathname.startsWith("/api")) {
        return handleApiRequest(req, url);
      }

      // SPA static assets — fall back to index.html for client-side routing.
      let filePath = join(DIST_PATH, url.pathname);
      if (url.pathname === "/") filePath = join(DIST_PATH, "index.html");

      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, { headers });
      }

      const index = Bun.file(join(DIST_PATH, "index.html"));
      if (await index.exists()) {
        return new Response(index, { headers });
      }

      return new Response("ExitWise Backend Active (Build missing?)", {
        status: 404,
        headers,
      });
    },
  });

  console.log(`Server running on port ${PORT}`);
}
