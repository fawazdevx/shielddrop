import { createRequire } from "node:module";
import { dirname } from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

// TokenOps's `/fhe` entry imports `RelayerWeb` / `SepoliaConfig` from the bare
// `@zama-fhe/sdk` root, a layout that only exists in 3.0.x. Resolve through
// Node so this works whether npm installs the workspace dependency under
// `frontend/node_modules` locally or hoists it to root `node_modules` on Vercel.
const require = createRequire(import.meta.url);
const zamaSdk = dirname(require.resolve("@zama-fhe/sdk/package.json"));

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
