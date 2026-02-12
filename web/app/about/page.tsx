import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BrandLogo } from "@/components/brand";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1 py-16 px-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-4">
              About <BrandLogo className="inline-flex align-baseline" />
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Ranking foundation year programmes is stressful. You&apos;re
              staring at a massive spreadsheet of hundreds of programmes, each
              with six placements across different hospitals and specialties, and
              you somehow need to put them in order of preference.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">How it works</h2>
            <ol className="space-y-3 text-muted-foreground leading-relaxed list-decimal list-inside">
              <li>
                <strong className="text-foreground">Upload</strong> — Export
                your ORIEL programme data as an .xlsx file and drop it in.
              </li>
              <li>
                <strong className="text-foreground">Rank regions</strong> —
                Tell us which deanery regions you prefer.
              </li>
              <li>
                <strong className="text-foreground">Rank hospitals</strong> —
                Order the hospitals within each region, then fine-tune the global
                order.
              </li>
              <li>
                <strong className="text-foreground">Rank specialties</strong>{" "}
                — Which specialties matter most to you?
              </li>
              <li>
                <strong className="text-foreground">Set weights</strong> — How
                much should region vs hospital vs specialty influence your
                ranking?
              </li>
              <li>
                <strong className="text-foreground">Get your ranking</strong>{" "}
                — We score every programme and present your personalised ranking
                with drag-and-drop reordering.
              </li>
            </ol>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Everything runs in your browser. Your data never leaves your
              machine — no servers, no accounts, no tracking. Your ORIEL export
              is processed entirely client-side.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Built with ❤️ in Glasgow by foundation doctors who&apos;ve been
              through the process. We know the pain.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
