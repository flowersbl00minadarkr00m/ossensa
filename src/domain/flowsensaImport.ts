import type { ErrorObject, ValidateFunction } from 'ajv';
import { validateFlowsensaImport as generatedValidateFlowsensaImport } from '../generated/validators';
import type { SearchQuery, Constraint } from './types';

interface FlowsensaImport {
  toolingRequirement: {
    description: string;
    constraints?: Array<{ text: string; category: Constraint['category'] }>;
  };
}

const validate = generatedValidateFlowsensaImport as ValidateFunction<FlowsensaImport>;

function validationMessage(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `data${error.instancePath || ''} ${error.message ?? 'is invalid'}`)
    .join(', ');
}

export function parseFlowsensaToolingRequirement(json: unknown): SearchQuery {
  const valid = validate(json);
  if (!valid) {
    throw new Error(
      `Invalid Flowsensa JSON: ${validationMessage(validate.errors)}`,
    );
  }

  const data = json as FlowsensaImport;

  const req = data.toolingRequirement;

  const constraints: Constraint[] = (req.constraints ?? []).map((c, i) => ({
    id: `fi-${Date.now()}-${i}`,
    text: c.text,
    category: c.category,
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
