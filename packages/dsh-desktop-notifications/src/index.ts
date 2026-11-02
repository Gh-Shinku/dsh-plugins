/** Fixed desktop activation operation; notification delivery stays in the client. */
import { type Context, Service } from "@deepseek-ai/cordis";
import { bindTypertRemote, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { activateDesktop } from "./activation.ts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    shinkuDesktopNotifications: DesktopNotifications;
  }
}

export class DesktopNotifications extends Service {
  private readonly lifetime = new AbortController();
  readonly typertRemote = bindTypertRemote(this, "shinkuDesktopNotifications");
  constructor(ctx: Context) {
    super(ctx, "shinkuDesktopNotifications");
    ctx.effect(() => () => this.lifetime.abort());
  }

  @Remote
  async activate(): Promise<void> {
    if (!process.versions.electron) throw new Error("Desktop activation requires a local Harness desktop Host");
    await activateDesktop(process.platform, AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(5000)]));
  }
}
export default DesktopNotifications;
