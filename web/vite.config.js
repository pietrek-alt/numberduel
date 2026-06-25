import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works on GitHub Pages project sites
// (served from https://<user>.github.io/<repo>/) without hardcoding the repo name.
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
})
