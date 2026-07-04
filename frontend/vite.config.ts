import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

// TokenOps's `/fhe` entry imports `RelayerWeb` / `SepoliaConfig` from the bare
// `@zama-fhe/sdk` root, a layout that only exists in 3.0.x. Keep this alias on
// the root install because Vercel runs the build from the workspace root.
const zamaSdk = fileURLToPath(new URL("../node_modules/@zama-fhe/sdk", import.meta.url));

// The Zama relayer (`@zama-fhe/sdk/web`, used by TokenOps's
// `createSepoliaEncryptorWeb`) ships a Web Worker + WASM and relies on
// top-level await. `wasm` + `topLevelAwait` let Vite bundle it, and we keep it
// out of the dep pre-bundler so the worker/WASM graph is resolved natively.
export default defineConfig({
  plugins: [wasm(), topLevelAwait(), react()],
  cacheDir: ".vite-cache",
  resolve: {
    alias: {
      "@zama-fhe/sdk": zamaSdk
    }
  },
  define: {
    global: "globalThis"
  },
  optimizeDeps: {
    exclude: ["@zama-fhe/sdk"]
  },
  build: {
    target: "esnext"
  },
  worker: {
    format: "es"
  },
  server: {
    host: "0.0.0.0",
    port: 5177,
    allowedHosts: true
  },
  preview: {
    host: "0.0.0.0",
    port: 4177
  }
});
