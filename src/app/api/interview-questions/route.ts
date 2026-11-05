import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, extractJSON } from '@/lib/llm';

export async function POST(req: NextRequest) {
  try {
    const { position, company, language } = await req.json();

    if (!position) {
      return NextResponse.json({ error: 'Falta el puesto' }, { status: 400 });
    }

    const companyText = company ? `en ${company}` : 'en la empresa';
    const lang = language === 'en' ? 'English' : 'Spanish';

    const text = await chatJSON([
      {
        role: 'system',
        content: `You are an expert recruiter and interview coach. Respond ONLY with a valid JSON object — no markdown, no explanation.`,
      },
      {
        role: 'user',
        content: `Generate 8 likely interview questions for the position of ${position} ${companyText}.

Mix behavioral, technical, and situational questions. Make them specific to this role.

Respond in ${lang}. Return exactly this JSON:
{
  "questions": [
    "<pregunta 1>",
    "<pregunta 2>",
    "<pregunta 3>",
    "<pregunta 4>",
    "<pregunta 5>",
    "<pregunta 6>",
    "<pregunta 7>",
    "<pregunta 8>"
  ]
}`,
      },
    ], 1024);

    const data = extractJSON(text) as { questions: string[] };
    return NextResponse.json(data);
  } catch (err) {
    console.error('Interview questions error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
