/// <reference types="node" />

/**
 * Opt-in, bounded evidence fetch for self-hosted OSSensa deployments.
 *
 * The public demo leaves this endpoint disabled. When enabled, each request
 * validates the URL, resolves every address, pins the chosen public address
 * into the socket lookup, revalidates every redirect (including robots.txt),
 * and returns only extracted metadata from a capped text response.
 */
import { lookup } from 'node:dns/promises';
import type { LookupOneOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { isPrivateAddress, validatePublicUrl } from '../src/lib/discovery/urlGuard';

const MAX_BYTES = 512 * 1024;
const MAX_ROBOTS_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;
const ROBOTS_TIMEOUT_MS = 3_000;
const URL_LIMIT = 2_048;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const USER_AGENT = 'OSSensaBot/1.1 (+https://github.com/flowersbl00minadarkr00m/ossensa)';
const TEXT_CONTENT_TYPE = /^(text\/|application\/(json|xml|xhtml\+xml|rss\+xml))/i;

interface ApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

interface PinnedResponse {
  status: number;
  headers: IncomingHttpHeaders;
  text: string;
  truncated: boolean;
}

interface PublicResponse extends PinnedResponse {
  finalUrl: URL;
}

const requestWindows = new Map<string, { startedAt: number; count: number }>();

function clientAddress(req: ApiRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || 'unknown';
}

function allowRequest(key: string, now = Date.now()): boolean {
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error('DNS_EMPTY');
  for (const record of records) {
    if (isPrivateAddress(record.address)) throw new Error('DNS_BLOCKED');
  }
  const selected = records[0];
  return { address: selected.address, family: selected.family as 4 | 6 };
}

function requestPinned(
  url: URL,
  pinned: ResolvedAddress,
  maxBytes: number,
  timeoutMs: number,
): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (value: PinnedResponse) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const pinnedLookup = (
      _hostname: string,
      _options: LookupOneOptions,
      callback: (error: NodeJS.ErrnoException | null, address: string, family: 4 | 6) => void,
    ) => callback(null, pinned.address, pinned.family);

    const request = transport.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.1',
        'Accept-Encoding': 'identity',
      },
      lookup: pinnedLookup,
      ...(url.protocol === 'https:' ? { servername: url.hostname } : {}),
    }, (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer | Uint8Array | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = maxBytes - received;
        if (remaining > 0) chunks.push(buffer.subarray(0, remaining));
        received += buffer.byteLength;
        if (received > maxBytes) {
          finish({
            status: response.statusCode ?? 502,
            headers: response.headers,
            text: Buffer.concat(chunks).toString('utf8'),
            truncated: true,
          });
          response.destroy();
        }
      });
      response.on('end', () => finish({
        status: response.statusCode ?? 502,
        headers: response.headers,
        text: Buffer.concat(chunks).toString('utf8'),
        truncated: false,
      }));
      response.on('error', fail);
    });

    request.setTimeout(timeoutMs, () => request.destroy(new Error('UPSTREAM_TIMEOUT')));
    request.on('error', fail);
    request.end();
  });
}

async function fetchPublicResource(
  rawUrl: string,
  maxBytes: number,
  timeoutMs: number,
  maxRedirects = MAX_REDIRECTS,
): Promise<PublicResponse> {
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const guard = validatePublicUrl(current);
    if (!guard.ok) throw new Error('URL_BLOCKED');
    const url = new URL(current);
    const pinned = await resolvePublicAddress(url.hostname);
    const response = await requestPinned(url, pinned, maxBytes, timeoutMs);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location || hop === maxRedirects) throw new Error('REDIRECT_BLOCKED');
      current = new URL(Array.isArray(location) ? location[0] : location, url).toString();
      continue;
    }
    return { ...response, finalUrl: url };
  }
  throw new Error('REDIRECT_BLOCKED');
}

/** Minimal robots.txt check for wildcard and OSSensaBot groups. */
async function robotsAllows(url: URL): Promise<boolean> {
  try {
    const response = await fetchPublicResource(
      url.origin + '/robots.txt',
      MAX_ROBOTS_BYTES,
      ROBOTS_TIMEOUT_MS,
      2,
    );
    if (response.status < 200 || response.status >= 300) return true;
    let applies = false;
    const disallowed: string[] = [];
    for (const rawLine of response.text.split('\n')) {
      const line = rawLine.split('#')[0].trim();
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (!key) continue;
      if (key.toLowerCase() === 'user-agent') {
        applies = value === '*' || value.toLowerCase().includes('ossensabot');
      } else if (applies && key.toLowerCase() === 'disallow' && value) {
        disallowed.push(value);
      }
    }
    return !disallowed.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return true;
  }
}

function extractTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1].trim();
}

function extractDescription(html: string): string | undefined {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i) ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i);
  return match?.[1].trim();
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
  return LICENSE_MARKERS.find(({ pattern }) => pattern.test(head))?.spdx;
}

function publicError(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'URL_BLOCKED' || code === 'DNS_BLOCKED') return { status: 400, message: 'That destination is not allowed.' };
  if (code === 'REDIRECT_BLOCKED') return { status: 502, message: 'The upstream redirect could not be followed safely.' };
  if (code === 'UPSTREAM_TIMEOUT') return { status: 504, message: 'The upstream site timed out.' };
  return { status: 502, message: 'The upstream site could not be retrieved safely.' };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Use GET.' });
    return;
  }

  const enabled = process.env.OSSENSA_FETCH_ENABLED === '1';
  if (req.query.probe !== undefined) {
    res.status(enabled ? 200 : 503).json({ ok: enabled, service: 'ossensa-evidence-fetch' });
    return;
  }
  if (!enabled) {
    res.status(503).json({ error: 'Evidence fetching is disabled on this deployment.' });
    return;
  }
  if (!allowRequest(clientAddress(req))) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Too many evidence fetches. Try again shortly.' });
    return;
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!rawUrl || rawUrl.length > URL_LIMIT) {
    res.status(400).json({ error: 'Provide one valid URL no longer than 2,048 characters.' });
    return;
  }

  try {
    const initialUrl = new URL(rawUrl);
    if (!(await robotsAllows(initialUrl))) {
      res.status(403).json({ error: 'Disallowed by robots.txt', robotsBlocked: true });
      return;
    }
    const response = await fetchPublicResource(rawUrl, MAX_BYTES, FETCH_TIMEOUT_MS);
    if (response.status < 200 || response.status >= 300) {
      res.status(502).json({ error: 'Upstream returned ' + response.status + '.' });
      return;
    }
    const contentType = String(response.headers['content-type'] ?? '');
    if (!TEXT_CONTENT_TYPE.test(contentType)) {
      res.status(415).json({ error: 'The upstream response is not a supported text format.' });
      return;
    }
    const isHtml = /html/i.test(contentType);
    const licenseSpdx = detectLicense(response.text);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      status: response.status,
      finalUrl: response.finalUrl.toString(),
      contentType,
      title: isHtml ? extractTitle(response.text) : undefined,
      description: isHtml ? extractDescription(response.text) : undefined,
      licenseSpdx,
      licenseExcerpt: licenseSpdx && !isHtml ? response.text.slice(0, 500) : undefined,
      truncated: response.truncated,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    const safe = publicError(error);
    res.status(safe.status).json({ error: safe.message });
  }
}
