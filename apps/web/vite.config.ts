import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.BASE_PATH ?? "./",
  plugins: [tailwindcss()],
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 4096 },
});
