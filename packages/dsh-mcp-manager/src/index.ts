/** Cordis entrypoint; all behavior is owned by the manager service. */

export type {
  McpProfile,
  McpServerView,
  McpToolView,
  ProfileDocument,
  ProfileSnapshot,
  SelectionView,
  SessionSelection,
} from "./contracts.ts";
export { Config, McpManager as default, McpManager } from "./manager.ts";
