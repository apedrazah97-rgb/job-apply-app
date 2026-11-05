import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, extractJSON } from '@/lib/llm';

const SYSTEM_PROMPT = `You are a professional career coach helping a user craft the perfect job application.
CRITICAL: Respond ONLY with a valid JSON object — no explanation, no markdown, no code fences.`;

export async function POST(req: NextRequest) {
  try {
    const { company, position, language, job_description, user_cv } = await req.json();

    if (!job_description || !position || !user_cv) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const isSpanish = language === 'es';
    const coverLetterLang = isSpanish
      ? 'Spanish (formal, warm, professional)'
      : 'English (confident, concise, professional)';
    const responseLang = isSpanish ? 'Spanish' : 'English';
    const companyText = company || 'the company';

    const text = await chatJSON([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analyze this job posting for the user and return a JSON application package.

IMPORTANT: Write ALL text fields (fit_summary, strengths, gaps, cv_tips, cover_letter, summary, why_company) in ${responseLang}. Only the cover letter uses ${coverLetterLang} style.

USER'S CV / PROFILE:
${user_cv}

Company: ${companyText}
Position: ${position}

JOB DESCRIPTION:
${job_description}

Return exactly this JSON (no other text):
{
  "fit_score": <integer 0-100>,
  "fit_summary": "<2-3 sentences in ${responseLang} evaluating fit for this specific role. DO NOT use the person's name — use 'tú' or 'you'. Be specific about why this role is or isn't a match.>",
  "strengths": ["<specific strength in ${responseLang} directly tied to a job requirement>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "gaps": ["<specific missing skill in ${responseLang} with detail, e.g. 'Sin experiencia en Kubernetes — el puesto requiere orquestación de contenedores'>", "<gap 2 if any — be concrete>"],
  "cv_tips": ["<tip in ${responseLang}: which experience/project to highlight and how>", "<tip 2>", "<tip 3>", "<tip 4>", "<tip 5>"],
  "cover_letter": "<full cover letter in ${coverLetterLang}, 3-4 paragraphs, mentioning ${companyText} and ${position} explicitly, no placeholders>",
  "autofill": {
    "name": "<person's name from CV>",
    "email": "<email from CV>",
    "phone": "<phone from CV>",
    "location": "<location from CV>",
    "portfolio": "<portfolio from CV or empty string>",
    "summary": "<2-3 sentence professional summary in ${responseLang} adapted specifically for ${position} at ${companyText}>",
    "why_company": "<3-4 sentences in ${responseLang} answering why this person specifically wants to work at ${companyText}>"
  }
}`,
      },
    ], 4096);

    const data = extractJSON(text);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Analyze error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
