// Admin sign-in. Renders fully without a backend (static preview safe).
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { fetchMe, login, ME_KEY } from "@/lib/session";

const ASSURANCES = [
  "Role-scoped access for operations, verification, finance and support teams",
  "Every approval, rejection and payout decision written to an audit trail",
  "Session cookies are httpOnly and expire automatically after inactivity",
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@glowmeout.example");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: existing } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, retry: false });
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Those credentials were not recognised. Check the email and password.");
      } else if (err instanceof ApiError && err.status === 422) {
        setError("Enter both an email address and a password.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("The operations API is unreachable. Try again in a moment.");
      }
      setBusy(false);
      return;
    }

    setBusy(false);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]" data-testid="login-page">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-nav p-10 text-white lg:flex">
        <div className="absolute -top-24 -left-24 size-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-15%] size-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-blue-600">
            <Sparkles className="size-4.5" />
          </span>
          <div>
            <p className="text-sm leading-tight font-bold">GlowMeOut</p>
            <p className="text-[10px] tracking-wider text-slate-400 uppercase">
              Operations Console
            </p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="eyebrow text-blue-300">Internal platform</p>
          <h1 className="mt-3 text-[32px] leading-[1.15] font-bold tracking-tight">
            The control room for a nationwide beauty and wellness marketplace.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Verify partner applications, monitor bookings as they happen, reconcile payouts and
            resolve disputes — all from one operations workspace.
          </p>
          <ul className="mt-8 space-y-3">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] text-slate-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-slate-500">
          Authorised personnel only. Activity on this console is monitored and logged.
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4.5" />
            </span>
            <div>
              <p className="text-sm leading-tight font-bold text-slate-900">GlowMeOut</p>
              <p className="text-[10px] tracking-wider text-slate-500 uppercase">
                Operations Console
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-grid bg-card p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <p className="eyebrow text-slate-400">Administrator access</p>
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
              Sign in to continue
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Use the credentials issued by your platform administrator.
            </p>

            {existing ? (
              <div
                className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800"
                data-testid="login-existing-session"
              >
                You are already signed in as {existing.name}.{" "}
                <Link to="/dashboard" className="font-semibold underline">
                  Open the dashboard
                </Link>
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4" data-testid="login-form">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                  Work email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@glowmeout.example"
                  data-testid="login-email-input"
                  className="h-10 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••"
                    data-testid="login-password-input"
                    className="h-10 bg-white pl-9"
                  />
                </div>
              </div>

              {error ? (
                <p
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  data-testid="login-error"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={busy}
                data-testid="login-submit-button"
                className="h-10 w-full text-sm font-semibold"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy ? "Signing in…" : "Sign in to console"}
              </Button>
            </form>

            <div
              className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5"
              data-testid="login-demo-hint"
            >
              <p className="eyebrow text-slate-400">Demo credentials</p>
              <p className="num mt-1 text-[11px] text-slate-600">admin@glowmeout.example</p>
              <p className="num text-[11px] text-slate-600">Admin@12345</p>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Trouble signing in? Contact platform operations at ops@glowmeout.example
          </p>
        </div>
      </div>
    </div>
  );
}
