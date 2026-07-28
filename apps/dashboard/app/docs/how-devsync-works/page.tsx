import DocsContent from "@/components/docs/DocsContent";
import Section from "@/components/docs/Section";
import Subsection from "@/components/docs/Subsection";

export default function HowDevSyncWorksPage() {
  return (
    <DocsContent
      title="How DevSync Works"
      description="An architectural overview of the schema extraction engine, Abstract Syntax Tree (AST) normalization, and read-only preflight execution."
      badge="Core Engine"
    >
      <Section title="The Drift Problem">
        <p className="text-sm text-muted-foreground leading-relaxed">
          In modern software engineering, schema drift occurs when database structures in staging or production diverge from your application code definitions (Prisma models, TypeORM schemas, or SQL files). This leads to runtime application crashes and failed deployments.
        </p>
      </Section>

      <Section title="Architecture & 3-Step Pipeline">
        <Subsection title="1. Schema AST Extraction">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The CLI parses local codebase schema files into a normalized Abstract Syntax Tree (AST), standardizing data types, constraints, and indexes across all supported ORMs.
          </p>
        </Subsection>

        <Subsection title="2. Read-Only Database Inspection">
          <p className="text-sm text-muted-foreground leading-relaxed">
            DevSync queries database system catalogs (<code className="font-mono text-primary">information_schema</code>) using read-only connections. No write locks or data alterations occur during scanning.
          </p>
        </Subsection>

        <Subsection title="3. Deterministic Diff & Preflight">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The engine calculates exact DDL SQL diffs, lock estimates (~240ms), and automated rollback statements for approval before execution.
          </p>
        </Subsection>
      </Section>
    </DocsContent>
  );
}
