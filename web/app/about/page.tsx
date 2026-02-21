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
              Ranking FY jobs is a ridculously dawnting task, but it doesn&apos;t need to be.
              FYRanker lets you choose your preferred regions, hospitals and specialties and
              gives you a personalised ranking of all the foundation programme jobs.
              <br /><br />
              But the fun doens&apos;t stop there. The intuitive ranking interface lets you compare jobs side by side
              and easily navigate through the hundereds of options. 
            </p>

          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">How it works</h2>
            <ol className="space-y-3 text-muted-foreground leading-relaxed list-decimal list-inside">
              <li>
                <strong className="text-foreground">Rank regions</strong> —
                Rank your preferred regions.
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
                — Every programme is scored and present your personalised ranking
                with drag-and-drop reordering.
              </li>
            </ol>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">How does ranking work?</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you rank your regions, hospitals and specialties you are essentially assigning them a score. 
              The higher you rank something, the higher score it gets. 
              When you set the weights, you are telling the algorithm how much each of those scores should influence the final ranking. 
              <br />
              For example if you set region weight to 50% and hospital weight to 50%, then a job in a highly ranked region will get a big boost to its score, but a job in a highly ranked hospital will also get a big boost.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Why?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Personally I am not a med student but my sister is and she would not stop complaining about how difficult it is to rank FY jobs. 
              Shout out sis, you can all thank her. 
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">For free?</h2>
            <p className="text-muted-foreground leading-relaxed">
              FYRanker is and always will be free 😎.
            </p>
          </div>


        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
