import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Page", () => {
  it("renders the blog heading", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "blog" })).toBeInTheDocument();
  });
});
