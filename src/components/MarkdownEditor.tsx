"use client";

import { useEffect, useState } from "react";

export type MarkdownEditorProps = {
  name?: string;
  defaultValue?: string;
  id?: string;
};

// textarea + ライブプレビューの簡易エディタ。プレビュー HTML は server action ではなく、
// 既存の Markdown サニタイズパイプラインを通すための小さい API (/api/preview/markdown) を
// 叩く想定だが、現段階では textarea の生 Markdown を改行 → <br/> でエスケープ表示する
// 簡易プレビューに留める (XSS 表面積を増やさない、rules/components.md 「コメントは plain text」
// と同じ原則を踏襲)。本格プレビューは別 PR で API を足して接続する。
export default function MarkdownEditor({
  name = "content_md",
  defaultValue = "",
  id,
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [debounced, setDebounced] = useState(defaultValue);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), 200);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Markdown</span>
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[20rem] w-full rounded border border-gray-300 p-2 font-mono text-sm"
        />
      </label>
      <section
        aria-label="preview"
        className="min-h-[20rem] rounded border border-gray-200 p-2 text-sm"
      >
        {debounced.split("\n").map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 行プレビューは index ベースで十分
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        ))}
      </section>
    </div>
  );
}
