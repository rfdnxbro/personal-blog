import "server-only";

import { Hono } from "hono";
import comments from "./comments";
import editors from "./editors";
import health from "./health";
import posts from "./posts";

// 全 route のバレル登録。新規 route 追加 PR ではここに 1 行 import + .route() を足す
// (app.ts は触らない、rules/api.md 「Hono の構成」要件)。
const routes = new Hono()
  .route("/health", health)
  .route("/posts", posts)
  .route("/editors", editors)
  .route("/comments", comments);

export default routes;
