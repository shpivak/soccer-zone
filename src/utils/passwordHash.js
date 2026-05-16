/**
 * SHA-256 password hashing — browser-native, no extra dependencies.
 * Used in Soccer Lite to hash league admin passwords before comparing or storing.
 *
 * We never store or transmit the plaintext password — only its hex SHA-256 digest.
 */
export const hashPassword = async (plaintext) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
