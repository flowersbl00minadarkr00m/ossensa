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
