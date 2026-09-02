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

export async function endSession(): Promise<void> {
  try {
    await apiPost("/auth/logout");
  } finally {
    queryClient.clear();
  }
}
