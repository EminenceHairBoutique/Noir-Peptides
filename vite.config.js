import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Raise the warning threshold slightly — individual route chunks are fine,
    // and the main vendor bundles will be well under 500kB after splitting.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime — tiny, always needed, cache forever.
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // React Router — separate so the router can be cached independently.
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          // Framer Motion — large animation library loaded early but worth isolating.
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Stripe — payment library, isolated for security/cache reasons.
          if (id.includes("node_modules/@stripe") || id.includes("node_modules/stripe")) {
            return "vendor-stripe";
          }
          // Supabase client — backend SDK.
          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase";
          }
          // Lucide icons — large icon set, useful to split out.
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false, // fall back to next port if 5173 is taken
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
