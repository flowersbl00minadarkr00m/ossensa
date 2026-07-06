import type { LicenseClassification } from '../domain/types';

/**
 * Single source of truth for the open-source verification gate (FR-005).
 * Classification may only be driven by SPDX metadata or retrieved licence
 * text — never by search snippets or AI interpretation.
 */
export function classifyLicense(spdxId: string | undefined): LicenseClassification {
  if (!spdxId || spdxId === 'Unknown' || spdxId === 'NOASSERTION' || spdxId === 'Other') return 'unknown';
  const osiApproved = [
    'MIT', 'Apache-2.0', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0',
    'BSD-2-Clause', 'BSD-3-Clause', 'MPL-2.0', 'AGPL-3.0', 'Unlicense',
    'ISC', 'Artistic-2.0', 'EPL-2.0', 'CDDL-1.0', 'EUPL-1.2', 'CC0-1.0',
  ];
  if (osiApproved.includes(spdxId)) return 'osi-open-source';
  const sourceAvailable = ['BUSL-1.1', 'SSPL-1.0', 'Elastic-2.0'];
  if (sourceAvailable.includes(spdxId)) return 'source-available';
  if (spdxId.includes('NC') || spdxId.includes('ND')) return 'source-available';
  return 'unknown';
}

/** Normalize a raw license string to a best-effort SPDX identifier. */
export function normalizeLicense(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';

  const map: Record<string, string> = {
    'mit': 'MIT',
    'apache': 'Apache-2.0',
    'apache-2': 'Apache-2.0',
    'apache 2': 'Apache-2.0',
    'gpl': 'GPL-3.0',
    'gpl-3': 'GPL-3.0',
    'gplv3': 'GPL-3.0',
    'lgpl': 'LGPL-2.1',
    'bsd': 'BSD-3-Clause',
    'bsd-2': 'BSD-2-Clause',
    'bsd-3': 'BSD-3-Clause',
    'isc': 'ISC',
    'mpl': 'MPL-2.0',
    'mpl-2': 'MPL-2.0',
    'agpl': 'AGPL-3.0',
    'agpl-3': 'AGPL-3.0',
    'cc0': 'CC0-1.0',
    'unlicense': 'Unlicense',
    'noassertion': 'Unknown',
    'other': 'Other',
  };

  const lower = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const match = Object.entries(map).find(([k]) => lower.includes(k));
  return match ? match[1] : raw;
}
