import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pri builde sa appka servíruje z podpriečinka /Watt/ (GitHub Pages),
// počas `vite dev` aj testov ostáva base na koreni.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Watt/" : "/",
  plugins: [react()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.js"],
      exclude: ["src/lib/**/*.test.js", "src/lib/sampleGpx.js"],
    },
  },
}));
