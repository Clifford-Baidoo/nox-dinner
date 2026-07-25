import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ authenticated: boolean }>("/admin/me");
      setAuthenticated(res.authenticated);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (password: string) => {
    await api.post("/admin/login", { password });
    setAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/admin/logout");
    setAuthenticated(false);
  }, []);

  return { authenticated, login, logout, refresh };
}
