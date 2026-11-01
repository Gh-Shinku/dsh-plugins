/** Persisted templates and detached catalog views shared by the two plugin faces. */
export interface McpProfile {
  id: string;
  name: string;
  servers: string[];
}

/** One deployment's editable template collection. */
export interface ProfileDocument {
  profiles: McpProfile[];
  defaultProfileId: string;
}

/** Profile settings accompanied by the native settings revision. */
export interface ProfileSnapshot extends ProfileDocument {
  revision: number;
}

/** A detached session copy; server ids, rather than profile contents, govern access. */
export interface SessionSelection {
  version: 1;
  profileId: string;
  profileName: string;
  servers: string[];
}

/** Current selection. The retained locked field is always false; legacy means access is inherited. */
export interface SelectionView {
  selection: SessionSelection;
  locked: boolean;
  legacy: boolean;
}

/** Read-only schema projection; execution callbacks never cross the wire. */
export interface McpToolView {
  name: string;
  description: string;
  parameterSchema: string;
}

/** Configured native MCP instance and its currently discoverable tools. */
export interface McpServerView {
  id: string;
  serverName: string;
  transport: string;
  available: boolean;
  diagnostic: string;
  tools: McpToolView[];
}
