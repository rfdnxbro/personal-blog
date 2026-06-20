import "server-only";

import { Hono } from "hono";

// Hono 骨格の動作確認用 dummy route。Stage 1 で実機能 route が増えても残す。
const health = new Hono().get("/", (c) => c.json({ status: "ok" }));

export default health;
