import DocsContent from "@/components/docs/DocsContent";
import Section from "@/components/docs/Section";
import Subsection from "@/components/docs/Subsection";

export default function SupportedFrameworksPage() {
  return (
    <DocsContent
      title="Supported Frameworks & Drivers"
      description="Comprehensive compatibility guide for ORMs, schema extractors, and database drivers supported by DevSync."
      badge="Driver Matrix"
    >
      <Section title="Overview">
        <p className="text-sm text-muted-foreground leading-relaxed">
          DevSync standardizes heterogeneous schema declarations across popular TypeScript and Python ORMs into a unified Abstract Syntax Tree (AST) representation, enabling cross-driver drift comparison.
        </p>
      </Section>

      <Section title="Supported Parsers & ORMs">
        <Subsection title="Prisma ORM">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Full support for <code className="font-mono text-primary">schema.prisma</code> models, relations, enums, indexes, and primary keys.
          </p>
        </Subsection>

        <Subsection title="Supabase Postgres">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Native support for Supabase schemas, Row Level Security (RLS) policies, and database triggers.
          </p>
        </Subsection>

        <Subsection title="Neon Serverless Postgres">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Support for Neon database branching and serverless connection strings.
          </p>
        </Subsection>

        <Subsection title="Drizzle ORM & TypeORM">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Supports TypeScript schema definitions, table builders, and custom column mapping.
          </p>
        </Subsection>
      </Section>
    </DocsContent>
  );
}
