import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // This is a GitHub Pages project site, so assets must resolve from the
  // repository path instead of the domain root.
  base: '/friday-n8n-self-creation/',
})