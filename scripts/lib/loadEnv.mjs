import fs from 'node:fs'
import path from 'node:path'

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const projectRoot = path.resolve(import.meta.dirname, '..', '..')

parseEnvFile(path.join(projectRoot, '.env'))
parseEnvFile(path.join(projectRoot, '.env.local'))
