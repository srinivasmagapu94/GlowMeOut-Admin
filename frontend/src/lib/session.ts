// Session cache ownership: login/logout must go through here so the react-query cache
// never leaks the previous admin's data into the next session on this browser.
import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { AdminUser } from "@/lib/types";

export const ME_KEY = ["auth", "me"] as const;

export const fetchMe = () => apiGet<AdminUser>("/auth/me");

export async function login(email: string, password: string): Promise<AdminUser> {
  const admin = await apiPost<AdminUser>("/auth/login", { email, password });
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
  try {
    await apiPost("/auth/logout");
  } finally {
    queryClient.clear();
  }
}
