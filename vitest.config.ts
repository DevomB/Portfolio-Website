import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/* Unit tests for the pure modules: the poker engine and its matrix, the river
   game, the Mirage's worlds and tapes, the 404 suggester, the Counterexample
   readers. Tests sit next to what they test (*.test.ts) so a module and its
   proof are one unit; nothing here touches React or the DOM. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
