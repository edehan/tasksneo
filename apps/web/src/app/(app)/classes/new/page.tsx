"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { School } from "@/lib/api";
import { ApiError, createClass, listSchools } from "@/lib/api";

const CLASS_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#f97316", label: "Orange" },
];

export default function CreateClassPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CLASS_COLORS[0].value);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    try {
      const data = await listSchools();
      setSchools(data);
    } catch {
      // Non-critical — school restriction is optional
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const cls = await createClass(token, {
        name: name.trim(),
        description: description.trim() || null,
        color,
        schoolId,
      });
      toast.success(`Class "${cls.name}" created`);
      router.push(`/classes/${cls.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create class. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader title="Create Class" />
      <div className="mx-auto max-w-160 p-6 space-y-6">
        <PageHeader
          title="Create a class"
          description="Set up a new class for your students"
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="class-name">
              Class name <span className="text-status-error">*</span>
            </Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Algorithm Design 2026 Spring"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="class-desc">Description</Label>
            <Textarea
              id="class-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for your class"
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                >
                  {color === c.value && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* School restriction */}
          {schools.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="class-school">School restriction</Label>
              <Select
                value={schoolId ?? "none"}
                onValueChange={(v) => setSchoolId(v === "none" ? null : v)}
              >
                <SelectTrigger id="class-school">
                  <SelectValue placeholder="No restriction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No restriction</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If set, only students from this school can join.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-status-error">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create class
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
