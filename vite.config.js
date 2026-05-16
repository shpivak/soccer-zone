import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const repoName = env.GITHUB_REPOSITORY?.split('/')[1]
  // VITE_BASE_PATH lets the lite deploy workflow override the base path explicitly
  const base = env.VITE_BASE_PATH || (env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : '/')

  return {
    plugins: [react()],
    base,
  }
})
