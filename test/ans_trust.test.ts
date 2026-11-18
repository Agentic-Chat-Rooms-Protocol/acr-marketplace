import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPublisherTrust } from '../src/auth/ans-trust.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

describe('acr-marketplace: ANS Trust Gate & Canonical Configuration', () => {
  it('defaults both ACR_DAEMON_URL and ROUTE_ANS_URL to 127.0.0.1:20443 and rejects missing names', async () => {
    const emptyRes = await verifyPublisherTrust('');
    assert.equal(emptyRes.trusted, false);
    assert.match(emptyRes.reason, /required/i);

    const requestedUrls: string[] = [];
    const originalFetch = globalThis.fetch;
    delete process.env.ACR_DAEMON_URL;
    delete process.env.ROUTE_ANS_URL;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      requestedUrls.push(url);
      if (url.includes('/v1/resolve')) {
        return new Response(
          JSON.stringify({
            metadata: { protocolExtensions: { did: 'did:key:z6MkTestAnchor' } },
            certificates: { public: { fingerprint: 'abc123fingerprint' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify([
          {
            index: 4,
            state_hash: 'sha256_anchored_state',
            actor_did: 'did:key:z6MkTestAnchor',
            payload: { handle: 'consensus-lead.acr' },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const res = await verifyPublisherTrust('consensus-lead.acr');
      assert.equal(res.trusted, true);
      assert.equal(res.did, 'did:key:z6MkTestAnchor');
      assert.equal(res.stateHash, 'sha256_anchored_state');
      assert.equal(res.auditBlockIndex, 4);
      assert.ok(requestedUrls.every((u) => u.startsWith('http://127.0.0.1:20443/')));
      assert.equal(requestedUrls.some((u) => u.includes(':8080')), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('contains zero claude-oracle-mcp or Vvkmnn donor remnants in package.json or src/index.ts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));
    assert.equal(pkg.name, '@acr-js/marketplace');
    assert.equal(pkg.author, '@acr-js');
    assert.equal(pkg.funding, undefined);

    const indexSrc = fs.readFileSync(path.join(repoRoot, 'src', 'index.ts'), 'utf-8');
    assert.equal(/claude-oracle|vvkmnn/i.test(indexSrc), false);
    assert.ok(indexSrc.includes("'@acr-js/marketplace'"));
  });
});
