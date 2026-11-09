export const dynamic = "force-static";

/**
 * Proof that this domain owns the com.securitythreatpulse namespace in the official MCP registry
 * (registry.modelcontextprotocol.io, HTTP domain auth). This is a public key; the private key is
 * never stored in the repo. To rotate: generate a new ed25519 key, replace this line, deploy, then
 * run `mcp-publisher login http --domain securitythreatpulse.com --private-key <hex seed>`.
 */
const PROOF = "v=MCPv1; k=ed25519; p=JZBltX+gNWVv7kBJSjReO3mOQuLkKGnz87BzRFQDhmI=";

export function GET() {
  return new Response(`${PROOF}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
