import { verifyPublisherTrust } from '../src/auth/ans-trust.js';
import { publishAcrPlugin, fetchAcrPlugins } from '../src/sources/acr-marketplace.js';
import { search } from '../src/sources/aggregator.js';
import { formatSearchResults } from '../src/formatter.js';

async function main() {
  console.log('===============================================================');
  console.log('   PHASE 4: FEDERATED PLUGIN MARKETPLACE E2E TRUST HARNESS     ');
  console.log('===============================================================');

  // Test 1: Trust verification of ANS-anchored identity
  console.log('\n[Test 1] Verifying trust of ANS-anchored publisher "consensus-lead.acr"...');
  const validTrust = await verifyPublisherTrust('consensus-lead.acr');
  console.log('  Result:', validTrust);
  if (!validTrust.trusted) {
    throw new Error(`Expected consensus-lead.acr to be trusted, got: ${validTrust.reason}`);
  }
  console.log('  ✓ Verified ANS Publisher anchored in ACR audit block #', validTrust.auditBlockIndex);

  // Test 2: Rejection of untrusted / unanchored identity
  console.log('\n[Test 2] Testing trust gate against unanchored publisher "malicious-actor.fake"...');
  const invalidTrust = await verifyPublisherTrust('malicious-actor.fake');
  console.log('  Result:', invalidTrust);
  if (invalidTrust.trusted) {
    throw new Error('Expected unanchored actor to be rejected!');
  }
  console.log('  ✓ Correctly rejected unanchored publisher:', invalidTrust.reason);

  // Test 3: Attempting to publish plugin with unanchored publisher
  console.log('\n[Test 3] Attempting to publish plugin with unanchored publisher...');
  const rejectedPub = await publishAcrPlugin({
    name: 'rogue-exploit-tool',
    description: 'Malicious unauthorized plugin attempt',
    version: '0.0.1',
    publisherAnsName: 'malicious-actor.fake'
  });
  console.log('  Publication status:', rejectedPub.success, '| Error:', rejectedPub.error);
  if (rejectedPub.success) {
    throw new Error('Publication should have been blocked by Phase 2 ANS trust gate!');
  }
  console.log('  ✓ Trust gate successfully blocked unauthorized publication.');

  // Test 4: Publishing legitimate plugin with ANS-verified publisher
  console.log('\n[Test 4] Publishing verified plugin "acr-quantum-solver" with publisher "consensus-lead.acr"...');
  const validPub = await publishAcrPlugin({
    name: 'acr-quantum-solver',
    description: 'Cryptographically verified consensus accelerator for high-concurrency rooms',
    version: '1.2.0',
    publisherAnsName: 'consensus-lead.acr',
    publisherDid: validTrust.did,
    repository: 'http://localhost:3300/ACR/acr-protocol',
    category: 'consensus',
    keywords: ['quantum', 'consensus', 'deliberation', 'acr']
  });
  if (!validPub.success) {
    throw new Error(`Failed to publish verified plugin: ${validPub.error}`);
  }
  console.log('  ✓ Plugin published successfully:');
  console.log('    - Name:', validPub.resource?.name);
  console.log('    - Trust Badge:', validPub.resource?.trust_badge);
  console.log('    - Install Command:', validPub.resource?.install_command);

  // Test 5: Search discovery via aggregator
  console.log('\n[Test 5] Querying Claude Oracle multi-source search engine for "acr-quantum-solver"...');
  const searchOut = await search({ query: 'acr-quantum-solver', limit: 10 });
  console.log('  Sources searched:', searchOut.sources_searched.length);
  console.log('  Results found:', searchOut.results.length);
  const found = searchOut.results.find((r) => r.name === 'acr-quantum-solver');
  if (!found) {
    throw new Error('Newly published plugin was not discoverable in search!');
  }
  console.log('  ✓ Plugin discovered in search results:');
  console.log('    - Matched:', found.name);
  console.log('    - Source:', found.source);
  console.log('    - Verified Badge:', found.verified);
  console.log('    - Trust Badge:', found.trust_badge);

  console.log('\nFormatted Output Preview:');
  console.log(formatSearchResults({
    results: [found],
    sources_searched: ['acr-marketplace'],
    total_available: 1
  }));

  console.log('\n===============================================================');
  console.log('  ALL PHASE 4 MARKETPLACE & ANS TRUST GATE TESTS PASSED (100%) ');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
