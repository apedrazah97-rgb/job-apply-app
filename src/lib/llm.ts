/**
 * Unified LLM helper — uses Groq when GROQ_API_KEY is set, Ollama otherwise.
 * Both providers return raw JSON text (JSON mode enforced on both).
 */

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatJSON(messages: Message[], maxTokens = 4096): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    return groqChat(messages, maxTokens);
  }
  return ollamaChat(messages, maxTokens);
}

// ── Groq (OpenAI-compatible, free tier) ──────────────────────────────────────

async function groqChat(messages: Message[], maxTokens: number): Promise<string> {
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' }, // enforces JSON output
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Ollama (local) ────────────────────────────────────────────────────────────

async function ollamaChat(messages: Message[], maxTokens: number): Promise<string> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: 0.7, num_predict: maxTokens },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const isDown = err.includes('ECONNREFUSED') || res.status === 0;
    throw new Error(
      isDown
        ? 'No se pudo conectar con Ollama. ¿Está corriendo? Ejecuta: ollama serve'
        : `Ollama error ${res.status}: ${err}`
    );
  }

  const data = await res.json();
  return data?.message?.content ?? '';
}

// ── Shared JSON extractor ─────────────────────────────────────────────────────

export function extractJSON(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  else {
    const obj = t.match(/\{[\s\S]*\}/);
    if (obj) t = obj[0];
  }
  return JSON.parse(t);
}

// ── Provider label (for UI) ───────────────────────────────────────────────────

export function providerLabel(): string {
  return process.env.GROQ_API_KEY ? 'Groq' : 'Ollama';
}
