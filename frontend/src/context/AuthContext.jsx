import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => setUser(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(false);
    }
  }, []);

  const hasPerm = useCallback(
    (...perms) => Array.isArray(user?.permissions) && perms.some((p) => user.permissions.includes(p)),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPerm }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
