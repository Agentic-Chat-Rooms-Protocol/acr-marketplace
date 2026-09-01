# Agent Guidelines - acr-marketplace

## Plugin Registry & Security Discipline
1. **Manifest Verification**: Strictly audit plugin capability scopes against the least-privilege permission matrix.
2. **Signature Verification**: Verify publisher cryptographic signatures prior to distributing or activating plugins.
3. **Sandbox Isolation**: Execute third-party plugins in memory-isolated WASM / container sandboxes.
