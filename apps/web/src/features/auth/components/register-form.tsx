"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiError, listSchools, type School } from "@/lib/api";

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [studentId, setStudentId] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    studentId?: string;
    form?: string;
  }>({});
  const [registrationClosed, setRegistrationClosed] = useState(false);

  const timezone = useMemo(() => getTimezone(), []);
  const studentRequired = Boolean(schoolId);

  useEffect(() => {
    let active = true;
    void listSchools()
      .then((res) => {
        if (active) {
          setSchools(res);
        }
      })
      .catch(() => {
        if (active) {
          setSchools([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: { email?: string; studentId?: string } = {};
    if (studentRequired && !studentId.trim()) {
      nextErrors.studentId = "选择学校后，学号必填";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      await register({
        email,
        password,
        nickname: nickname || undefined,
        schoolId: schoolId || null,
        studentId: schoolId ? studentId : null,
        timezone,
      });
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "REGISTRATION_CLOSED") {
          setRegistrationClosed(true);
        } else if (err.code === "EMAIL_EXISTS") {
          setErrors({ email: "此邮箱已被注册" });
        } else if (
          err.code === "STUDENT_ID_EXISTS" ||
          err.code === "CONFLICT"
        ) {
          setErrors({ studentId: "此学校下该学号已存在" });
        } else {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: "注册失败，请稍后重试" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (registrationClosed) {
    return (
      <div className="taskflow-surface p-8 text-center">
        <h1 className="text-[30px] font-bold">创建账号</h1>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          注册功能当前未开放
        </p>
        <p className="mt-6 text-sm text-[var(--text-secondary)]">
          已有账号？
          <Link
            className="ml-1 font-semibold text-[var(--class-accent)]"
            href="/login"
          >
            去登录
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="taskflow-surface p-8">
      <h1 className="text-[30px] font-bold">创建账号</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        注册后将自动创建你的个人空间
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="taskflow-label" htmlFor="register-email">
            邮箱
          </label>
          <input
            id="register-email"
            className="taskflow-input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email ? (
            <p className="taskflow-error">{errors.email}</p>
          ) : null}
        </div>

        <div>
          <label className="taskflow-label" htmlFor="register-password">
            密码
          </label>
          <input
            id="register-password"
            className="taskflow-input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="至少 8 位"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div>
          <label className="taskflow-label" htmlFor="register-nickname">
            昵称（选填）
          </label>
          <input
            id="register-nickname"
            className="taskflow-input"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="留空则使用邮箱展示"
          />
        </div>

        <div>
          <label className="taskflow-label" htmlFor="register-school">
            学校（选填）
          </label>
          <select
            id="register-school"
            className="taskflow-select"
            value={schoolId || "none"}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "none") {
                setSchoolId("");
                setStudentId("");
              } else {
                setSchoolId(value);
              }
            }}
          >
            <option value="none">不填写</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="taskflow-label" htmlFor="register-student-id">
            学号
            {studentRequired ? (
              <span className="ml-1 text-[#c45c5c]">*</span>
            ) : null}
          </label>
          <input
            id="register-student-id"
            className="taskflow-input"
            disabled={!studentRequired}
            required={studentRequired}
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder={studentRequired ? "请输入学号" : "选择学校后可填写"}
            style={!studentRequired ? { opacity: 0.6 } : undefined}
          />
          {errors.studentId ? (
            <p className="taskflow-error">{errors.studentId}</p>
          ) : null}
        </div>

        {errors.form ? <p className="taskflow-error">{errors.form}</p> : null}

        <button
          type="submit"
          className="taskflow-btn taskflow-btn-primary h-10 w-full"
          disabled={submitting}
        >
          {submitting ? "注册中..." : "注册"}
        </button>
      </form>

      <p className="mt-5 text-sm text-[var(--text-secondary)]">
        已有账号？
        <Link
          className="ml-1 font-semibold text-[var(--class-accent)]"
          href="/login"
        >
          登录
        </Link>
      </p>
    </div>
  );
}
