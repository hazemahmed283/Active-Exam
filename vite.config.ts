import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps image paths ("images/q4-1.png") working from any folder or sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
});
