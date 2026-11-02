/** Native profile configuration; notification delivery belongs to the desktop client. */
import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";

export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
});
export const inject = ["settings"];
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber));
}
