import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { SearchQuery, Constraint } from './types';

const ajv = new Ajv();
addFormats(ajv);

const flowsensaSchema = {
  type: 'object',
  properties: {
    toolingRequirement: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        constraints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              category: {
                type: 'string',
                enum: ['required', 'preferred', 'not-acceptable'],
              },
            },
            required: ['text', 'category'],
          },
        },
      },
      required: ['description'],
    },
  },
  required: ['toolingRequirement'],
};

const validate = ajv.compile(flowsensaSchema);

export function parseFlowsensaToolingRequirement(json: unknown): SearchQuery {
  const valid = validate(json);
  if (!valid) {
    throw new Error(
      `Invalid Flowsensa JSON: ${ajv.errorsText(validate.errors)}`,
    );
  }

  const data = json as {
    toolingRequirement: {
      description: string;
      constraints?: Array<{ text: string; category: string }>;
    };
  };

  const req = data.toolingRequirement;

  const constraints: Constraint[] = (req.constraints ?? []).map((c, i) => ({
    id: `fi-${Date.now()}-${i}`,
    text: c.text,
    category: c.category as Constraint['category'],
    createdAt: new Date().toISOString(),
  }));

  return {
    id: `q-${Date.now()}`,
    naturalLanguage: req.description,
    constraints,
    submittedAt: new Date().toISOString(),
    source: 'flowsensa-import',
  };
}
