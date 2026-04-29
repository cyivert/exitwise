import { join } from "path";

// /caveman: Railway/Bun entry point. dynamic port + security.
const port = process.env.PORT || 8080;
const DIST_PATH = join(process.cwd(), "dist");

Bun.serve({
  port: port,
  async fetch(req) {
    const url = new URL(req.url);
    
    // /caveman: security headers. allow fonts/styles.
    const headers = new Headers({
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; object-src 'none';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });

    // /caveman: api routes.
    if (url.pathname.startsWith("/api")) {
      return new Response(JSON.stringify({ status: "ok", message: "ExitWise API active" }), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // /caveman: serve static files from dist.
    let filePath = join(DIST_PATH, url.pathname);
    if (url.pathname === "/") filePath = join(DIST_PATH, "index.html");

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, { headers });
    }

    // /caveman: fallback to index.html for spa routing.
    const index = Bun.file(join(DIST_PATH, "index.html"));
    if (await index.exists()) {
      return new Response(index, { headers });
    }

    return new Response("ExitWise Backend Active (Build missing?)", { status: 404, headers });
  },
});

console.log(`Server running on port ${port}`);
