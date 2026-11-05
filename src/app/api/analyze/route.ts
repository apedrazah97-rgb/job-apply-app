import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const SYSTEM_PROMPT = `You are a professional career coach helping a user craft the perfect job application.
CRITICAL: Respond ONLY with a valid JSON object. No explanation, no markdown, no code fences — raw JSON only.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, position, language, job_description, user_cv } = body;

    if (!job_description || !position || !user_cv) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const coverLetterLang = language === 'es'
      ? 'Spanish (formal, warm, professional)'
      : 'English (confident, concise, professional)';

    const companyText = company || 'the company';

    const userMessage = `Analyze this job posting for the user and return a JSON application package.

USER'S CV / PROFILE:
${user_cv}

Company: ${companyText}
Position: ${position}
Cover letter language: ${coverLetterLang}

JOB DESCRIPTION:
${job_description}

Return exactly this JSON (no other text):
{
  "fit_score": <integer 0-100>,
  "fit_summary": "<2-3 sentences evaluating this person's fit for this specific role>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>", "<specific strength 4>"],
  "gaps": ["<gap if any>"],
  "cv_tips": ["<tip 1: which experience/project to highlight and how>", "<tip 2>", "<tip 3>", "<tip 4>", "<tip 5>"],
  "cover_letter": "<full cover letter in ${coverLetterLang}, 3-4 paragraphs, mentioning ${companyText} and ${position} explicitly, no placeholders>",
  "autofill": {
    "name": "<person's name from CV>",
    "email": "<email from CV>",
    "phone": "<phone from CV>",
    "location": "<location from CV>",
    "portfolio": "<portfolio from CV or empty string>",
    "summary": "<2-3 sentence professional summary adapted specifically for ${position} at ${companyText}>",
    "why_company": "<3-4 sentences answering why this person specifically wants to work at ${companyText}>"
  }
}`;

    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.7, num_predict: 4096 },
      }),
    });

    if (!ollamaRes.ok) {
      const err = await ollamaRes.text();
      throw new Error(`Ollama error ${ollamaRes.status}: ${err}`);
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
    console.error('API error:', err);
    const isOllamaDown = err instanceof TypeError && err.message.includes('fetch');
    const message = isOllamaDown
      ? 'No se pudo conectar con Ollama. ¿Está corriendo? Ejecuta: ollama serve'
      : err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
