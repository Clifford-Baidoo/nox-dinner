import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface AppSettings {
  eventName: string;
}

const DEFAULTS: AppSettings = { eventName: "Dinner Event" };

export function useSettings(): { settings: AppSettings; refresh: () => void } {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const refresh = useCallback(() => {
    api
      .get<AppSettings>("/settings")
      .then(setSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, refresh };
}
