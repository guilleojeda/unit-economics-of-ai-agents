import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, test } from "vitest";
import { FixtureProvider } from "./fixture-context";
import {
  ComparisonPageContent,
  DocumentsPageContent,
  EvaluationPageContent,
  JobDetailPageContent,
  LedgerPageContent
} from "./views";

function renderWithFixtures(component: ReactNode) {
  return render(<FixtureProvider>{component}</FixtureProvider>);
}

describe("fixture-backed product views", () => {
  test("shows the controlled Spanish PDF in the document library", () => {
    renderWithFixtures(<DocumentsPageContent />);

    expect(screen.getByRole("heading", { name: "Documents" })).toBeDefined();
    expect(screen.getByText("Procedimiento de Reembolsos y Elegibilidad")).toBeDefined();
    expect(screen.getByText("procedimiento-reembolsos-elegibilidad.pdf")).toBeDefined();
    expect(screen.getByText("Latest full workflow cost")).toBeDefined();
  });

  test("shows LLM-only cost separately from full workflow cost in the ledger", () => {
    renderWithFixtures(<LedgerPageContent jobId="job_v1" runId="run_v1" />);

    expect(screen.getByRole("heading", { name: "Cost Ledger" })).toBeDefined();
    expect(screen.getByText("LedgerItems are the source of truth for economics.")).toBeDefined();
    expect(screen.getByText("LLM-only cost")).toBeDefined();
    expect(screen.getAllByText("$1.20").length).toBeGreaterThan(0);
    expect(screen.getByText("Full workflow cost")).toBeDefined();
    expect(screen.getByText("$1.55")).toBeDefined();
    expect(screen.getByText("Non-model cost")).toBeDefined();
    expect(screen.getAllByText("$0.35").length).toBeGreaterThan(0);
  });

  test("accepting an awaiting-review run adds human review cost and job margin", async () => {
    const user = userEvent.setup();

    render(
      <FixtureProvider>
        <EvaluationPageContent jobId="job_v1" runId="run_v1" />
        <JobDetailPageContent jobId="job_v1" />
      </FixtureProvider>
    );

    await user.click(screen.getByRole("button", { name: "Save Decision" }));

    expect((await screen.findByRole("status")).textContent).toContain("Accepted decision saved.");
    expect(screen.getByText("Current decision")).toBeDefined();
    expect(screen.getAllByText("Accepted").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$7.55").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$67.45").length).toBeGreaterThan(0);
  });

  test("comparison view shows V1, V2, and V3 fixture jobs", () => {
    renderWithFixtures(<ComparisonPageContent comparisonGroupId="cmp_refunds" />);

    expect(screen.getByRole("heading", { name: "V1 / V2 / V3 Comparison" })).toBeDefined();
    expect(screen.getAllByText("V1 Text only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("V2 Text + image annotation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("V3 Optimized").length).toBeGreaterThan(0);
  });
});
