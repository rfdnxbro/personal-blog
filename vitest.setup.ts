import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// `server-only` は jsdom 環境では import 時に Client Component module 扱いで throw する。
// テストでは Server / Client の境界を踏まないので空モジュール扱いにする。
vi.mock("server-only", () => ({}));
