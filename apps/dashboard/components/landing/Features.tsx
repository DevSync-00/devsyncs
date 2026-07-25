import { AlertTriangle, ArrowRight, FileCode2, GitPullRequest, RotateCcw } from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="border-b bg-card/30 py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Review the artifact</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">See exactly what changes.</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">DevSync converts drift into a reviewable migration with the context engineers need: affected objects, SQL, risk, execution estimate, and rollback.</p>
            <ul className="mt-6 space-y-3 text-xs">
              <li className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-primary" /> Object-level schema comparison</li>
              <li className="flex items-center gap-2"><GitPullRequest className="h-4 w-4 text-primary" /> Pull-request and team approvals</li>
              <li className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-primary" /> Generated rollback plan</li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="flex h-10 items-center justify-between border-b px-4 font-mono text-[10px]">
              <span>20260725_align_post_schema.sql</span>
              <span className="text-amber-400">2 changes</span>
            </div>
            <div className="grid md:grid-cols-2">
              <pre className="overflow-x-auto border-b p-5 font-mono text-[10px] leading-6 text-muted-foreground md:border-b-0 md:border-r"><code>{`-- generated migration
ALTER TABLE "posts"
  ALTER COLUMN "published_at"
  TYPE TIMESTAMP
  USING "published_at"::timestamp;

ALTER TABLE "posts"
  ADD COLUMN "author_id" INTEGER;

CREATE INDEX "posts_author_id_idx"
  ON "posts" ("author_id");`}</code></pre>
              <div className="p-5">
                <div className="flex items-center gap-2 border-b pb-4 font-mono text-[10px] text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> REVIEW REQUIRED</div>
                <dl className="mt-4 space-y-3 font-mono text-[10px]">
                  {[["Environment", "production"], ["Risk", "LOW"], ["Rows affected", "~12.4k"], ["Lock estimate", "240ms"], ["Rollback", "generated"], ["SHA", "a89d2f3"]].map(([label, value]) => (
                    <div key={label} className="flex justify-between border-b pb-2"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
                <button className="mt-5 flex h-8 w-full items-center justify-center gap-2 rounded bg-primary font-mono text-[10px] text-primary-foreground">Open full diff <ArrowRight className="h-3 w-3" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
