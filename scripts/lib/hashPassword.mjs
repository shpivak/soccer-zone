/**
 * SHA-256 password hashing — Node.js native, no extra dependencies.
 * Produces the same hex digest as the browser-side passwordHash.js.
 */
import { createHash } from 'node:crypto'

export const hashPassword = (plaintext) =>
  createHash('sha256').update(plaintext).digest('hex')
