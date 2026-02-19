import type { Job } from "./parse-xlsx";

/**
 * Load jobs from the static /data/jobs.json.
 */
export async function loadJobs(): Promise<Job[]> {
  const res = await fetch("/data/jobs.json");
  return res.json() as Promise<Job[]>;
}
