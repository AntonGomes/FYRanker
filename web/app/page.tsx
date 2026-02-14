import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left: big text */}
          <div className="flex-1">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.1] tracking-tight">
              Don&apos;t be an
              <br />
              <span className="text-primary">FY Wanker</span>,
              <br />
              use{" "}
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-lg inline-block">
                FYRanker
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              The smart way to rank your foundation programme preferences.
              Tell us what matters and get a personalised ranking of
              your foundation programme preferences in seconds.
            </p>
          </div>

          {/* Right: CTA */}
          <div className="shrink-0">
            <Link
              href="/wizard"
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl px-10 py-5 shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-100"
            >
              Start here →
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
