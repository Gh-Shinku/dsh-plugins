/** Launch only Harness's registered activation URI through the native command service. */
import { type NativeCommandRunner, runNativeCommand } from "@deepseek-ai/dsh-native-command";

export async function activateDesktop(
  platform: NodeJS.Platform,
  signal: AbortSignal,
  run: NativeCommandRunner = runNativeCommand,
): Promise<void> {
  const command =
    platform === "win32"
      ? "explorer.exe"
      : platform === "darwin"
        ? "open"
        : platform === "linux"
          ? "xdg-open"
          : undefined;
  if (!command) throw new Error("Desktop activation is unavailable on this platform");
  try {
    await run(command, ["dsh://open"], signal, "hidden");
  } catch (error) {
    signal.throwIfAborted();
    // Explorer can return 1 after delegating URI activation to the existing desktop shell.
    if (platform !== "win32" || !(error instanceof Error) || !("code" in error) || error.code !== 1) throw error;
  }
}
