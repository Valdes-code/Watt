import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.js"],
      exclude: ["src/lib/**/*.test.js", "src/lib/sampleGpx.js"],
    },
  },
});
