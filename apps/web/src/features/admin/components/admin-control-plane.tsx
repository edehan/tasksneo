"use client";

import {
  Activity,
  GraduationCap,
  ListChecks,
  Loader2,
  LogOut,
  Megaphone,
  Moon,
  RefreshCw,
  Send,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ADMIN_TOKEN_STORAGE_KEY,
  type AdminAnnouncement,
  type AdminMetrics,
  type AdminQueueStats,
  type AdminSchool,
  ApiError,
  cancelAdminAnnouncement,
  createAdminAnnouncement,
  createAdminSchool,
  deleteAdminSchool,
  getAdminConfig,
  getAdminMetrics,
  getAdminQueueStats,
  getAdminStorageStatus,
  listAdminAnnouncements,
  listAdminSchools,
  listAdminUsers,
  patchAdminConfig,
  patchAdminUser,
  type StorageStatus,
  sendAdminTestEmail,
  type UserProfile,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const CONFIG_DEFAULTS = {
  "app.title": "TaskNeo",
  "app.base_url": "",
  "auth.registration_open": "true",
  "notif.before_due_hours": "",
  "email.provider": "smtp",
  "smtp.host": "",
  "smtp.port": "",
  "smtp.user": "",
  "smtp.password": "",
  "smtp.from": "",
  "smtp.from_name": "TaskNeo",
  "cyberpanel.api_key": "",
  "cyberpanel.from": "",
  "llm.provider": "",
  "llm.base_url": "",
  "llm.api_key": "",
  "llm.model": "",
  "llm.prompt_task_parse": "",
  "stt.api_key": "",
  "stt.speech_model": "whisper-rt",
};

type ConfigKey = keyof typeof CONFIG_DEFAULTS;
type ConfigState = Record<ConfigKey, string>;

interface ConfigField {
  key: ConfigKey;
  label: string;
  type?: "text" | "password" | "textarea";
  placeholder?: string;
}

const CONFIG_GROUPS: Array<{ title: string; fields: ConfigField[] }> = [
  {
    title: "App",
    fields: [
      { key: "app.title", label: "Site Title", placeholder: "TaskNeo" },
      {
        key: "app.base_url",
        label: "Base URL",
        placeholder: "https://app.example.com",
      },
    ],
  },
  {
    title: "Auth",
    fields: [{ key: "auth.registration_open", label: "Registration Open" }],
  },
  {
    title: "Notifications",
    fields: [
      {
        key: "notif.before_due_hours",
        label: "Before Due Hours",
        placeholder: "24,2",
      },
    ],
  },
  {
    title: "Email",
    fields: [
      { key: "email.provider", label: "Email Provider" },
      { key: "smtp.host", label: "SMTP Host", placeholder: "smtp.example.com" },
      { key: "smtp.port", label: "SMTP Port", placeholder: "587" },
      { key: "smtp.user", label: "SMTP User" },
      { key: "smtp.password", label: "SMTP Password", type: "password" },
      {
        key: "smtp.from",
        label: "SMTP From",
        placeholder: "noreply@example.com",
      },
      {
        key: "smtp.from_name",
        label: "SMTP From Name",
        placeholder: "TaskNeo",
      },
      {
        key: "cyberpanel.api_key",
        label: "CyberPanel API Key",
        type: "password",
      },
      {
        key: "cyberpanel.from",
        label: "CyberPanel From",
        placeholder: "noreply@example.com",
      },
    ],
  },
  {
    title: "LLM",
    fields: [
      { key: "llm.provider", label: "Provider", placeholder: "openai" },
      {
        key: "llm.base_url",
        label: "Base URL",
        placeholder: "https://api.openai.com/v1",
      },
      { key: "llm.api_key", label: "API Key", type: "password" },
      { key: "llm.model", label: "Model", placeholder: "gpt-4o-mini" },
      {
        key: "llm.prompt_task_parse",
        label: "Task Parse Prompt",
        type: "textarea",
        placeholder:
          "Base prompt for AI task parsing (role + context description)",
      },
    ],
  },
  {
    title: "Speech-to-Text",
    fields: [
      { key: "stt.api_key", label: "API Key", type: "password" },
      {
        key: "stt.speech_model",
        label: "Speech Model",
        placeholder: "whisper-rt",
      },
    ],
  },
];

const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];
const SECRET_CONFIG_KEYS = new Set<ConfigKey>([
  "smtp.user",
  "smtp.password",
  "cyberpanel.api_key",
  "llm.api_key",
  "stt.api_key",
]);
const SECRET_MASK = "***";
const SECRET_REENTER = "[re-enter value]";
const ADMIN_TABS = [
  { value: "config", label: "Config", icon: Settings },
  { value: "users", label: "Users", icon: Users },
  { value: "schools", label: "Schools", icon: GraduationCap },
  { value: "announcements", label: "Announcements", icon: Megaphone },
  { value: "metrics", label: "Metrics", icon: Activity },
  { value: "queue", label: "Queue", icon: ListChecks },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["value"];

function normalizeConfig(config: Record<string, string>): ConfigState {
  const normalized = { ...CONFIG_DEFAULTS } as ConfigState;

  for (const key of CONFIG_KEYS) {
    normalized[key] = config[key] ?? CONFIG_DEFAULTS[key];
  }

  return normalized;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message} (${error.code})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isSecretDisplayValue(key: ConfigKey, value: string): boolean {
  return (
    SECRET_CONFIG_KEYS.has(key) &&
    (value === SECRET_MASK || value === SECRET_REENTER)
  );
}

export function AdminControlPlane() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [configInitial, setConfigInitial] =
    useState<ConfigState>(CONFIG_DEFAULTS);
  const [configForm, setConfigForm] = useState<ConfigState>(CONFIG_DEFAULTS);
  const [configSaving, setConfigSaving] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [schoolCreating, setSchoolCreating] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<AdminSchool | null>(
    null,
  );
  const [schoolDeletingId, setSchoolDeletingId] = useState<string | null>(null);

  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(
    null,
  );
  const [storageChecking, setStorageChecking] = useState(false);

  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementCreating, setAnnouncementCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [queueStats, setQueueStats] = useState<AdminQueueStats | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("config");

  const { resolvedTheme, setTheme } = useTheme();
  const hasConfigChanges = useMemo(
    () =>
      CONFIG_KEYS.some((key) => {
        return configForm[key] !== configInitial[key];
      }),
    [configForm, configInitial],
  );

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) {
      return users;
    }
    return users.filter((user) => {
      const nickname = user.nickname?.toLowerCase() ?? "";
      return user.email.toLowerCase().includes(q) || nickname.includes(q);
    });
  }, [users, userQuery]);

  const loadAdminData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [
        config,
        adminUsers,
        adminSchools,
        storage,
        adminAnnouncements,
        initialMetrics,
      ] = await Promise.all([
        getAdminConfig(),
        listAdminUsers(),
        listAdminSchools(),
        getAdminStorageStatus().catch(() => null),
        listAdminAnnouncements().catch(() => [] as AdminAnnouncement[]),
        getAdminMetrics().catch(() => null),
      ]);

      const normalized = normalizeConfig(config);
      setConfigInitial(normalized);
      setConfigForm(normalized);
      setUsers(adminUsers);
      setSchools(adminSchools);
      if (storage) setStorageStatus(storage);
      setAnnouncements(adminAnnouncements);
      setMetrics(initialMetrics);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const refreshMetrics = useCallback(async () => {
    if (!token) return;
    setMetricsLoading(true);
    try {
      const snapshot = await getAdminMetrics();
      setMetrics(snapshot);
    } catch (error) {
      toast.error(`Failed to load metrics: ${getErrorMessage(error)}`);
    } finally {
      setMetricsLoading(false);
    }
  }, [token]);

  const refreshQueue = useCallback(async () => {
    if (!token) return;
    setQueueLoading(true);
    try {
      const stats = await getAdminQueueStats();
      setQueueStats(stats);
    } catch (error) {
      toast.error(`Failed to load queue stats: ${getErrorMessage(error)}`);
    } finally {
      setQueueLoading(false);
    }
  }, [token]);

  const authenticate = useCallback(
    async (nextToken: string) => {
      setAuthLoading(true);
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, nextToken);
      try {
        await loadAdminData();
        setToken(nextToken);
        setTokenInput("");
        toast.success("Admin token verified.");
      } catch (error) {
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        setToken(null);
        toast.error(`Authentication failed: ${getErrorMessage(error)}`);
      } finally {
        setAuthLoading(false);
      }
    },
    [loadAdminData],
  );

  function clearSession() {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken(null);
    setTokenInput("");
    setUsers([]);
    setSchools([]);
    toast.info("Admin token cleared.");
  }

  useEffect(() => {
    const savedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (!savedToken) {
      setAuthLoading(false);
      return;
    }
    void authenticate(savedToken);
  }, [authenticate]);

  async function handleConfigSave() {
    if (!token) {
      return;
    }

    const changes: Record<string, string> = {};
    for (const key of CONFIG_KEYS) {
      if (configForm[key] !== configInitial[key]) {
        changes[key] = configForm[key];
      }
    }

    if (Object.keys(changes).length === 0) {
      toast.info("No configuration changes to save.");
      return;
    }

    setConfigSaving(true);
    try {
      const nextConfig = await patchAdminConfig(changes);
      const normalized = normalizeConfig(nextConfig);
      setConfigInitial(normalized);
      setConfigForm(normalized);
      toast.success("System configuration updated.");
    } catch (error) {
      toast.error(`Config update failed: ${getErrorMessage(error)}`);
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!token) {
      return;
    }
    const recipient = testEmailTo.trim();
    if (!recipient) {
      toast.error("Please enter a recipient email.");
      return;
    }

    setTestEmailSending(true);
    try {
      await sendAdminTestEmail(recipient);
      toast.success("Test email sent.");
    } catch (error) {
      toast.error(`Test email failed: ${getErrorMessage(error)}`);
    } finally {
      setTestEmailSending(false);
    }
  }

  async function handleToggleUser(user: UserProfile) {
    if (!token) {
      return;
    }
    setUpdatingUserId(user.id);
    try {
      const updated = await patchAdminUser(user.id, {
        isActive: !user.isActive,
      });
      setUsers((prev) =>
        prev.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      toast.success(
        `${updated.email} is now ${updated.isActive ? "active" : "disabled"}.`,
      );
    } catch (error) {
      toast.error(`User update failed: ${getErrorMessage(error)}`);
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleResetPassword() {
    if (!token || !passwordUser) {
      return;
    }
    const nextPassword = newPassword.trim();
    if (nextPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setPasswordSaving(true);
    try {
      await patchAdminUser(passwordUser.id, { password: nextPassword });
      toast.success(`Password reset for ${passwordUser.email}.`);
      setPasswordUser(null);
      setNewPassword("");
    } catch (error) {
      toast.error(`Password reset failed: ${getErrorMessage(error)}`);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleCreateSchool() {
    if (!token) {
      return;
    }
    const name = newSchoolName.trim();
    if (!name) {
      toast.error("School name is required.");
      return;
    }

    setSchoolCreating(true);
    try {
      const created = await createAdminSchool(name);
      setSchools((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewSchoolName("");
      toast.success(`School "${created.name}" created.`);
    } catch (error) {
      toast.error(`Create school failed: ${getErrorMessage(error)}`);
    } finally {
      setSchoolCreating(false);
    }
  }

  async function handleDeleteSchool() {
    if (!token || !schoolToDelete) {
      return;
    }

    setSchoolDeletingId(schoolToDelete.id);
    try {
      await deleteAdminSchool(schoolToDelete.id);
      setSchools((prev) =>
        prev.filter((school) => school.id !== schoolToDelete.id),
      );
      toast.success(`School "${schoolToDelete.name}" deleted.`);
      setSchoolToDelete(null);
    } catch (error) {
      toast.error(`Delete school failed: ${getErrorMessage(error)}`);
    } finally {
      setSchoolDeletingId(null);
    }
  }

  async function handleCreateAnnouncement(
    publishMode: "immediate" | "delayed",
  ) {
    if (!token) return;
    const title = announcementTitle.trim();
    const content = announcementContent.trim();
    if (!title || !content) {
      toast.error("Title and content are required.");
      return;
    }

    setAnnouncementCreating(true);
    try {
      const created = await createAdminAnnouncement({
        title,
        content,
        publishMode,
      });
      setAnnouncements((prev) => [created, ...prev]);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      toast.success(
        publishMode === "immediate"
          ? "Announcement published. Notifications are being sent now."
          : "Announcement scheduled. Will publish in 10 minutes.",
      );
    } catch (error) {
      toast.error(`Create announcement failed: ${getErrorMessage(error)}`);
    } finally {
      setAnnouncementCreating(false);
    }
  }

  async function handleCancelAnnouncement(id: string) {
    if (!token) return;
    setCancellingId(id);
    try {
      const updated = await cancelAdminAnnouncement(id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
      toast.success("Announcement cancelled.");
    } catch (error) {
      toast.error(`Cancel failed: ${getErrorMessage(error)}`);
    } finally {
      setCancellingId(null);
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-2 p-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verifying admin session...</span>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Control Plane</CardTitle>
            <CardDescription>
              Enter ADMIN_TOKEN to access /admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-token">Admin Token</Label>
              <Input
                id="admin-token"
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Paste ADMIN_TOKEN"
              />
            </div>
            <Button
              className="w-full"
              disabled={authLoading || tokenInput.trim().length === 0}
              onClick={() => void authenticate(tokenInput.trim())}
            >
              {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col px-4 pb-8 sm:px-6 lg:px-8 xl:px-10">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AdminTab)}
        className="flex min-h-screen flex-col"
      >
        <header className="sticky top-0 z-20 flex flex-col gap-4 border-b bg-background/95 pb-4 pt-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin Control Plane
              </h1>
              <p className="text-sm text-muted-foreground">
                System operations and configuration.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Button variant="outline" onClick={clearSession}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-muted/70 p-1 md:hidden">
            {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="shrink-0 gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>

        <div className="grid flex-1 gap-6 py-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="sticky top-28 space-y-3">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Navigation
              </p>
              <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 rounded-xl bg-muted/70 p-2">
                {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="w-full justify-start gap-2 px-3 py-2 text-left"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                    {value === "config" && hasConfigChanges && (
                      <>
                        <span
                          className="ml-auto inline-block h-2 w-2 rounded-full bg-amber-500"
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          Configuration has unsaved changes
                        </span>
                      </>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </aside>

          <section
            className={cn(
              "min-w-0",
              activeTab === "config" && "pb-24 sm:pb-28",
            )}
          >
            <TabsContent value="config" className="mt-0 space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">System Configuration</h2>
                <p className="text-sm text-muted-foreground">
                  Edit grouped system keys and save only changed values.
                </p>
              </div>
              {dataLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading configuration...
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {CONFIG_GROUPS.map((group) => (
                  <Card key={group.title}>
                    <CardHeader>
                      <CardTitle className="text-base">{group.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {group.fields.map((field) => {
                        const provider = configForm["email.provider"] ?? "smtp";
                        const isSmtpField =
                          field.key.startsWith("smtp.") &&
                          field.key !== "email.provider";
                        const isCyberPanelField =
                          field.key.startsWith("cyberpanel.") &&
                          field.key !== "email.provider";
                        if (isSmtpField && provider !== "smtp") return null;
                        if (isCyberPanelField && provider !== "cyberpanel")
                          return null;

                        return (
                          <div key={field.key} className="space-y-2">
                            <Label htmlFor={field.key}>{field.label}</Label>
                            {field.key === "email.provider" ? (
                              <ToggleGroup
                                type="single"
                                variant="outline"
                                value={provider}
                                onValueChange={(value) => {
                                  if (value) {
                                    setConfigForm((prev) => ({
                                      ...prev,
                                      "email.provider": value,
                                    }));
                                  }
                                }}
                              >
                                <ToggleGroupItem value="smtp">
                                  SMTP
                                </ToggleGroupItem>
                                <ToggleGroupItem value="cyberpanel">
                                  CyberPanel
                                </ToggleGroupItem>
                              </ToggleGroup>
                            ) : field.key === "auth.registration_open" ? (
                              <div className="flex items-center gap-3">
                                <Switch
                                  id={field.key}
                                  checked={
                                    (
                                      configForm["auth.registration_open"] ??
                                      "true"
                                    ).toLowerCase() !== "false"
                                  }
                                  onCheckedChange={(checked) =>
                                    setConfigForm((prev) => ({
                                      ...prev,
                                      "auth.registration_open": checked
                                        ? "true"
                                        : "false",
                                    }))
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {configForm["auth.registration_open"] ===
                                  "false"
                                    ? "Closed"
                                    : "Open"}
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {field.type === "textarea" ? (
                                  <Textarea
                                    id={field.key}
                                    rows={6}
                                    placeholder={field.placeholder}
                                    value={configForm[field.key]}
                                    onChange={(event) =>
                                      setConfigForm((prev) => ({
                                        ...prev,
                                        [field.key]: event.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <Input
                                    id={field.key}
                                    type={field.type ?? "text"}
                                    placeholder={
                                      isSecretDisplayValue(
                                        field.key,
                                        configForm[field.key],
                                      )
                                        ? configForm[field.key] ===
                                          SECRET_REENTER
                                          ? "Re-enter and save a new value"
                                          : "Value saved and hidden"
                                        : field.placeholder
                                    }
                                    value={
                                      isSecretDisplayValue(
                                        field.key,
                                        configForm[field.key],
                                      )
                                        ? ""
                                        : configForm[field.key]
                                    }
                                    onChange={(event) =>
                                      setConfigForm((prev) => ({
                                        ...prev,
                                        [field.key]: event.target.value,
                                      }))
                                    }
                                  />
                                )}
                                {SECRET_CONFIG_KEYS.has(field.key) &&
                                  configInitial[field.key] ===
                                    SECRET_REENTER && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      Existing secret cannot be decrypted. Enter
                                      a new value to replace it.
                                    </p>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Object Storage (S3)</CardTitle>
                  <CardDescription>
                    Read-only status of the S3-compatible storage backend.
                    Configuration is set via environment variables.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {storageStatus ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Endpoint
                        </Label>
                        <p className="text-sm font-mono">
                          {storageStatus.endpoint}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Bucket
                        </Label>
                        <p className="text-sm font-mono">
                          {storageStatus.bucket}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          SSL
                        </Label>
                        <p className="text-sm">
                          {storageStatus.useSSL ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Region
                        </Label>
                        <p className="text-sm font-mono">
                          {storageStatus.region}
                        </p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">
                          Status
                        </Label>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-block h-2.5 w-2.5 rounded-full",
                              storageStatus.connected
                                ? "bg-green-500"
                                : "bg-red-500",
                            )}
                          />
                          <span className="text-sm">
                            {storageStatus.connected
                              ? "Connected"
                              : `Disconnected${storageStatus.error ? `: ${storageStatus.error}` : ""}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={storageChecking}
                    onClick={async () => {
                      if (!token) return;
                      setStorageChecking(true);
                      try {
                        const status = await getAdminStorageStatus();
                        setStorageStatus(status);
                        if (status.connected) {
                          toast.success("Storage connection OK.");
                        } else {
                          toast.error(
                            `Storage check failed: ${status.error ?? "unknown"}`,
                          );
                        }
                      } catch {
                        toast.error("Failed to check storage status.");
                      } finally {
                        setStorageChecking(false);
                      }
                    }}
                  >
                    {storageChecking && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Test Connection
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Test Email</CardTitle>
                  <CardDescription>
                    Send a test message using the currently selected email
                    provider.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={testEmailTo}
                    onChange={(event) => setTestEmailTo(event.target.value)}
                  />
                  <Button
                    onClick={() => void handleSendTestEmail()}
                    disabled={testEmailSending}
                  >
                    {testEmailSending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <Send className="h-4 w-4" />
                    Send Test
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Enable/disable users and reset passwords.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                      className="sm:max-w-sm"
                      placeholder="Search by email or nickname"
                      value={userQuery}
                      onChange={(event) => setUserQuery(event.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      {filteredUsers.length} users
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nickname</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.nickname ?? "-"}</TableCell>
                          <TableCell>{user.schoolName ?? "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={user.isActive ? "default" : "secondary"}
                            >
                              {user.isActive ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant={
                                  user.isActive ? "destructive" : "secondary"
                                }
                                disabled={updatingUserId === user.id}
                                onClick={() => void handleToggleUser(user)}
                              >
                                {updatingUserId === user.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {user.isActive ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPasswordUser(user);
                                  setNewPassword("");
                                }}
                              >
                                Reset Password
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schools" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>School Management</CardTitle>
                  <CardDescription>
                    Maintain the school list used by registration.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      placeholder="New school name"
                      value={newSchoolName}
                      onChange={(event) => setNewSchoolName(event.target.value)}
                    />
                    <Button
                      onClick={() => void handleCreateSchool()}
                      disabled={schoolCreating}
                    >
                      {schoolCreating && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Add School
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schools.map((school) => (
                        <TableRow key={school.id}>
                          <TableCell>{school.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {school.id}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setSchoolToDelete(school)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="announcements" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Site Announcements</CardTitle>
                  <CardDescription>
                    Broadcast notices to all users (maintenance, policy changes,
                    etc.). Choose immediate publish, or schedule with a
                    10-minute delay during which you can cancel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="ann-title">Title</Label>
                      <Input
                        id="ann-title"
                        placeholder="e.g. Scheduled maintenance on March 30"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ann-content">Content</Label>
                      <Textarea
                        id="ann-content"
                        rows={4}
                        placeholder="Notification body sent to all users..."
                        value={announcementContent}
                        onChange={(e) => setAnnouncementContent(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          void handleCreateAnnouncement("immediate")
                        }
                        disabled={announcementCreating}
                      >
                        {announcementCreating && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <Send className="h-4 w-4" />
                        Publish Now
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleCreateAnnouncement("delayed")}
                        disabled={announcementCreating}
                      >
                        {announcementCreating && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <Megaphone className="h-4 w-4" />
                        Schedule (10 min)
                      </Button>
                    </div>
                  </div>

                  {announcements.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Scheduled</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {announcements.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="max-w-[300px]">
                              <p className="truncate font-medium">{a.title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {a.content}
                              </p>
                            </TableCell>
                            <TableCell>
                              <AnnouncementStatusBadge announcement={a} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTime(a.scheduledAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {a.status === "SCHEDULED" ? (
                                <CountdownCancelButton
                                  scheduledAt={a.scheduledAt}
                                  cancelling={cancellingId === a.id}
                                  onCancel={() =>
                                    void handleCancelAnnouncement(a.id)
                                  }
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics" className="mt-0">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Runtime Metrics
                    </CardTitle>
                    <CardDescription>
                      In-memory snapshot from{" "}
                      <code className="font-mono text-xs">/admin/metrics</code>.
                      Request counts, status distribution, and per-route
                      p50/p95/p99 latency since process start. Resets on
                      restart.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshMetrics()}
                    disabled={metricsLoading || !token}
                  >
                    {metricsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!metrics ? (
                    <p className="text-sm text-muted-foreground">
                      No metrics snapshot loaded. Click Refresh to fetch.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MetricTile
                          label="Uptime"
                          value={formatUptime(metrics.uptime_s)}
                        />
                        <MetricTile
                          label="Total Requests"
                          value={metrics.requests_total.toLocaleString()}
                        />
                        <MetricTile
                          label="Error Rate"
                          value={formatErrorRate(metrics.requests_by_status)}
                          tone={
                            errorRateNumber(metrics.requests_by_status) > 0.01
                              ? "error"
                              : "normal"
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Status Distribution
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(metrics.requests_by_status)
                            .filter(([key]) => /^[1-5]xx$/.test(key))
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([bucket, count]) => (
                              <Badge
                                key={bucket}
                                variant="outline"
                                className={statusBucketClass(bucket)}
                              >
                                {bucket}: {count.toLocaleString()}
                              </Badge>
                            ))}
                          {Object.keys(metrics.requests_by_status).filter((k) =>
                            /^[1-5]xx$/.test(k),
                          ).length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              No requests recorded yet.
                            </span>
                          )}
                        </div>
                      </div>

                      {metrics.routes.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Route</TableHead>
                              <TableHead className="text-right">
                                Count
                              </TableHead>
                              <TableHead className="text-right">
                                Errors
                              </TableHead>
                              <TableHead className="text-right">
                                p50 (ms)
                              </TableHead>
                              <TableHead className="text-right">
                                p95 (ms)
                              </TableHead>
                              <TableHead className="text-right">
                                p99 (ms)
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...metrics.routes]
                              .sort((a, b) => b.count - a.count)
                              .map((r) => (
                                <TableRow key={r.route}>
                                  <TableCell className="font-mono text-xs">
                                    {r.route}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {r.count.toLocaleString()}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right",
                                      r.errors > 0 &&
                                        "font-semibold text-destructive",
                                    )}
                                  >
                                    {r.errors}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs">
                                    {r.p50_ms}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right font-mono text-xs",
                                      r.p95_ms > 500 &&
                                        "text-amber-600 dark:text-amber-400",
                                      r.p95_ms > 1000 && "text-destructive",
                                    )}
                                  >
                                    {r.p95_ms}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right font-mono text-xs",
                                      r.p99_ms > 1000 &&
                                        "font-semibold text-destructive",
                                    )}
                                  >
                                    {r.p99_ms}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No per-route samples yet. Make a few requests and
                          refresh.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="queue" className="mt-0">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      Job Queue
                    </CardTitle>
                    <CardDescription>
                      Live view of the{" "}
                      <code className="font-mono text-xs">
                        taskflow-notifications
                      </code>{" "}
                      BullMQ queue — delayed jobs, failures, and repeatable
                      schedules.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshQueue()}
                    disabled={queueLoading || !token}
                  >
                    {queueLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!queueStats ? (
                    <p className="text-sm text-muted-foreground">
                      No queue snapshot loaded. Click Refresh to fetch.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <MetricTile
                          label="Waiting"
                          value={String(queueStats.jobCounts.waiting ?? 0)}
                        />
                        <MetricTile
                          label="Active"
                          value={String(queueStats.jobCounts.active ?? 0)}
                        />
                        <MetricTile
                          label="Delayed"
                          value={String(queueStats.jobCounts.delayed ?? 0)}
                        />
                        <MetricTile
                          label="Failed"
                          value={String(queueStats.jobCounts.failed ?? 0)}
                          tone={
                            (queueStats.jobCounts.failed ?? 0) > 0
                              ? "error"
                              : "normal"
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Scheduled / Delayed Jobs
                        </Label>
                        {queueStats.delayedJobs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No delayed jobs pending.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Job Name</TableHead>
                                <TableHead>Runs At</TableHead>
                                <TableHead className="font-mono text-xs">
                                  Data
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queueStats.delayedJobs.map((j) => (
                                <TableRow key={j.id}>
                                  <TableCell className="font-mono text-xs">
                                    {j.name}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {formatDateTime(j.processAt)}
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                                    {JSON.stringify(j.data)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Failed Jobs
                        </Label>
                        {queueStats.failedJobs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No failed jobs.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Job Name</TableHead>
                                <TableHead>Error</TableHead>
                                <TableHead className="text-right">
                                  Attempts
                                </TableHead>
                                <TableHead>Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queueStats.failedJobs.map((j) => (
                                <TableRow key={j.id}>
                                  <TableCell className="font-mono text-xs">
                                    {j.name}
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate text-sm text-destructive">
                                    {j.failedReason ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {j.attemptsMade}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {formatDateTime(j.timestamp)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Repeatable / Cron Jobs
                        </Label>
                        {queueStats.repeatableJobs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No repeatable jobs registered.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Job Name</TableHead>
                                <TableHead>Cron Pattern</TableHead>
                                <TableHead>Next Run</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queueStats.repeatableJobs.map((r) => (
                                <TableRow key={r.key}>
                                  <TableCell className="font-mono text-xs">
                                    {r.name}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {r.pattern || "—"}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {r.next ? formatDateTime(r.next) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </section>
        </div>

        {activeTab === "config" && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex w-full items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
              {!hasConfigChanges && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  No unsaved configuration changes.
                </span>
              )}
              <Button
                onClick={() => void handleConfigSave()}
                disabled={configSaving}
              >
                {configSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </div>
        )}
      </Tabs>

      <Dialog
        open={Boolean(passwordUser)}
        onOpenChange={(open) => !open && setPasswordUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>{passwordUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New Password</Label>
            <Input
              id="reset-password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleResetPassword()}
              disabled={passwordSaving}
            >
              {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(schoolToDelete)}
        onOpenChange={(open) => !open && setSchoolToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              Delete school <strong>{schoolToDelete?.name}</strong>? Related
              user/class schoolId will become null.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={schoolDeletingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                schoolDeletingId !== null && "pointer-events-none opacity-70",
              )}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSchool();
              }}
            >
              {schoolDeletingId && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// ── Metrics Helpers ─────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "error";
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-2xl font-semibold",
          tone === "error" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${Math.floor(seconds % 60)}s`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function errorRateNumber(buckets: Record<string, number>): number {
  const total = Object.entries(buckets)
    .filter(([k]) => /^[1-5]xx$/.test(k))
    .reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return 0;
  const errors = (buckets["4xx"] ?? 0) + (buckets["5xx"] ?? 0);
  return errors / total;
}

function formatErrorRate(buckets: Record<string, number>): string {
  const rate = errorRateNumber(buckets);
  if (rate === 0) return "0%";
  return `${(rate * 100).toFixed(2)}%`;
}

function statusBucketClass(bucket: string): string {
  switch (bucket) {
    case "2xx":
      return "border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400";
    case "3xx":
      return "border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400";
    case "4xx":
      return "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
    case "5xx":
      return "border-destructive/50 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

// ── Announcement Sub-components ─────────────────────────────────────────────

function AnnouncementStatusBadge({
  announcement,
}: {
  announcement: AdminAnnouncement;
}) {
  const colorMap = {
    SCHEDULED:
      "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    PUBLISHED:
      "border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    CANCELLED: "border-border bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={colorMap[announcement.status]}>
      {announcement.status === "SCHEDULED"
        ? "Scheduled"
        : announcement.status === "PUBLISHED"
          ? "Published"
          : "Cancelled"}
    </Badge>
  );
}

function CountdownCancelButton({
  scheduledAt,
  cancelling,
  onCancel,
}: {
  scheduledAt: string;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const [remaining, setRemaining] = useState("");
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    function tick() {
      const diff = new Date(scheduledAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Publishing...");
        return;
      }
      const mins = Math.floor(diff / 60_000);
      const secs = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    }

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  if (cancelling) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="h-3 w-3 animate-spin" />
        Cancelling...
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant={hovered ? "destructive" : "outline"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onCancel}
    >
      {hovered ? (
        <>
          <X className="h-3 w-3" />
          Cancel
        </>
      ) : (
        <>Publishing in {remaining}</>
      )}
    </Button>
  );
}
