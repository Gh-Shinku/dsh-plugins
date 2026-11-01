/** Browser-owned value interface; native Remote results are unwrapped at registration. */
import type { McpServerView, ProfileDocument, ProfileSnapshot, SelectionView, SessionSelection } from "../contracts.ts";

export interface ManagerApi {
  profiles(): Promise<ProfileSnapshot>;
  saveProfiles(document: ProfileDocument, revision: number): Promise<ProfileSnapshot>;
  catalog(sessionId?: string): Promise<McpServerView[]>;
  selection(sessionId: string): Promise<SelectionView>;
  select(sessionId: string, selection: SessionSelection): Promise<SelectionView>;
}
