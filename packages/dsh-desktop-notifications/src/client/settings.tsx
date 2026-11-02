import { Button, Checkbox } from "@deepseek-ai/dsh-client-ui-primitives";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import { useState, useSyncExternalStore } from "react";
import type { Translate } from "./locales.ts";

export interface Preferences {
  enabled: boolean;
}
export interface SettingsProps {
  form: ConfigForm<Preferences>;
  permission(): NotificationPermission | "unsupported";
  test(): Promise<void>;
  t: Translate;
}

export function NotificationSettings({ form, permission, test, t }: SettingsProps) {
  const state = useSyncExternalStore(
    (listener) => form.subscribe(listener),
    () => form.getSnapshot(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [, refresh] = useState(0);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      if ((await operation()) === false) setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      refresh((value) => value + 1);
    }
  };
  const available = state.status === "ready" && state.writable;
  return (
    <section style={{ display: "grid", gap: 16, padding: 24 }}>
      <h2>{t("title")}</h2>
      <Checkbox
        label={t("enabled")}
        checked={state.value?.enabled ?? true}
        disabled={!available || busy}
        onChange={(enabled) => {
          void run(() => form.set("enabled", enabled));
        }}
      />
      <p role="status">{t(permission())}</p>
      {state.status !== "ready" && <p>{t("unavailable")}</p>}
      <Button
        disabled={!available || busy || permission() === "unsupported"}
        onClick={() => {
          void run(test);
        }}
      >
        {t("test")}
      </Button>
      {error && <p role="alert">{t("error")}</p>}
    </section>
  );
}
