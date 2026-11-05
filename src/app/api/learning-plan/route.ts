import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { position, company, gaps, strengths, user_cv, language } = body;

    if (!position || !user_cv) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const lang = language === 'es' ? 'Spanish' : 'English';
    const companyText = company ? `at ${company}` : 'in this field';

    const systemPrompt = `You are a career development coach. The user wants to build skills to qualify for a job they aspire to.
Respond ONLY with a valid JSON object — no markdown, no explanation, raw JSON only.`;

    const userMessage = `Create a personalized learning and development plan for this person to eventually qualify for the role they aspire to.

PERSON'S CURRENT PROFILE:
${user_cv}

ASPIRED POSITION: ${position} ${companyText}
CURRENT GAPS FOR THIS ROLE: ${gaps?.join(', ') || 'none identified'}
CURRENT STRENGTHS: ${strengths?.join(', ') || 'see profile'}

Respond in ${lang}. Return exactly this JSON structure:
{
  "timeline": "<realistic total timeline, e.g. '3-6 meses'>",
  "objective": "<1-2 sentences: what achieving this plan unlocks for the person>",
  "phases": [
    {
      "name": "<e.g. Fase 1>",
      "duration": "<e.g. 1-2 meses>",
      "goal": "<what this phase achieves>",
      "actions": ["<specific action 1>", "<specific action 2>", "<specific action 3>"]
    }
  ],
  "resources": [
    {
      "name": "<course/book/certification name>",
      "platform": "<Coursera/YouTube/Udemy/freeCodeCamp/etc>",
      "priority": "<alta|media|baja>"
    }
  ],
  "quick_wins": ["<thing they can do this week to start>", "<another quick win>", "<third quick win>"]
}

Make the plan specific, actionable and realistic given their current background. 2-3 phases. 3-5 resources. 3 quick wins.`;

    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.6, num_predict: 2048 },
      }),
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama error ${ollamaRes.status}`);
    }

    const ollamaData = await ollamaRes.json();
    const text: string = ollamaData?.message?.content ?? '';
    if (!text) throw new Error('Respuesta vacía de Ollama');

    let jsonText = text.trim();
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();
    else {
      const objMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objMatch) jsonText = objMatch[0];
    }

    const data = JSON.parse(jsonText);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Learning plan error:', err);
    const isOllamaDown = err instanceof TypeError && err.message.includes('fetch');
    const message = isOllamaDown
      ? 'No se pudo conectar con Ollama. ¿Está corriendo? Ejecuta: ollama serve'
      : err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
