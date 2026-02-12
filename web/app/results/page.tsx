"use client";

import { useEffect, useState } from "react";
import { ResultsView } from "@/components/results-view";
import type { ScoredJob } from "@/lib/scoring";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";

export default function ResultsPage() {
  const [scoredJobs, setScoredJobs] = useState<ScoredJob[] | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("fy_scored_jobs");
    if (raw) {
      try {
        setScoredJobs(JSON.parse(raw));
      } catch {
        setScoredJobs(null);
      }
    }
  }, []);

  if (!scoredJobs) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
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
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return <ResultsView scoredJobs={scoredJobs} />;
}
