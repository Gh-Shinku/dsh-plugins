/** Deterministic stdio MCP fixture; no remote services or model credentials. */
import { createInterface } from "node:readline";

const server = process.argv[2] ?? "fixture";
const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result;
  switch (request.method) {
    case "initialize":
      result = {
        protocolVersion: request.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: server, version: "1.0.0" },
        instructions: `Only ${server} instructions`,
      };
      break;
    case "tools/list":
      result = {
        tools: [
          {
            name: "echo",
            description: `${server} echo tool`,
            inputSchema: { type: "object", properties: { text: { type: "string" } } },
          },
        ],
      };
      break;
    case "tools/call":
      result = { content: [{ type: "text", text: `${server}:${request.params.arguments.text ?? "ok"}` }] };
      break;
    case "ping":
      result = {};
      break;
    default:
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } })}\n`,
      );
      return;
  }
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
});
