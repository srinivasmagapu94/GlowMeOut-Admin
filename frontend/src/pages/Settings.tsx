// Administrative settings: profile, roles & permissions, security, notifications, platform config.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel, PanelHeader } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect } from "@/components/admin/TableToolbar";
import { apiGet, apiPut } from "@/lib/api";
import { fmtNumber, fmtRelative } from "@/lib/format";
import { ME_KEY } from "@/lib/session";
import type { AdminUser, PlatformSettings, RoleItem } from "@/lib/types";

const TABS = ["profile", "roles", "security", "notifications", "platform"] as const;
type TabKey = (typeof TABS)[number];

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  testid,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testid: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-grid/70 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
        data-testid={testid}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") as TabKey | null;
  const [tab, setTab] = useState<TabKey>(
    requested && TABS.includes(requested) ? requested : "profile",
  );

  const { data: admin } = useQuery({ queryKey: ME_KEY, queryFn: () => apiGet<AdminUser>("/auth/me"), retry: false });
  const { data: roles } = useQuery({
    queryKey: ["settings", "roles"],
    queryFn: () => apiGet<RoleItem[]>("/settings/roles"),
    retry: false,
  });
  const { data: platform } = useQuery({
    queryKey: ["settings", "platform"],
    queryFn: () => apiGet<PlatformSettings>("/settings/platform"),
    retry: false,
  });

  const [profile, setProfile] = useState({ name: "", title: "" });
  const [config, setConfig] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    if (admin) setProfile({ name: admin.name, title: admin.title });
  }, [admin]);

  useEffect(() => {
    if (platform) setConfig(platform);
  }, [platform]);

  const saveProfile = useMutation({
    mutationFn: () =>
      apiPut<AdminUser>("/settings/profile", {
        ...(admin as AdminUser),
        name: profile.name,
        title: profile.title,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(ME_KEY, updated);
      toast.success("Profile updated");
    },
    onError: () => toast.error("Could not save your profile"),
  });

  const saveConfig = useMutation({
    mutationFn: () => apiPut<PlatformSettings>("/settings/platform", config),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings", "platform"], updated);
      toast.success("Platform settings saved");
    },
    onError: () => toast.error("Could not save platform settings"),
  });

  const patchConfig = (updates: Partial<PlatformSettings>) =>
    setConfig((current) => (current ? { ...current, ...updates } : current));

  return (
    <div data-testid="settings-page">
      <PageHeader
        title="Settings"
        subtitle="Your admin profile, team roles, security posture and platform-wide configuration."
        testid="settings-header"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = value as TabKey;
          setTab(next);
          setSearchParams({ tab: next });
        }}
      >
        <TabsList variant="line" className="mb-4" data-testid="settings-tabs">
          <TabsTrigger value="profile" data-testid="settings-tab-profile">Admin profile</TabsTrigger>
          <TabsTrigger value="roles" data-testid="settings-tab-roles">Roles & permissions</TabsTrigger>
          <TabsTrigger value="security" data-testid="settings-tab-security">Security</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="settings-tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="platform" data-testid="settings-tab-platform">Platform</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <Panel testid="settings-profile-panel">
              <PanelHeader title="Admin profile" subtitle="How your name appears on audit entries" />
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name" className="text-xs font-semibold text-slate-700">
                    Full name
                  </Label>
                  <Input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                    data-testid="settings-profile-name"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-title" className="text-xs font-semibold text-slate-700">
                    Job title
                  </Label>
                  <Input
                    id="profile-title"
                    value={profile.title}
                    onChange={(event) => setProfile({ ...profile, title: event.target.value })}
                    data-testid="settings-profile-title"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-email" className="text-xs font-semibold text-slate-700">
                    Work email
                  </Label>
                  <Input
                    id="profile-email"
                    value={admin?.email ?? ""}
                    readOnly
                    disabled
                    data-testid="settings-profile-email"
                    className="num bg-secondary/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-role" className="text-xs font-semibold text-slate-700">
                    Assigned role
                  </Label>
                  <Input
                    id="profile-role"
                    value={admin?.role ?? ""}
                    readOnly
                    disabled
                    data-testid="settings-profile-role"
                    className="bg-secondary/60"
                  />
                </div>
              </div>
              <div className="flex justify-end border-t border-grid px-4 py-3">
                <Button
                  size="sm"
                  disabled={!profile.name.trim() || saveProfile.isPending}
                  onClick={() => saveProfile.mutate()}
                  data-testid="settings-profile-save"
                >
                  <Save className="size-3.5" /> Save profile
                </Button>
              </div>
            </Panel>

            <Panel testid="settings-session-panel">
              <PanelHeader title="Session" />
              <div className="space-y-2 p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Signed in as</span>
                  <span className="font-semibold text-slate-800">{admin?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Role</span>
                  <StatusBadge status="info" label={admin?.role ?? "—"} dot={false} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Last sign-in</span>
                  <span className="num text-slate-700">{fmtRelative(admin?.last_login)}</span>
                </div>
                <p className="pt-2 text-[11px] leading-relaxed text-slate-500">
                  Sessions are held in an httpOnly cookie and expire automatically. Signing out
                  clears both the server session and this browser's cached data.
                </p>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Panel testid="settings-roles-panel">
            <PanelHeader
              title="Roles & permissions"
              subtitle="Access is granted by role; a member inherits every permission their role holds"
              right={
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Users className="size-3.5" /> {fmtNumber(roles?.length ?? 0)} roles configured
                </span>
              }
            />
            <ul className="divide-y divide-grid/70">
              {(roles ?? []).map((role) => (
                <li key={role.id} className="px-4 py-3" data-testid={`settings-role-${role.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-900">{role.name}</p>
                      <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-slate-500">
                        {role.description}
                      </p>
                    </div>
                    <span className="num rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {role.members} members
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
              {(roles?.length ?? 0) === 0 ? (
                <li className="px-4 py-10 text-center text-xs text-slate-500">
                  Role definitions will appear here once the operations API responds.
                </li>
              ) : null}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="security">
          <Panel className="max-w-3xl" testid="settings-security-panel">
            <PanelHeader
              title="Security"
              subtitle="Authentication and session policy for every admin account"
              right={<ShieldCheck className="size-4 text-primary" />}
            />
            <ToggleRow
              label="Require two-factor authentication"
              hint="Every admin must confirm a second factor at sign-in."
              checked={config?.two_factor_required ?? false}
              onChange={(value) => patchConfig({ two_factor_required: value })}
              testid="settings-security-2fa"
            />
            <div className="flex items-center justify-between gap-4 border-b border-grid/70 px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-800">Session timeout</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Idle admins are signed out after this period.
                </p>
              </div>
              <FilterSelect
                label="Session timeout"
                testid="settings-security-timeout"
                value={String(config?.session_timeout_min ?? 60)}
                onChange={(value) => patchConfig({ session_timeout_min: Number(value) })}
                options={[
                  { value: "15", label: "15 minutes" },
                  { value: "30", label: "30 minutes" },
                  { value: "60", label: "60 minutes" },
                  { value: "240", label: "4 hours" },
                ]}
              />
            </div>
            <ToggleRow
              label="Maintenance mode"
              hint="Blocks new customer bookings while operational work is in progress."
              checked={config?.maintenance_mode ?? false}
              onChange={(value) => patchConfig({ maintenance_mode: value })}
              testid="settings-security-maintenance"
            />
            <div className="flex justify-end border-t border-grid px-4 py-3">
              <Button
                size="sm"
                disabled={!config || saveConfig.isPending}
                onClick={() => saveConfig.mutate()}
                data-testid="settings-security-save"
              >
                <Save className="size-3.5" /> Save security settings
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="notifications">
          <Panel className="max-w-3xl" testid="settings-notifications-panel">
            <PanelHeader
              title="Notification preferences"
              subtitle="Which platform events reach the admin team"
            />
            <ToggleRow
              label="New partner application"
              hint="Notify the verification team when an application is submitted."
              checked={config?.notify_new_application ?? false}
              onChange={(value) => patchConfig({ notify_new_application: value })}
              testid="settings-notify-application"
            />
            <ToggleRow
              label="Dispute raised"
              hint="Alert support leads the moment a dispute is opened."
              checked={config?.notify_dispute_raised ?? false}
              onChange={(value) => patchConfig({ notify_dispute_raised: value })}
              testid="settings-notify-dispute"
            />
            <ToggleRow
              label="Payout failure"
              hint="Notify finance when a partner payout is returned by the bank."
              checked={config?.notify_payout_failure ?? false}
              onChange={(value) => patchConfig({ notify_payout_failure: value })}
              testid="settings-notify-payout"
            />
            <ToggleRow
              label="Weekly operations digest"
              hint="A Monday summary of bookings, revenue and partner performance."
              checked={config?.notify_weekly_digest ?? false}
              onChange={(value) => patchConfig({ notify_weekly_digest: value })}
              testid="settings-notify-digest"
            />
            <div className="flex justify-end border-t border-grid px-4 py-3">
              <Button
                size="sm"
                disabled={!config || saveConfig.isPending}
                onClick={() => saveConfig.mutate()}
                data-testid="settings-notifications-save"
              >
                <Save className="size-3.5" /> Save preferences
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="platform">
          <Panel className="max-w-3xl" testid="settings-platform-panel">
            <PanelHeader
              title="Platform configuration"
              subtitle="Commercial defaults applied across the marketplace"
            />
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="platform-name" className="text-xs font-semibold text-slate-700">
                  Platform name
                </Label>
                <Input
                  id="platform-name"
                  value={config?.platform_name ?? ""}
                  onChange={(event) => patchConfig({ platform_name: event.target.value })}
                  data-testid="settings-platform-name"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform-support" className="text-xs font-semibold text-slate-700">
                  Support email
                </Label>
                <Input
                  id="platform-support"
                  value={config?.support_email ?? ""}
                  onChange={(event) => patchConfig({ support_email: event.target.value })}
                  data-testid="settings-platform-support-email"
                  className="num bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform-commission" className="text-xs font-semibold text-slate-700">
                  Default commission (%)
                </Label>
                <Input
                  id="platform-commission"
                  type="number"
                  value={config?.default_commission_pct ?? 0}
                  onChange={(event) =>
                    patchConfig({ default_commission_pct: Number(event.target.value) })
                  }
                  data-testid="settings-platform-commission"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform-cancellation" className="text-xs font-semibold text-slate-700">
                  Cancellation window (hours)
                </Label>
                <Input
                  id="platform-cancellation"
                  type="number"
                  value={config?.booking_cancellation_window_hrs ?? 0}
                  onChange={(event) =>
                    patchConfig({ booking_cancellation_window_hrs: Number(event.target.value) })
                  }
                  data-testid="settings-platform-cancellation"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform-payout" className="text-xs font-semibold text-slate-700">
                  Payout cycle
                </Label>
                <FilterSelect
                  label="Payout cycle"
                  testid="settings-platform-payout-cycle"
                  value={config?.payout_cycle ?? "Weekly"}
                  onChange={(value) => patchConfig({ payout_cycle: value })}
                  options={[
                    { value: "Daily", label: "Daily" },
                    { value: "Weekly", label: "Weekly" },
                    { value: "Fortnightly", label: "Fortnightly" },
                    { value: "Monthly", label: "Monthly" },
                  ]}
                  className="h-9 w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform-reverify" className="text-xs font-semibold text-slate-700">
                  Document re-verification (months)
                </Label>
                <Input
                  id="platform-reverify"
                  type="number"
                  value={config?.require_document_reverification_months ?? 0}
                  onChange={(event) =>
                    patchConfig({
                      require_document_reverification_months: Number(event.target.value),
                    })
                  }
                  data-testid="settings-platform-reverification"
                  className="bg-white"
                />
              </div>
            </div>
            <ToggleRow
              label="Auto-publish reviews"
              hint="Publish four and five star reviews without manual moderation."
              checked={config?.auto_approve_reviews ?? false}
              onChange={(value) => patchConfig({ auto_approve_reviews: value })}
              testid="settings-platform-auto-reviews"
            />
            <div className="flex justify-end border-t border-grid px-4 py-3">
              <Button
                size="sm"
                disabled={!config || saveConfig.isPending}
                onClick={() => saveConfig.mutate()}
                data-testid="settings-platform-save"
              >
                <Save className="size-3.5" /> Save configuration
              </Button>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
