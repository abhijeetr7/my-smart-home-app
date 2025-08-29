import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // The 'base' option is crucial for GitHub Pages. It tells Vite to
  // use relative paths for assets, which is necessary when the app
  // is hosted in a subdirectory (your repo name).
  base: '/my-smart-home-app/',

  plugins: [react()],
});
