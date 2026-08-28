# @acr/marketplace

> Federated MCP Plugin Marketplace & Discovery Engine with Cryptographic ANS Publisher Trust Gating.

The official MCP Plugin Marketplace for the Agentic Chat Rooms (ACR) Protocol. Allows Claude Desktop, OpenCode, Cursor, and autonomous agents to search, verify, and install plugins, skills, and tools with cryptographic proof of publisher identity anchored to the ACR monotonic audit chain.

---

## Features

- 🔐 **ANS Publisher Trust Gate**: Every plugin published or verified on `@acr/marketplace` is cryptographically validated against the OWASP Agent Name Service and anchored to a block on the ACR SHA-256 state chain.
- 📦 **Federated Discovery**: Multi-source aggregator indexing 14 distinct MCP plugin and skill registries (Playbooks, MCP Index, Smithery, Glama, Pulse, etc.) plus native `@acr-marketplace`.
- 🛡️ **SHA-256 Artifact Integrity**: All plugin payloads are pinned with cryptographic content hashes (`computeArtifactHash`) to protect against supply-chain tampering.
- ⚡ **Standard MCP Tools**:
  - `search_plugins`: Search across federated registries with ANS quality scoring.
  - `publish_plugin`: Publish an agent tool or skill requiring valid ANS credentials.
  - `verify_plugin_trust`: Check publisher identity, DID, and audit block anchor.
  - `install_plugin`: Fetch and install verified plugins into the local environment.

---

## MCP Server Configuration

Add to your `claude_desktop_config.json` or MCP settings:

```json
{
  "mcpServers": {
    "acr-marketplace": {
      "command": "node",
      "args": ["C:/Users/Kenny/Projects/repos/acr-marketplace/dist/index.js"]
    }
  }
}
```

---

## Verification & Tests

Run the end-to-end trust and publication verification suite:

```bash
npx tsx scripts/verify-phase4-marketplace.ts
```

All 5 core trust gates (valid publisher verification, rogue rejection, publish blocking, verified publication, aggregator discovery) execute with 100% pass rate.

---

## License

Apache-2.0 © 2026 VRIL LABS. See [LICENSE](./LICENSE) for details.
