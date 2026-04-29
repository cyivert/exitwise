import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes("localhost") ? "prefer" : "require",
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
