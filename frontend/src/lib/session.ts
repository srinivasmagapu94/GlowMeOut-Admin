// Session cache ownership: login/logout must go through here so the react-query cache
// never leaks the previous admin's data into the next session on this browser.
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { AdminLoginResponse, AdminUser } from "@/lib/types";

export const ME_KEY = ["auth", "me"] as const;
const ADMIN_SESSION_KEY = "glowmeout.admin";

export async function fetchMe(): Promise<AdminUser> {
  const stored = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!stored) throw new Error("No admin session");
  return JSON.parse(stored) as AdminUser;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const result = await apiPost<AdminLoginResponse>("/ws_glowmeout_admin/admin/login", {
    email,
    password,
  });
  if (!result.validAdmin) {
    throw new Error(result.errorMessage || "Invalid administrator credentials");
  }

  const admin: AdminUser = {
    id: result.adminUUID ?? email,
    name: email,
    email,
    role: "admin",
    title: "Administrator",
    avatar_url: "",
    last_login: null,
  };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
  queryClient.setQueryData(ME_KEY, admin);
  return admin;
}

export async function beginSession(): Promise<void> {
  await queryClient.invalidateQueries();
}

/**
 * Proves the session cookie actually rides subsequent requests before we navigate.
 * A browser that blocks the cookie (e.g. third-party cookies disabled inside an
 * embedded frame) makes login return 200 while every later call 401s — without this
 * check that shows up as a silent bounce back to the login screen.
 */
export async function confirmSession(): Promise<AdminUser> {
  await queryClient.invalidateQueries();
  return queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 0 });
}

export async function endSession(): Promise<void> {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  queryClient.clear();
}
