import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 5173,
    proxy: (() => {
      const createProxyConfig = (target: string) => ({
        target,
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/proxy/, "/api"),
        secure: false,
        headers: {
          Connection: "keep-alive",
        },
        configure: (proxy: any) => {
          proxy.on("error", (err: any, _req: any, res: any) => {
            // Gracefully handle Cloud Run idle socket disconnects
            if (res && !res.headersSent && typeof res.writeHead === "function") {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Proxy connection reset", message: err?.message }));
            }
          });
        },
      });

      return {
        "/proxy/products": createProxyConfig("https://product-service-949402843265.asia-southeast1.run.app"),
        "/proxy/billing": createProxyConfig("https://billing-service-949402843265.asia-southeast1.run.app"),
        "/proxy/reports": createProxyConfig("https://billing-service-949402843265.asia-southeast1.run.app"),
        "/proxy/vendors": createProxyConfig("https://vendor-service-949402843265.asia-southeast1.run.app"),
        "/proxy/customers": createProxyConfig("https://vendor-service-949402843265.asia-southeast1.run.app"),
        "/proxy/broker": createProxyConfig("https://vendor-service-949402843265.asia-southeast1.run.app"),
        "/proxy/chit": createProxyConfig("https://vendor-service-949402843265.asia-southeast1.run.app"),
        "/proxy/staff": createProxyConfig("https://staff-service-949402843265.asia-southeast1.run.app"),
      };
    })(),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
