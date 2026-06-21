import "server-only";

import { Hono } from "hono";
import { csrfMiddleware } from "./middleware/csrf";
import { type SessionVars, sessionMiddleware } from "./middleware/session";
import routes from "./routes";

export type AppEnv = { Variables: SessionVars };

export const app = new Hono<AppEnv>().basePath("/api");

// CSRF / Origin 検証は state-changing パスで実質的に効く (GET 系は素通り)。
// rules/api.md 「Origin / CSRF 検証」要件のため全パスに通す。
app.use("*", csrfMiddleware);

// 構造化ログ (1 行 JSON、Vercel Runtime Logs で grep しやすい形式)。
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  console.log(
    JSON.stringify({
      level: "info",
      msg: "request",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: Date.now() - start,
    }),
  );
});

app.use("*", sessionMiddleware);

app.route("/", routes);
