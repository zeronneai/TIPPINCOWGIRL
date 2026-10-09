import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy 3D stack out of the landing's initial chunk — it is
        // lazy-loaded by the configurator (React.lazy in Configurator.jsx).
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Only React itself ships with the landing; every other package
            // (three, @react-three/*, and their helper deps like
            // react-reconciler/zustand) is only reachable from the lazy 3D
            // import, so it belongs in the deferred chunk.
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor";
            // Analytics runs on every public page, so it ships with React.
            if (/node_modules\/@vercel\/analytics\//.test(id)) return "vendor";
            // The staff portal's client and its helpers, only reachable from
            // the lazy /admin chunk, so public visitors never download them.
            if (/node_modules\/(@supabase|tslib|iceberg-js)\//.test(id)) return "supabase";
            return "three";
          }
          return undefined;
        },
      },
    },
  },
});
