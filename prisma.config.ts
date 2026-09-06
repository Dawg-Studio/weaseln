import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts",
    },
    datasource: {
        // All CLI work (migrate / db push / db seed) uses the direct,
        // non-pooled connection. Runtime uses DATABASE_URL via the driver
        // adapter in src/db.ts (v7 has no directUrl field).
        url: env("DIRECT_URL"),
        shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    },
});