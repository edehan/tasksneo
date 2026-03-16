'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  apiRequest,
  type AuthResponse,
  type ClassMember,
  type ClassSummary,
  type UserProfile,
} from '../lib/api';

const STORAGE_KEY = 'taskflow_demo_token';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [notice, setNotice] = useState<string>('Ready');

  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('Passw0rd!');
  const [registerNickname, setRegisterNickname] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('Passw0rd!');

  const [newClassName, setNewClassName] = useState('Physics 101');
  const [newClassDescription, setNewClassDescription] = useState('Week 1 tasks');
  const [newClassColor, setNewClassColor] = useState('#0f766e');
  const [joinInviteCode, setJoinInviteCode] = useState('');

  const hasToken = useMemo(() => Boolean(token), [token]);

  function updateSession(nextToken: string | null) {
    setToken(nextToken);

    if (nextToken) {
      localStorage.setItem(STORAGE_KEY, nextToken);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async function loadMe(currentToken: string) {
    const profile = await apiRequest<UserProfile>('/users/me', {}, currentToken);
    setMe(profile);
  }

  async function loadClasses(currentToken: string) {
    const list = await apiRequest<ClassSummary[]>('/classes', {}, currentToken);
    setClasses(list);
  }

  async function reloadProtectedData(currentToken: string) {
    await Promise.all([loadMe(currentToken), loadClasses(currentToken)]);
  }

  async function onRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('Registering...');

    try {
      const payload = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          nickname: registerNickname || undefined,
        }),
      });

      updateSession(payload.token);
      setLoginEmail(payload.user.email);
      await reloadProtectedData(payload.token);
      setNotice(`Registered: ${payload.user.email}`);
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('Logging in...');

    try {
      const payload = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      updateSession(payload.token);
      await reloadProtectedData(payload.token);
      setNotice(`Logged in: ${payload.user.email}`);
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  async function onCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setNotice('Please login first');
      return;
    }

    setNotice('Creating class...');

    try {
      await apiRequest<ClassSummary>(
        '/classes',
        {
          method: 'POST',
          body: JSON.stringify({
            name: newClassName,
            description: newClassDescription,
            color: newClassColor,
          }),
        },
        token,
      );

      await loadClasses(token);
      setNotice('Class created');
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  async function onJoinClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setNotice('Please login first');
      return;
    }

    setNotice('Joining class...');

    try {
      await apiRequest<ClassSummary>(
        '/classes/join',
        {
          method: 'POST',
          body: JSON.stringify({
            inviteCode: joinInviteCode,
          }),
        },
        token,
      );

      await loadClasses(token);
      setJoinInviteCode('');
      setNotice('Joined class');
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  async function onLoadMembers() {
    if (!token || !selectedClassId) {
      setNotice('Select a class first');
      return;
    }

    setNotice('Loading members...');

    try {
      const data = await apiRequest<ClassMember[]>(`/classes/${selectedClassId}/members`, {}, token);
      setMembers(data);
      setNotice('Members loaded');
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  async function onRefreshMe() {
    if (!token) {
      setNotice('Please login first');
      return;
    }

    try {
      await loadMe(token);
      setNotice('Profile refreshed');
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  async function onRefreshClasses() {
    if (!token) {
      setNotice('Please login first');
      return;
    }

    try {
      await loadClasses(token);
      setNotice('Classes refreshed');
    } catch (error) {
      setNotice(extractErrorMessage(error));
    }
  }

  function onLogout() {
    updateSession(null);
    setMe(null);
    setClasses([]);
    setMembers([]);
    setSelectedClassId('');
    setNotice('Logged out');
  }

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY);

    if (!storedToken) {
      return;
    }

    updateSession(storedToken);
    void reloadProtectedData(storedToken).catch((error) => {
      setNotice(extractErrorMessage(error));
      updateSession(null);
    });
  }, []);

  return (
    <main className="demo-root">
      <section className="hero">
        <h1>TaskFlow Live Demo</h1>
        <p>注册 / 登录 / 班级创建与加入的最小展示页</p>
        <div className="notice">{notice}</div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Auth</h2>
          <form onSubmit={onRegister} className="stack">
            <label>
              Register Email
              <input value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required />
            </label>
            <label>
              Register Password
              <input
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                minLength={8}
                type="password"
                required
              />
            </label>
            <label>
              Register Nickname
              <input value={registerNickname} onChange={(e) => setRegisterNickname(e.target.value)} />
            </label>
            <button type="submit">Register</button>
          </form>

          <form onSubmit={onLogin} className="stack top-gap">
            <label>
              Login Email
              <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            </label>
            <label>
              Login Password
              <input
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                type="password"
                required
              />
            </label>
            <button type="submit">Login</button>
          </form>

          <div className="actions top-gap">
            <button onClick={onRefreshMe} disabled={!hasToken}>
              Refresh /users/me
            </button>
            <button onClick={onLogout} disabled={!hasToken}>
              Logout
            </button>
          </div>

          <pre>{me ? JSON.stringify(me, null, 2) : 'No user loaded'}</pre>
        </article>

        <article className="card">
          <h2>Classes</h2>
          <form onSubmit={onCreateClass} className="stack">
            <label>
              Class Name
              <input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required />
            </label>
            <label>
              Description
              <input value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} />
            </label>
            <label>
              Color
              <input value={newClassColor} onChange={(e) => setNewClassColor(e.target.value)} />
            </label>
            <button type="submit" disabled={!hasToken}>
              Create Class
            </button>
          </form>

          <form onSubmit={onJoinClass} className="stack top-gap">
            <label>
              Invite Code
              <input value={joinInviteCode} onChange={(e) => setJoinInviteCode(e.target.value)} required />
            </label>
            <button type="submit" disabled={!hasToken}>
              Join Class
            </button>
          </form>

          <div className="actions top-gap">
            <button onClick={onRefreshClasses} disabled={!hasToken}>
              Refresh /classes
            </button>
          </div>

          <label className="top-gap">
            Select Class For Members
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">-- pick one --</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.myRole})
                </option>
              ))}
            </select>
          </label>

          <button onClick={onLoadMembers} disabled={!hasToken || !selectedClassId} className="top-gap">
            Load Members
          </button>

          <pre>{classes.length > 0 ? JSON.stringify(classes, null, 2) : 'No classes loaded'}</pre>
          <pre>{members.length > 0 ? JSON.stringify(members, null, 2) : 'No members loaded'}</pre>
        </article>
      </section>
    </main>
  );
}
