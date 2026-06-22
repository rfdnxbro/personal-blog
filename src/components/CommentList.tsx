export type CommentListItem = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type CommentListProps = {
  comments: ReadonlyArray<CommentListItem>;
};

// コメント本文は plain text + 改行のみ。Markdown 描画しない (rules/components.md)。
// 改行で split して <p> を並べる。React の自動エスケープのみで XSS 対策とする。
export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return <p data-testid="comment-list-empty">まだコメントはありません。</p>;
  }
  return (
    <ul data-testid="comment-list">
      {comments.map((c) => (
        <li key={c.id}>
          <div>
            <strong>{c.author_name}</strong>
            <time dateTime={c.created_at}>{c.created_at}</time>
          </div>
          <div>
            {c.body.split("\n").map((line, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 同一 body 内の段落は順序が key
              <p key={idx}>{line}</p>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
