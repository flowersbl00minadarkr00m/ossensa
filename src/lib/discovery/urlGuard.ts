/**
 * Pure URL/IP safety validator shared by the client and the api/fetch
 * serverless function (NFR-001). No network access — fully unit-testable.
 */

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.lan', '.home', '.corp', '.intranet'];
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

/** True when an IPv4 address is loopback, private, link-local, CGNAT, or metadata. */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed — treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;            // this-net, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true;            // CGNAT 100.64/10
  if (a === 169 && b === 254) return true;                      // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;             // private 172.16/12
  if (a === 192 && b === 168) return true;                      // private 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true;         // benchmarking
  if (a >= 224) return true;                                    // multicast + reserved
  return false;
}

/** True when an IPv6 address is loopback, link-local, unique-local, or v4-mapped private. */
export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  return false;
}

/** True for any resolved address that must not be fetched. */
export function isPrivateAddress(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

function looksLikeIpLiteral(hostname: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (hostname.startsWith('[') || hostname.includes(':')) return true; // IPv6 literal
  if (/^\d+$/.test(hostname)) return true; // decimal IP form
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true; // hex IP form
  return false;
}

/**
 * Validate a URL before any fetch. Rejects non-http(s) schemes, credentials,
 * IP literals, and internal-looking hostnames. DNS-level checks happen in
 * api/fetch after resolution using isPrivateAddress.
 */
export function validatePublicUrl(raw: string): GuardResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'Not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `Scheme ${url.protocol} is not allowed` };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'URLs with embedded credentials are not allowed' };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) {
    return { ok: false, reason: 'Host is blocked' };
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, reason: 'Internal-network hostnames are blocked' };
  }
  if (looksLikeIpLiteral(hostname)) {
    // IP literals are rejected outright; public sites have names.
    return { ok: false, reason: 'IP-literal URLs are not allowed' };
  }
  if (!hostname.includes('.')) {
    return { ok: false, reason: 'Single-label hostnames are blocked' };
  }

  return { ok: true };
}
