import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Force IPv4 loopback explicitly: this machine's default "localhost" resolution was landing on
  // ::1 only, which Chrome couldn't always reach. `host: true` (0.0.0.0) would fix that too but
  // exposes the dev server to the whole LAN — 127.0.0.1 stays loopback-only.
  server: { port: 5173, host: "127.0.0.1" },
})
