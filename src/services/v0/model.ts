const V0_MODEL_API = 'https://api.v0.dev/v1/chat/completions'

export async function complete(prompt: string, model = 'v0-1.5-md'): Promise<string> {
  const res = await fetch(V0_MODEL_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.V0_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`v0 model failed: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}
