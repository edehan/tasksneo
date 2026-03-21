"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setError("邮箱或密码错误");
        } else if (err.code === "USER_INACTIVE") {
          setError("账号已被停用");
        } else {
          setError(err.message);
        }
      } else {
        setError("登录失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="taskflow-surface p-8">
      <h1 className="text-[30px] font-bold">欢迎回来</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        登录后进入任务面板
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="taskflow-label" htmlFor="login-email">
            邮箱
          </label>
          <input
            id="login-email"
            className="taskflow-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="taskflow-label" htmlFor="login-password">
            密码
          </label>
          <input
            id="login-password"
            className="taskflow-input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <p className="taskflow-error">{error}</p> : null}

        <button
          type="submit"
          className="taskflow-btn taskflow-btn-primary h-10 w-full"
          disabled={submitting}
        >
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>

      <p className="mt-5 text-sm text-[var(--text-secondary)]">
        没有账号？
        <Link
          className="ml-1 font-semibold text-[var(--class-accent)]"
          href="/register"
        >
          立即注册
        </Link>
      </p>
    </div>
  );
}
