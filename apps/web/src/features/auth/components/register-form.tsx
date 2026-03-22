"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { School } from "@/lib/api";
import { ApiError, listSchools } from "@/lib/api";

function detectBrowserTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone && timezone.length <= 64) {
      return timezone;
    }
  } catch {
    // Fall back to UTC when browser timezone is unavailable.
  }

  return "UTC";
}

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const detectedTimezone = detectBrowserTimezone();

  const loadSchools = useCallback(async () => {
    try {
      const data = await listSchools();
      setSchools(data);
    } catch {
      // Non-critical, school selection is optional
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    if (schoolId && !studentId.trim()) {
      toast.error("Student ID is required when a school is selected");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email,
        password,
        nickname: nickname || undefined,
        schoolId: schoolId || undefined,
        studentId: schoolId ? studentId : undefined,
        timezone: detectedTimezone,
      });
      router.replace("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Registration failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">Create an account</CardTitle>
        <CardDescription>Get started with TaskFlow</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-nickname">
              Nickname <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="reg-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="How others will see you"
            />
          </div>
          {schools.length > 0 && (
            <>
              <div className="space-y-2">
                <Label>
                  School{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Select
                  value={schoolId ?? "none"}
                  onValueChange={(v) => {
                    setSchoolId(v === "none" ? null : v);
                    if (v === "none") setStudentId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a school" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No school</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {schoolId && (
                <div className="space-y-2">
                  <Label htmlFor="reg-studentId">Student ID</Label>
                  <Input
                    id="reg-studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    placeholder="Your student number"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
