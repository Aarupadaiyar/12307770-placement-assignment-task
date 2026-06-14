// frontend/src/app/page.tsx
//
// WHY THIS FILE EXISTS:
// The root route. Once auth state is known, redirects to /dashboard (if
// logged in) or /login (if not). This is the only page that branches on
// auth without itself being a "protected" page — it's the entry point.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.push(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-500">Loading...</p>
    </main>
  );
}
