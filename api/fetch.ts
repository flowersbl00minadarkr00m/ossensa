/// <reference types="node" />

/**
 * SSRF-guarded bounded public page fetch (design TD-006, NFR-001/NFR-002).
 *
 * Returns extracted metadata (title, description, licence text) — never a raw
 * page passthrough. Text-only, 512 KB cap, 8 s timeout, ≤3 re-validated
 * redirects, robots.txt honored, no cookies or auth forwarded.
 */
import { lookup } from 'dns/promises';

// ── SSRF guard ───────────────────────────────────────────────────────────────
// Mirrored from src/lib/discovery/urlGuard.ts, which is the unit-tested source
// of truth. Inlined here because Vercel transpiles this function per-file and
// does not bundle cross-directory imports. Keep the two copies in sync.

interface GuardResult {
  ok: boolean;
  reason?: string;
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.lan', '.home', '.corp', '.intranet'];
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

function looksLikeIpLiteral(hostname: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (hostname.startsWith('[') || hostname.includes(':')) return true;
  if (/^\d+$/.test(hostname)) return true;
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  return false;
}

function validatePublicUrl(raw: string): GuardResult {
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
  if (BLOCKED_HOSTS.has(hostname)) return { ok: false, reason: 'Host is blocked' };
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, reason: 'Internal-network hostnames are blocked' };
  }
  if (looksLikeIpLiteral(hostname)) return { ok: false, reason: 'IP-literal URLs are not allowed' };
  if (!hostname.includes('.')) return { ok: false, reason: 'Single-label hostnames are blocked' };
  return { ok: true };
}

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;
const ROBOTS_TIMEOUT_MS = 3_000;
const USER_AGENT = 'OSSensaBot/1.0 (+https://ossensa.vercel.app; open-source discovery evidence fetch)';
const TEXT_CONTENT_TYPE = /^(text\/|application\/(json|xml|xhtml\+xml|rss\+xml))/i;

interface ApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}
interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

async function assertPublicDns(hostname: string): Promise<void> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error('Hostname did not resolve');
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error('Hostname resolves to a private or reserved address');
    }
  }
}

/** Minimal robots.txt check: does any `User-agent: *` group disallow this path? */
async function robotsAllows(url: URL): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS);
    const res = await fetch(`${url.origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return true; // no robots file — allowed
    const body = (await res.text()).slice(0, 64 * 1024);

    let applies = false;
    const disallowed: string[] = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.split('#')[0].trim();
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (!key || value === undefined) continue;
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'user-agent') {
        applies = value === '*' || value.toLowerCase().includes('ossensabot');
      } else if (applies && lowerKey === 'disallow' && value) {
        disallowed.push(value);
      }
    }
    return !disallowed.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return true; // robots unavailable — do not block evidence retrieval
  }
}

async function readCapped(res: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: await res.text(), truncated: false };
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      chunks.push(value.slice(0, value.byteLength - (received - MAX_BYTES)));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(merged), truncated };
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  return match ? match[1].trim() : undefined;
}

function extractDescription(html: string): string | undefined {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i) ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i);
  return match ? match[1].trim() : undefined;
}

const LICENSE_MARKERS: Array<{ pattern: RegExp; spdx: string }> = [
  { pattern: /MIT License|Permission is hereby granted, free of charge/i, spdx: 'MIT' },
  { pattern: /Apache License,?\s*Version 2\.0/i, spdx: 'Apache-2.0' },
  { pattern: /GNU AFFERO GENERAL PUBLIC LICENSE\s*Version 3/i, spdx: 'AGPL-3.0' },
  { pattern: /GNU GENERAL PUBLIC LICENSE\s*Version 3/i, spdx: 'GPL-3.0' },
  { pattern: /GNU GENERAL PUBLIC LICENSE\s*Version 2/i, spdx: 'GPL-2.0' },
  { pattern: /GNU LESSER GENERAL PUBLIC LICENSE/i, spdx: 'LGPL-3.0' },
  { pattern: /Mozilla Public License,?\s*(Version|v\.?)\s*2\.0/i, spdx: 'MPL-2.0' },
  { pattern: /BSD 3-Clause|Redistributions of source code must retain.*Neither the name/is, spdx: 'BSD-3-Clause' },
  { pattern: /BSD 2-Clause/i, spdx: 'BSD-2-Clause' },
  { pattern: /Business Source License 1\.1/i, spdx: 'BUSL-1.1' },
  { pattern: /Server Side Public License/i, spdx: 'SSPL-1.0' },
  { pattern: /This is free and unencumbered software released into the public domain/i, spdx: 'Unlicense' },
];

function detectLicense(text: string): string | undefined {
  const head = text.slice(0, 16 * 1024);
  for (const { pattern, spdx } of LICENSE_MARKERS) {
    if (pattern.test(head)) return spdx;
  }
  return undefined;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.query.probe !== undefined) {
    res.status(200).json({ ok: true, service: 'ossensa-evidence-fetch' });
    return;
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!rawUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  let currentUrl = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const guard = validatePublicUrl(currentUrl);
      if (!guard.ok) {
        res.status(400).json({ error: `Blocked: ${guard.reason}` });
        return;
      }
      const url = new URL(currentUrl);
      await assertPublicDns(url.hostname);

      if (hop === 0 && !(await robotsAllows(url))) {
        res.status(403).json({ error: 'Disallowed by robots.txt', robotsBlocked: true });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.1' },
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop === MAX_REDIRECTS) {
          res.status(502).json({ error: 'Too many redirects or missing location' });
          return;
        }
        currentUrl = new URL(location, url).toString();
        continue;
      }

      if (!response.ok) {
        res.status(502).json({ error: `Upstream returned ${response.status}`, upstreamStatus: response.status });
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!TEXT_CONTENT_TYPE.test(contentType)) {
        res.status(415).json({ error: `Content type ${contentType || 'unknown'} is not retrievable as evidence` });
        return;
      }

      const { text, truncated } = await readCapped(response);
      const isHtml = /html/i.test(contentType);
      const licenseSpdx = detectLicense(text);

      res.status(200).json({
        status: response.status,
        finalUrl: currentUrl,
        contentType,
        title: isHtml ? extractTitle(text) : undefined,
        description: isHtml ? extractDescription(text) : undefined,
        licenseSpdx,
        licenseExcerpt: licenseSpdx && !isHtml ? text.slice(0, 500) : undefined,
        truncated,
        retrievedAt: new Date().toISOString(),
      });
      return;
    }
    res.status(502).json({ error: 'Redirect loop' });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message || 'Fetch failed' });
  }
}
