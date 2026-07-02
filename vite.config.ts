// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import type { Plugin } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Adds immutable Cache-Control headers for content-hashed assets served by
// `vite preview`. Without this, every page load re-validates every JS/CSS/image
// file against the server (cache-control: no-cache) which wastes round trips.
function staticAssetCacheHeaders(): Plugin {
  return {
    name: "static-asset-cache-headers",
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (url.startsWith("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [staticAssetCacheHeaders()],
    preview: {
      allowedHosts: true,
    },
    // Force esbuild to pre-bundle antd so its internal circular deps are
    // resolved at pre-bundle time rather than at runtime. Without this,
    // Rollup places some `let` declarations after their first use inside the
    // vendor-antd chunk, which Safari's strict TDZ enforcement turns into
    // "Cannot access '...' before initialization" crashes.
    optimizeDeps: {
      include: ["antd", "@ant-design/icons", "@ant-design/cssinjs"],
    },
    build: {
      rollupOptions: {
        output: {
          generatedCode: { constBindings: false },
          manualChunks: (id) => {
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
              return "vendor-react";
            }
            if (id.includes("node_modules/@tanstack/react-query")) {
              return "vendor-query";
            }
            if (id.includes("node_modules/appwrite")) {
              return "vendor-appwrite";
            }
            if (id.includes("node_modules/@react-google-maps")) {
              return "vendor-maps";
            }
          },
        },
      },
    },
  },
});
