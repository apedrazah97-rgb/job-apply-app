import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, extractJSON } from '@/lib/llm';

export async function POST(req: NextRequest) {
  try {
    const { position, company, gaps, strengths, user_cv, language } = await req.json();

    if (!position || !user_cv) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const lang = language === 'es' ? 'Spanish' : 'English';
    const companyText = company ? `at ${company}` : 'in this field';

    const text = await chatJSON([
      {
        role: 'system',
        content: `You are a career development coach. Respond ONLY with a valid JSON object — no markdown, no explanation, raw JSON only.`,
      },
      {
        role: 'user',
        content: `Create a personalized learning plan for this person to qualify for the role they aspire to.

PERSON'S CURRENT PROFILE:
${user_cv}

ASPIRED POSITION: ${position} ${companyText}
CURRENT GAPS: ${gaps?.join(', ') || 'none identified'}
CURRENT STRENGTHS: ${strengths?.join(', ') || 'see profile'}

Respond in ${lang}. Return exactly this JSON:
{
  "timeline": "<realistic total timeline, e.g. '3-6 meses'>",
  "objective": "<1-2 sentences: what achieving this plan unlocks>",
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
  "quick_wins": ["<thing to do this week>", "<another quick win>", "<third quick win>"]
}

2-3 phases. 3-5 resources. 3 quick wins. Be specific and actionable.`,
      },
    ], 2048);

    const data = extractJSON(text);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Learning plan error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
