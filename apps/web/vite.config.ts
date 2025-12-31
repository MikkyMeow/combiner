import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import solid from "vite-plugin-solid";
import os from "node:os";

const getLanHosts = () => {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        hosts.add(entry.address);
      }
    }
  }
  return Array.from(hosts);
};

export default defineConfig({
  define: {
    "import.meta.env.VITE_DEBUG_OVERLAY": JSON.stringify(process.argv.includes("--debug"))
  },
  plugins: [solid(), mkcert({ hosts: getLanHosts() })],
  server: {
    host: true,
    port: 5173,
    https: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
