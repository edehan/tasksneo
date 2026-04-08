"use client";

import { Loader2, Reply, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import type { TaskComment } from "@/lib/api";
import { createTaskComment, listTaskComments } from "@/lib/api";

interface CommentSectionProps {
  taskId: string;
  accentColor?: string;
}

function formatRelativeTime(dateStr: string, justNowLabel: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return justNowLabel;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  return `${Math.floor(months / 12)}y`;
}

export function CommentSection({ taskId, accentColor }: CommentSectionProps) {
  const t = useTranslations("commentSection");
  const { token, user } = useAuth();
  const accent = accentColor ?? "var(--class-accent)";

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<{
    id: string;
    nickname: string | null;
  } | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch comments on mount
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    listTaskComments(token, taskId)
      .then((data) => {
        setComments(data);
        // Scroll to bottom after render
        setTimeout(() => scrollToBottom(), 100);
      })
      .catch(() => toast.error(t("failedToLoad")))
      .finally(() => setLoading(false));
  }, [token, taskId, t, scrollToBottom]);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || !token || !user) return;

    setSending(true);
    try {
      const comment = await createTaskComment(
        token,
        taskId,
        trimmed,
        replyTo?.id,
      );
      setComments((prev) => [...prev, comment]);
      setContent("");
      setReplyTo(null);
      setTimeout(() => scrollToBottom(), 50);
    } catch {
      toast.error(t("failedToSend"));
    } finally {
      setSending(false);
    }
  }

  function handleReply(author: TaskComment["author"]) {
    if (!author) return;
    setReplyTo({ id: author.id, nickname: author.nickname });
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <span className="text-label-upper">{t("title")}</span>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-muted-foreground">
            {t("noComments")}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                accentColor={accent}
                onReply={() => handleReply(comment.author)}
                justNowLabel={t("justNow")}
                replyLabel={t("reply")}
                deletedUserLabel={t("deletedUser")}
              />
            ))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Reply size={12} strokeWidth={2} />
            <span>
              {t("replyingTo", {
                name: replyTo.nickname ?? t("deletedUser"),
              })}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-auto rounded p-0.5 hover:bg-secondary"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            type="button"
            disabled={!content.trim() || sending}
            onClick={() => void handleSend()}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            {sending ? (
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
            ) : (
              <Send size={15} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comment card ────────────────────────────────────────────────────────────

interface CommentCardProps {
  comment: TaskComment;
  accentColor: string;
  onReply: () => void;
  justNowLabel: string;
  replyLabel: string;
  deletedUserLabel: string;
}

function CommentCard({
  comment,
  accentColor,
  onReply,
  justNowLabel,
  replyLabel,
  deletedUserLabel,
}: CommentCardProps) {
  const authorName = comment.author?.nickname ?? deletedUserLabel;
  const replyToName = comment.replyTo?.nickname ?? deletedUserLabel;

  return (
    <div className="group rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50">
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <UserAvatar
          avatarHash={comment.author?.avatarHash}
          name={comment.author?.nickname}
          className="h-6 w-6 shrink-0"
          fallbackClassName="text-[10px]"
          size={48}
        />

        <div className="min-w-0 flex-1">
          {/* Name + time + reply button */}
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold text-foreground">
              {authorName}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {formatRelativeTime(comment.createdAt, justNowLabel)}
            </span>
            {comment.author && (
              <button
                type="button"
                onClick={onReply}
                className="ml-auto text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                {replyLabel}
              </button>
            )}
          </div>

          {/* Reply indicator */}
          {comment.replyTo && (
            <span
              className="text-[12px] font-medium"
              style={{ color: accentColor }}
            >
              @{replyToName}{" "}
            </span>
          )}

          {/* Content */}
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
            {comment.content}
          </p>
        </div>
      </div>
    </div>
  );
}
