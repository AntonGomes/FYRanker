"use client";

import { useEffect, useState, useRef } from "react";
import { ResultsView } from "@/components/results-view";
import type { ScoredJob } from "@/lib/scoring";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { importRankingsFromXlsx, ImportError } from "@/lib/import-xlsx";
import Link from "next/link";
import { Upload } from "lucide-react";

export default function ResultsPage() {
  const [scoredJobs, setScoredJobs] = useState<ScoredJob[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Try sessionStorage first, then localStorage
    const raw =
      sessionStorage.getItem("fy_scored_jobs") ??
      localStorage.getItem("fy_scored_jobs");
    if (raw) {
      try {
        setScoredJobs(JSON.parse(raw));
      } catch {
        setScoredJobs(null);
      }
    }
  }, []);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const jobs = await importRankingsFromXlsx(file);
      const json = JSON.stringify(jobs);
      sessionStorage.setItem("fy_scored_jobs", json);
      localStorage.setItem("fy_scored_jobs", json);
      setScoredJobs(jobs);
    } catch (err) {
      if (err instanceof ImportError) {
        setImportError(err.message);
      } else {
        setImportError("Failed to read the file. Make sure it's a valid .xlsx export.");
      }
    } finally {
      setImporting(false);
      // Reset the input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!scoredJobs) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold">No ranking data found</h1>
            <p className="text-muted-foreground">
              Complete the wizard first to generate your ranking.
            </p>
            <Link
              href="/wizard"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors"
            >
              Go to wizard
            </Link>

            <div className="relative pt-4">
              <div className="absolute inset-x-0 top-4 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                onChange={handleImport}
                className="hidden"
                id="import-xlsx"
              />
              <label
                htmlFor="import-xlsx"
                className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" />
                {importing ? "Importing..." : "Load a saved ranking (.xlsx)"}
              </label>
              {importError && (
                <p className="mt-2 text-sm text-red-500 font-medium">
                  {importError}
                </p>
              )}
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return <ResultsView scoredJobs={scoredJobs} />;
}
