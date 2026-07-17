import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | DevSync',
  description: 'How DevSync collects, uses, and protects personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          DevSync
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective July 17, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Information we collect</h2>
            <p className="mt-2">
              We collect account details such as your name, email address, authentication
              identifiers, team membership, and settings. When you connect integrations, we
              process GitHub installation identifiers, repository metadata, selected repository
              contents, database connection information, and database schema metadata needed to
              provide schema scanning and migration features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">How we use information</h2>
            <p className="mt-2">
              We use this information to authenticate users, operate scans, compare schemas,
              generate reports and migrations, maintain security, diagnose errors, and improve
              DevSync. We do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Connected services</h2>
            <p className="mt-2">
              Google and GitHub process authentication data under their own policies. Supabase
              provides authentication and data storage, Vercel provides application hosting, and
              configured AI providers may process prompts or schema context when you explicitly
              use AI features. Repository access is limited by the permissions granted to the
              DevSync GitHub App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Storage and security</h2>
            <p className="mt-2">
              We use reasonable technical and organizational safeguards. GitHub installation
              tokens are short-lived and are not stored as permanent credentials. Repository
              archives are processed for scanning. No internet service can guarantee absolute
              security, so use least-privilege database credentials and repository access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Retention and your choices</h2>
            <p className="mt-2">
              We retain information while your account or project remains active and as needed for
              security, legal, and operational purposes. You can revoke Google access through your
              Google Account, change or uninstall the GitHub App through GitHub, and request
              account data deletion by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Privacy questions and deletion requests can be sent to{' '}
              <a className="text-primary hover:underline" href="mailto:devsync@bitlabsbuild.com">
                devsync@bitlabsbuild.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm">
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
