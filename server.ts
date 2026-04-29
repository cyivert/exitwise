// Railway/Bun entry point. dynamic port + security.
const port = process.env.PORT || 8080;

Bun.serve({
  port: port,
  fetch(req) {
    const url = new URL(req.url);
    
    // security headers.
    const headers = new Headers({
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; object-src 'none';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });

    // api routes here.
    if (url.pathname.startsWith("/api")) {
      return new Response(JSON.stringify({ status: "ok", message: "ExitWise API active" }), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    return new Response("ExitWise Backend Active", { headers });
  },
});

console.log(`Server running on port ${port}`);
