// frontend/src/context/AuthContext.tsx
//
// WHY THIS FILE EXISTS:
// On page load, the frontend doesn't know if the user is logged in — the
// JWT lives in an httpOnly cookie it can't read directly. This context
// calls GET /api/auth/me once on mount, and exposes the result (user or
// null) plus login/register/logout functions to the rest of the app via
// `useAuth()`.
//
// This is "client state that mirrors server state" — deliberately simple
// (no external state library). For an app this size, React context +
// useState is enough, and it's one file an interviewer can read top to
// bottom.

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch, ApiError } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // `loading` is true until the initial /me check completes. Pages that
  // require auth should not redirect to /login until loading is false —
  // otherwise a logged-in user would flash a redirect on every page load.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(res.user);
  }

  async function register(email: string, password: string, displayName: string) {
    const res = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
    setUser(res.user);
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export { ApiError };
