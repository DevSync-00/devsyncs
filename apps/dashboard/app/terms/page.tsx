import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | DevSync',
  description: 'Terms governing use of the DevSync service.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          DevSync
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective July 17, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Using DevSync</h2>
            <p className="mt-2">
              You must provide accurate account information, protect your credentials, and use
              DevSync only in compliance with applicable law. You must have authorization to
              access every repository, database, and project you connect to the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Your content and permissions</h2>
            <p className="mt-2">
              You retain ownership of your code, schemas, and other content. You grant DevSync the
              limited permission necessary to process that content to provide the features you
              request. You are responsible for selecting appropriate integration permissions and
              least-privilege database credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Migration safety</h2>
            <p className="mt-2">
              Schema comparisons, generated SQL, AI explanations, safety scores, and migration
              suggestions may be incomplete or incorrect. Review and test every proposed change,
              maintain current backups, and use staged environments before applying changes to
              production. You remain responsible for migration approval and execution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Acceptable use</h2>
            <p className="mt-2">
              You may not misuse the service, attempt unauthorized access, interfere with other
              users, upload malicious content, evade usage limits, or use DevSync to violate the
              rights of another person or organization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Service availability</h2>
            <p className="mt-2">
              DevSync is provided on an as-available basis. Features may change, be suspended, or
              be discontinued. To the extent permitted by law, DevSync disclaims implied
              warranties and is not liable for indirect, incidental, special, consequential, or
              exemplary damages, including lost data, revenue, or profits.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Termination and changes</h2>
            <p className="mt-2">
              You may stop using DevSync at any time. We may restrict access for violations,
              security risks, or legal requirements. Material changes to these terms will be
              reflected by updating the effective date on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about these terms can be sent to{' '}
              <a className="text-primary hover:underline" href="mailto:devsync@bitlabsbuild.com">
                devsync@bitlabsbuild.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
