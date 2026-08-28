import crypto from 'node:crypto';
import type { Resource, DataSource } from '../types.js';
import { verifyPublisherTrust } from '../auth/ans-trust.js';

export interface AcrPluginInput {
  name: string;
  description: string;
  version: string;
  publisherAnsName: string;
  publisherDid?: string;
  repository?: string;
  category?: string;
  keywords?: string[];
  configSnippet?: string;
}

function computeArtifactHash(name: string, version: string, description: string, configSnippet?: string): string {
  return crypto.createHash('sha256')
    .update(`${name}@${version}:${description}:${configSnippet || ''}`)
    .digest('hex');
}

// In-memory registry of federated ACR plugins
const acrRegistry: Resource[] = [
  {
    name: 'acr-consensus-tools',
    description: 'Autonomous multi-agent consensus, proposal creation, and dissent recording tools',
    type: 'plugin',
    install_command: '/plugin install acr-consensus-tools@acr-marketplace',
    source: 'acr-marketplace',
    url: 'http://localhost:3300/ACR/acr-protocol',
    category: 'governance',
    keywords: ['consensus', 'dissent', 'audit-trail', 'tla-plus', 'agent-identity'],
    author: 'consensus-lead.acr',
    version: '1.0.0',
    verified: true,
    quality_score: 98,
    publisherAnsName: 'consensus-lead.acr',
    did: 'did:key:z6Mka881...operator',
    trust_badge: 'ANS-ANCHORED (Block #0004)',
    content_hash: computeArtifactHash('acr-consensus-tools', '1.0.0', 'Autonomous multi-agent consensus, proposal creation, and dissent recording tools'),
    last_updated: new Date().toISOString()
  },
  {
    name: 'acr-audit-verifier',
    description: 'Cryptographic state chain and SHA-256 monotonic audit trail inspector',
    type: 'skill',
    install_command: '/plugin install acr-audit-verifier@acr-marketplace',
    source: 'acr-marketplace',
    url: 'http://localhost:3300/ACR/acr-cli',
    category: 'security',
    keywords: ['audit', 'security', 'cryptography', 'merkle', 'did'],
    author: 'security-auditor.acr',
    version: '1.0.0',
    verified: true,
    quality_score: 95,
    publisherAnsName: 'security-auditor.acr',
    did: 'did:key:z6Mka881...operator',
    trust_badge: 'ANS-ANCHORED (Block #0000)',
    content_hash: computeArtifactHash('acr-audit-verifier', '1.0.0', 'Cryptographic state chain and SHA-256 monotonic audit trail inspector'),
    last_updated: new Date().toISOString()
  }
];

export function verifyPluginIntegrity(resource: Resource): boolean {
  if (!resource.content_hash) return false;
  const expected = computeArtifactHash(resource.name, resource.version || '1.0.0', resource.description, resource.config_snippet);
  return resource.content_hash === expected;
}

export async function publishAcrPlugin(input: AcrPluginInput): Promise<{
  success: boolean;
  resource?: Resource;
  error?: string;
  trustResult: any;
}> {
  // Enforce Phase 2 ANS Trust check
  const trust = await verifyPublisherTrust(input.publisherAnsName, input.publisherDid);
  if (!trust.trusted) {
    return {
      success: false,
      error: `Publisher rejection: ${trust.reason}`,
      trustResult: trust
    };
  }

  const contentHash = computeArtifactHash(input.name, input.version, input.description, input.configSnippet);

  const resource: Resource = {
    name: input.name,
    description: input.description,
    type: 'plugin',
    install_command: `/plugin install ${input.name}@acr-marketplace`,
    source: 'acr-marketplace',
    url: input.repository || 'http://localhost:3300/ACR',
    category: input.category || 'tools',
    keywords: input.keywords || ['acr', 'agent'],
    author: input.publisherAnsName,
    version: input.version,
    config_snippet: input.configSnippet,
    verified: true,
    quality_score: 90,
    publisherAnsName: input.publisherAnsName,
    did: trust.did,
    trust_badge: `ANS-ANCHORED (Block #${trust.auditBlockIndex ?? 0})`,
    content_hash: contentHash,
    last_updated: new Date().toISOString()
  };

  // Upsert into registry
  const existingIdx = acrRegistry.findIndex((r) => r.name === resource.name);
  if (existingIdx >= 0) {
    acrRegistry[existingIdx] = resource;
  } else {
    acrRegistry.push(resource);
  }

  return {
    success: true,
    resource,
    trustResult: trust
  };
}

export async function fetchAcrPlugins(): Promise<Resource[]> {
  return [...acrRegistry];
}

export function getAcrMarketplaceSource(): DataSource {
  return {
    name: 'acr-marketplace',
    type: 'plugin',
    count: acrRegistry.length,
    last_updated: new Date().toISOString(),
    status: 'ok'
  };
}
