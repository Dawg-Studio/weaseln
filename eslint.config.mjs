import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
    ...nextVitals,
    globalIgnores(["public/**", ".next/**", "node_modules/**"]),
    {
        rules: {
            "no-unused-vars": "error",
        },
    },
]);