"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
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
import {
  ApiError,
  completeRegistration,
  listSchools,
  verifyToken,
} from "@/lib/api";

function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.length <= 64) return tz;
  } catch {
    // fallback
  }
  return "UTC";
}

function CompleteRegistrationInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const { setAuth } = useAuth();

  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const detectedTimezone = detectBrowserTimezone();

  useEffect(() => {
    if (!token) {
      setError("Missing verification token.");
      setVerifying(false);
      return;
    }

    verifyToken(token, "REGISTRATION")
      .then((res) => {
        if (res.valid) {
          setVerifiedEmail(res.email);
        } else {
          setError("This link is invalid or has expired.");
        }
      })
      .catch(() => {
        setError("This link is invalid or has expired.");
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const loadSchools = useCallback(async () => {
    try {
      const data = await listSchools();
      setSchools(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (verifiedEmail) {
      void loadSchools();
    }
  }, [verifiedEmail, loadSchools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !password) return;

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (schoolId && !studentId.trim()) {
      toast.error("Student ID is required when a school is selected");
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeRegistration({
        token,
        password,
        nickname: nickname || undefined,
        schoolId: schoolId || undefined,
        studentId: schoolId ? studentId : undefined,
        timezone: detectedTimezone,
      });
      setAuth(res.token, res.user);
      router.replace("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Registration failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (verifying) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">Link expired</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild variant="outline">
            <Link href="/register">Back to registration</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">Complete your account</CardTitle>
        <CardDescription>
          Set up your profile for <strong>{verifiedEmail}</strong>
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comp-password">Password</Label>
            <Input
              id="comp-password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-confirm-password">Confirm password</Label>
            <Input
              id="comp-confirm-password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-nickname">
              Nickname <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="comp-nickname"
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
                  <Label htmlFor="comp-studentId">Student ID</Label>
                  <Input
                    id="comp-studentId"
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
        <CardFooter>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function CompleteRegistrationPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </CardContent>
        </Card>
      }
    >
      <CompleteRegistrationInner />
    </Suspense>
  );
}
