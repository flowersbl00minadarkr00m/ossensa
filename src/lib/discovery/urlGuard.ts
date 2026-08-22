/**
 * Pure URL/IP safety validator shared by the client and the api/fetch
 * serverless function (NFR-001). No network access — fully unit-testable.
 */
import ipaddr from 'ipaddr.js';

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.lan', '.home', '.corp', '.intranet'];
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

/** True when an IPv4 address is loopback, private, link-local, CGNAT, or metadata. */
export function isPrivateIPv4(ip: string): boolean {
  if (!ipaddr.IPv4.isValid(ip)) return true;
  return ipaddr.IPv4.parse(ip).range() !== 'unicast';
}

/** True when an IPv6 address is loopback, link-local, unique-local, or v4-mapped private. */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, '');
  if (!ipaddr.IPv6.isValid(normalized)) return true;
  return ipaddr.process(normalized).range() !== 'unicast';
}

/** True for any resolved address that must not be fetched. */
export function isPrivateAddress(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return true;
  return ipaddr.process(ip).range() !== 'unicast';
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
