import type { Candidate, Constraint, CandidateComparison } from '../domain/types';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

export async function testConnection(config: OpenRouterConfig): Promise<boolean> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': window.location.origin,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Augment existing comparisons with AI-generated summaries. Key never logged or stored. */
export async function augmentComparisons(
  config: OpenRouterConfig,
  query: string,
  constraints: Constraint[],
  candidates: Candidate[],
  comparisons: CandidateComparison[],
): Promise<CandidateComparison[]> {
  const context = {
    query,
    constraints: constraints.map((c) => ({ text: c.text, category: c.category })),
    candidates: candidates.slice(0, 5).map((c) => ({
      name: c.name,
      description: c.description,
      license: c.license,
      language: c.language,
      deploymentModes: c.deploymentModes,
    })),
  };

  const prompt = `You are an expert open-source software evaluator.
Given the following evaluation context, provide a concise layman-friendly summary for each candidate.
Return a JSON array with objects: { "candidateId": string, "laymanSummary": string }

Context:
${JSON.stringify(context, null, 2)}

Candidate IDs: ${candidates.map((c) => c.id).join(', ')}

Rules:
- Each summary must be 2–3 sentences max
- Use plain language suitable for a non-technical manager
- Do not invent facts; base summaries only on provided context
- Include relevant strengths and weaknesses`;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return comparisons;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return comparisons;

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return comparisons;

    const augments: Array<{ candidateId: string; laymanSummary: string }> = JSON.parse(
      jsonMatch[0],
    );

    return comparisons.map((comp) => {
      const augment = augments.find((a) => a.candidateId === comp.candidateId);
      if (!augment) return comp;
      return {
        ...comp,
        laymanSummary: augment.laymanSummary,
        aiAugmented: true,
      };
    });
  } catch {
    return comparisons;
  }
}
