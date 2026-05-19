import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileText, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { FixtureProvider } from "../components/fixture-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentCore Unit Economics",
  description: "Unit economics for accepted Spanish-to-English PDF translation workflows"
};

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <FixtureProvider>
          <div className="app-shell">
            <header className="top-nav">
              <Link href="/documents" className="brand" aria-label="Open documents">
                AgentCore Unit Economics
              </Link>
              <nav aria-label="Primary navigation">
                <Link href="/documents" title="Documents">
                  <FileText aria-hidden="true" size={18} />
                  <span className="nav-label">Documents</span>
                </Link>
                <Link href="/compare/cmp_refunds" title="Compare">
                  <BarChart3 aria-hidden="true" size={18} />
                  <span className="nav-label">Compare</span>
                </Link>
                <Link href="/settings/economics" title="Economics">
                  <Settings aria-hidden="true" size={18} />
                  <span className="nav-label">Economics</span>
                </Link>
              </nav>
            </header>
            <main>{children}</main>
          </div>
        </FixtureProvider>
      </body>
    </html>
  );
}
