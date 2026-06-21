import "server-only";

import { Hono } from "hono";
import health from "./health";

// 全 route のバレル登録。新規 route 追加 PR ではここに 1 行 import + .route() を足す
// (app.ts は触らない、rules/api.md 「Hono の構成」要件)。
const routes = new Hono().route("/health", health);

export default routes;
