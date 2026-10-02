import { render, screen } from "@testing-library/react";
import Home from "../../app/page";

describe("Home", () => {
  it("renders the homepage with an accessible heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });

  it("provides a link to the Next.js documentation", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: "Documentation" }),
    ).toHaveAttribute("href", expect.stringMatching(/^https:\/\/nextjs\.org\/docs(?:\?|$)/));
  });
});
