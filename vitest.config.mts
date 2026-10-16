import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };
const exclude = ["node_modules/**", ".next/**", "e2e/**"];

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["**/*.test.ts"], exclude },
      },
      {
        extends: true,
        test: { name: "components", environment: "jsdom", include: ["**/*.test.tsx"], exclude },
      },
    ],
  },
});
