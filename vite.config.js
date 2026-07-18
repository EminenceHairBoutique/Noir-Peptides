import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Raise the warning threshold — vendor-three (~913kB raw / 245kB gzip) is
    // intentionally large but is ONLY loaded via the lazy VialScene import
    // (admin Label Studio 3D view); it never ships in the initial bundle.
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // three.js + react-three-fiber — heavy 3D stack, loaded ONLY via the
          // lazy VialScene import (never in the initial bundle).
          if (id.includes("node_modules/three") || id.includes("node_modules/@react-three")) {
            return "vendor-three";
          }
          // pdf-lib — print-PDF export, loaded ONLY via the lazy pdfExport
          // import (Label Studio "PDF" button); never in the initial bundle.
          if (id.includes("node_modules/pdf-lib") || id.includes("node_modules/@pdf-lib")) {
            return "vendor-pdf";
          }
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
