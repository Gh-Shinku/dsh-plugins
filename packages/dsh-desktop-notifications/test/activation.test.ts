import { expect, it, vi } from "vitest";
import { activateDesktop } from "../src/activation.ts";

it.each([
  ["win32", "explorer.exe"],
  ["darwin", "open"],
  ["linux", "xdg-open"],
] as const)("uses only the fixed Harness URI on %s", async (platform, command) => {
  const run = vi.fn(async () => ({ stdout: "", stderr: "" }));
  const signal = new AbortController().signal;
  await activateDesktop(platform, signal, run);
  expect(run).toHaveBeenCalledExactlyOnceWith(command, ["dsh://open"], signal, "hidden");
});

it("accepts Explorer's delegated handoff exit code", async () => {
  const run = vi.fn(async () => {
    throw Object.assign(new Error("handoff"), { code: 1 });
  });
  await expect(activateDesktop("win32", new AbortController().signal, run)).resolves.toBeUndefined();
});

it("propagates real activation failure and cancellation", async () => {
  const run = vi.fn(async () => {
    throw new Error("unavailable");
  });
  await expect(activateDesktop("win32", new AbortController().signal, run)).rejects.toThrow("unavailable");
  const abort = new AbortController();
  const delegated = vi.fn(async () => {
    abort.abort(new Error("cancelled"));
    throw Object.assign(new Error("handoff"), { code: 1 });
  });
  await expect(activateDesktop("win32", abort.signal, delegated)).rejects.toThrow("cancelled");
});

it("rejects unsupported platforms without launching anything", async () => {
  const run = vi.fn(async () => ({ stdout: "", stderr: "" }));
  await expect(activateDesktop("aix", new AbortController().signal, run)).rejects.toThrow("unavailable");
  expect(run).not.toHaveBeenCalled();
});
