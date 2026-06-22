"use client";

import Script from "next/script";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

const BODY_MAX = 2000;
const AUTHOR_MAX = 50;
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      reset: (widgetId?: string) => void;
    };
  }
}

export type CommentFormProps = {
  postId: string;
  // Turnstile site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY)。
  // 親 Server Component で process.env から読んで props に流す。
  turnstileSiteKey: string;
};

type SubmitState = "idle" | "submitting" | "ok" | "error";

// 匿名コメント投稿フォーム。Turnstile widget + honeypot + 残文字カウンタ + 送信状態。
// Markdown は使わせない (plain text + 改行のみ、rules/components.md)。
export function CommentForm({ postId, turnstileSiteKey }: CommentFormProps) {
  const authorId = useId();
  const bodyId = useId();
  const websiteId = useId();
  const turnstileFieldId = useId();
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 送信成功後 Turnstile widget を reset (再投稿時に新しいトークンを得るため)
  useEffect(() => {
    if (state === "ok" && typeof window !== "undefined" && window.turnstile) {
      window.turnstile.reset();
    }
  }, [state]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setState("submitting");

    const formData = new FormData(e.currentTarget);
    const tokenRaw = formData.get("cf-turnstile-response");
    const websiteRaw = formData.get("website");
    const payload = {
      author_name: authorName,
      body,
      turnstileToken: typeof tokenRaw === "string" ? tokenRaw : "",
      website: typeof websiteRaw === "string" ? websiteRaw : "",
    };

    try {
      const res = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setState("error");
        setErrorMsg(
          res.status === 429
            ? "送信回数が多すぎます。少し時間を置いてください。"
            : "送信に失敗しました。入力内容を確認してください。",
        );
        return;
      }
      setState("ok");
      setAuthorName("");
      setBody("");
    } catch {
      setState("error");
      setErrorMsg("ネットワークエラーが発生しました。");
    }
  }

  const remaining = BODY_MAX - body.length;

  return (
    <>
      <Script src={TURNSTILE_SCRIPT_SRC} strategy="afterInteractive" async />
      <form onSubmit={handleSubmit} aria-label="コメント投稿">
        <div>
          <label htmlFor={authorId}>お名前</label>
          <input
            id={authorId}
            name="author_name"
            type="text"
            required
            maxLength={AUTHOR_MAX}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor={bodyId}>コメント</label>
          <textarea
            id={bodyId}
            name="body"
            required
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p aria-live="polite" data-testid="char-counter">
            残り {remaining} 文字
          </p>
        </div>

        {/* honeypot: 通常ユーザーには見えない。bot が自動入力したら server 側で silent drop。
           label と aria-hidden を併用、display:none + tabIndex=-1 で誤入力も防ぐ。 */}
        <div
          aria-hidden="true"
          style={{ display: "none" }}
          data-testid="honeypot"
        >
          <label htmlFor={websiteId}>Website (do not fill)</label>
          <input
            id={websiteId}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        <div
          id={turnstileFieldId}
          ref={widgetRef}
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey}
          data-testid="turnstile-widget"
        />

        <button type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "送信中…" : "コメントする"}
        </button>

        {state === "ok" ? <p role="status">コメントを送信しました。</p> : null}
        {state === "error" && errorMsg ? <p role="alert">{errorMsg}</p> : null}
      </form>
    </>
  );
}
