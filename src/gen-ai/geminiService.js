const GEMINI_MODEL = 'gemini-2.5-flash-image'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export const generateImage = async (prompt) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set')

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gemini API error ${response.status}`)
  }

  const data = await response.json()
  const inlineData = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
  if (!inlineData) throw new Error('No image returned from Gemini')

  return `data:${inlineData.mimeType};base64,${inlineData.data}`
}
