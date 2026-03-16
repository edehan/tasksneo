"use client";

import { Loader2, LogOut, Moon, Send, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  type AdminSchool,
  ApiError,
  createAdminSchool,
  deleteAdminSchool,
  getAdminConfig,
  listAdminSchools,
  listAdminUsers,
  patchAdminConfig,
  patchAdminUser,
  sendAdminTestEmail,
  type UserProfile,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const ADMIN_TOKEN_STORAGE_KEY = "taskflow_admin_token";

const CONFIG_DEFAULTS = {
  "app.title": "",
  "app.base_url": "",
  "auth.registration_open": "true",
  "notif.before_due_hours": "",
  "smtp.host": "",
  "smtp.port": "",
  "smtp.user": "",
  "smtp.password": "",
  "smtp.from": "",
  "llm.provider": "",
  "llm.base_url": "",
  "llm.api_key": "",
  "llm.model": "",
};

type ConfigKey = keyof typeof CONFIG_DEFAULTS;
type ConfigState = Record<ConfigKey, string>;

interface Notice {
  tone: "success" | "error" | "info";
  message: string;
}

interface ConfigField {
  key: ConfigKey;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
}

const CONFIG_GROUPS: Array<{ title: string; fields: ConfigField[] }> = [
  {
    title: "App",
    fields: [
      { key: "app.title", label: "Site Title", placeholder: "TaskFlow" },
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
    title: "SMTP",
    fields: [
      { key: "smtp.host", label: "SMTP Host", placeholder: "smtp.example.com" },
      { key: "smtp.port", label: "SMTP Port", placeholder: "587" },
      { key: "smtp.user", label: "SMTP User" },
      { key: "smtp.password", label: "SMTP Password", type: "password" },
      {
        key: "smtp.from",
        label: "SMTP From",
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
    ],
  },
];

const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];

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

export function AdminControlPlane() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  const { resolvedTheme, setTheme } = useTheme();

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

  const loadAdminData = useCallback(async (adminToken: string) => {
    setDataLoading(true);
    try {
      const [config, adminUsers, adminSchools] = await Promise.all([
        getAdminConfig(adminToken),
        listAdminUsers(adminToken),
        listAdminSchools(adminToken),
      ]);

      const normalized = normalizeConfig(config);
      setConfigInitial(normalized);
      setConfigForm(normalized);
      setUsers(adminUsers);
      setSchools(adminSchools);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const authenticate = useCallback(
    async (nextToken: string) => {
      setAuthLoading(true);
      try {
        await loadAdminData(nextToken);
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, nextToken);
        setToken(nextToken);
        setTokenInput("");
        setNotice({ tone: "success", message: "Admin token verified." });
      } catch (error) {
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        setToken(null);
        setNotice({
          tone: "error",
          message: `Authentication failed: ${getErrorMessage(error)}`,
        });
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
    setNotice({ tone: "info", message: "Admin token cleared." });
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
      setNotice({ tone: "info", message: "No configuration changes to save." });
      return;
    }

    setConfigSaving(true);
    try {
      const nextConfig = await patchAdminConfig(token, changes);
      const normalized = normalizeConfig(nextConfig);
      setConfigInitial(normalized);
      setConfigForm(normalized);
      setNotice({ tone: "success", message: "System configuration updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: `Config update failed: ${getErrorMessage(error)}`,
      });
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
      setNotice({ tone: "error", message: "Please enter a recipient email." });
      return;
    }

    setTestEmailSending(true);
    try {
      await sendAdminTestEmail(token, recipient);
      setNotice({ tone: "success", message: "Test email sent." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: `Test email failed: ${getErrorMessage(error)}`,
      });
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
      const updated = await patchAdminUser(token, user.id, {
        isActive: !user.isActive,
      });
      setUsers((prev) =>
        prev.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      setNotice({
        tone: "success",
        message: `${updated.email} is now ${updated.isActive ? "active" : "disabled"}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: `User update failed: ${getErrorMessage(error)}`,
      });
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
      setNotice({
        tone: "error",
        message: "Password must be at least 8 characters.",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await patchAdminUser(token, passwordUser.id, { password: nextPassword });
      setNotice({
        tone: "success",
        message: `Password reset for ${passwordUser.email}.`,
      });
      setPasswordUser(null);
      setNewPassword("");
    } catch (error) {
      setNotice({
        tone: "error",
        message: `Password reset failed: ${getErrorMessage(error)}`,
      });
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
      setNotice({ tone: "error", message: "School name is required." });
      return;
    }

    setSchoolCreating(true);
    try {
      const created = await createAdminSchool(token, name);
      setSchools((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewSchoolName("");
      setNotice({
        tone: "success",
        message: `School "${created.name}" created.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: `Create school failed: ${getErrorMessage(error)}`,
      });
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
      await deleteAdminSchool(token, schoolToDelete.id);
      setSchools((prev) =>
        prev.filter((school) => school.id !== schoolToDelete.id),
      );
      setNotice({
        tone: "success",
        message: `School "${schoolToDelete.name}" deleted.`,
      });
      setSchoolToDelete(null);
    } catch (error) {
      setNotice({
        tone: "error",
        message: `Delete school failed: ${getErrorMessage(error)}`,
      });
    } finally {
      setSchoolDeletingId(null);
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
            {notice && (
              <p
                className={cn(
                  "text-sm",
                  notice.tone === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {notice.message}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin Control Plane
          </h1>
          <p className="text-sm text-muted-foreground">
            Simple and utilitarian panel for system operations.
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
      </header>

      {notice && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            notice.tone === "error" && "border-destructive/50 text-destructive",
            notice.tone === "success" &&
              "border-green-500/40 text-green-700 dark:text-green-400",
            notice.tone === "info" && "border-border text-muted-foreground",
          )}
        >
          {notice.message}
        </div>
      )}

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="schools">Schools</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Edit grouped system keys and save only changed values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      {group.fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          {field.key === "auth.registration_open" ? (
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
                            <Input
                              id={field.key}
                              type={field.type ?? "text"}
                              placeholder={field.placeholder}
                              value={configForm[field.key]}
                              onChange={(event) =>
                                setConfigForm((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button
                onClick={() => void handleConfigSave()}
                disabled={configSaving}
              >
                {configSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMTP Test Email</CardTitle>
              <CardDescription>
                Send a test message using current SMTP settings.
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

        <TabsContent value="users">
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
                      <TableCell>{formatDateTime(user.createdAt)}</TableCell>
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

        <TabsContent value="schools">
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
