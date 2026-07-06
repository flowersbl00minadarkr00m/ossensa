import type { Candidate, CandidateComparison, Constraint } from './types';
import { candidateMeetsConstraint, scoreCandidate } from './search';

function deriveVerdict(
  score: number,
  hasPreferredConstraints: boolean,
): CandidateComparison['fitVerdict'] {
  if (score === -Infinity) return 'poor';
  const norm = score / (hasPreferredConstraints ? 3 : 2);
  if (norm >= 0.8) return 'strong';
  if (norm >= 0.5) return 'partial';
  if (norm >= 0.2) return 'uncertain';
  return 'poor';
}

function setupEffortFromModes(
  modes: Candidate['deploymentModes'],
): CandidateComparison['setupEffort'] {
  if (modes.includes('hosted') && modes.includes('self-hosted')) {
    return { level: 'medium', explanation: 'Choose a hosted service for faster setup or self-host it for greater control.' };
  }
  if (modes.includes('hosted')) {
    return { level: 'low', explanation: 'Hosted service — sign up and go, no infrastructure needed.' };
  }
  if (modes.includes('hybrid')) {
    return { level: 'medium', explanation: 'Hybrid deployment — managed control plane, self-hosted workers.' };
  }
  return { level: 'high', explanation: 'Self-hosted only — you provision, configure, and maintain the infrastructure.' };
}

function ongoingFromModes(modes: Candidate['deploymentModes']): string {
  if (modes.includes('hosted') && modes.includes('self-hosted')) {
    return 'The hosted option shifts operations to the vendor; self-hosting leaves upgrades, backups, and monitoring with you.';
  }
  if (modes.includes('hosted')) return 'Vendor handles upgrades, backups, and scaling.';
  if (modes.includes('hybrid')) return 'Vendor manages core service; you own data and worker nodes.';
  return 'You own upgrades, patches, backups, monitoring, and capacity planning.';
}

function oldestEvidence(candidate: Candidate): string {
  if (!candidate.evidence.length) return new Date().toISOString();
  return candidate.evidence
    .map((e) => e.retrievedAt)
    .sort()[0] ?? new Date().toISOString();
}

/**
 * Build a plain-language comparison for a candidate based on its metadata
 * and how it maps to the provided constraints.
 */
export function buildComparison(
  candidate: Candidate,
  constraints: Constraint[],
): CandidateComparison {
  const required = constraints.filter((c) => c.category === 'required');
  const preferred = constraints.filter((c) => c.category === 'preferred');

  const metRequired = required.filter((c) => candidateMeetsConstraint(candidate, c));
  const missedRequired = required.filter((c) => !candidateMeetsConstraint(candidate, c));
  const metPreferred = preferred.filter((c) => candidateMeetsConstraint(candidate, c));
  const missedPreferred = preferred.filter((c) => !candidateMeetsConstraint(candidate, c));

  const score = scoreCandidate(candidate, constraints);
  const verdict = deriveVerdict(score, preferred.length > 0);

  const advantages: string[] = [
    metRequired.length > 0
      ? `Meets ${metRequired.length} of ${required.length} required constraints`
      : null,
    metPreferred.length > 0
      ? `Meets ${metPreferred.length} preferred constraint${metPreferred.length > 1 ? 's' : ''}`
      : null,
    candidate.stars > 5000
      ? `${candidate.stars.toLocaleString()} GitHub stars indicate substantial public interest, not project health`
      : null,
    candidate.licenseClassification === 'osi-open-source'
      ? `${candidate.license} is classified as an OSI open-source licence`
      : null,
  ].filter(Boolean) as string[];

  const disadvantages: string[] = [
    missedRequired.length > 0
      ? `Missing ${missedRequired.length} required constraint${missedRequired.length > 1 ? 's' : ''}: ${missedRequired.map((c) => c.text).join(', ')}`
      : null,
    missedPreferred.length > 0
      ? `Misses ${missedPreferred.length} preferred constraint${missedPreferred.length > 1 ? 's' : ''}`
      : null,
    candidate.deploymentModes.every((m) => m === 'self-hosted')
      ? 'Self-hosted only — operational overhead'
      : null,
  ].filter(Boolean) as string[];

  const unknowns: string[] = [];
  if (!candidate.evidence.some((e) => e.source === 'OSV')) {
    unknowns.push('No package identity was mapped to OSV, so vulnerability status is unknown');
  }
  if (!candidate.projectUrl) {
    unknowns.push('Official documentation site not confirmed');
  }
  if (candidate.id.startsWith('gh-')) {
    unknowns.push('Deployment mode is inferred from the public repository and needs verification');
  }

  return {
    candidateId: candidate.id,
    fitVerdict: verdict,
    laymanSummary: `${candidate.name} is a ${candidate.language} project (${candidate.license}) that ${verdict === 'strong' ? 'closely matches' : verdict === 'partial' ? 'partially matches' : verdict === 'uncertain' ? 'loosely matches' : 'does not match'} your requirements. ${candidate.description}`,
    setupEffort: setupEffortFromModes(candidate.deploymentModes),
    ongoingResponsibility: ongoingFromModes(candidate.deploymentModes),
    evidenceFreshness: oldestEvidence(candidate),
    unknowns,
    advantages: advantages.length > 0 ? advantages : ['No notable advantages identified'],
    disadvantages: disadvantages.length > 0 ? disadvantages : ['No notable disadvantages identified'],
    aiAugmented: false,
  };
}
