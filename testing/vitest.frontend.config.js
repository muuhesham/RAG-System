import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["testing/frontend/**/*.test.{js,jsx}"],
    setupFiles: ["testing/frontend/setup.js"],
  },
});
