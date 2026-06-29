import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  cacheDir: ".vite-cache",
  server: {
    host: "127.0.0.1",
    port: 5177
  },
  preview: {
    host: "127.0.0.1",
    port: 4177
  }
});
