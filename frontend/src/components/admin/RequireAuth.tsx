// Route guard: resolves the session cookie once, then renders the shell.
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fetchMe, ME_KEY } from "@/lib/session";

export default function RequireAuth() {
  const location = useLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        className="grid h-screen place-items-center bg-background"
        data-testid="auth-loading-state"
      >
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Restoring your session…
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
