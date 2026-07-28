import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import Footer from "@/components/landing/Footer";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsSearchModal from "@/components/docs/DocsSearchModal";
import TableOfContents from "@/components/docs/TableOfContents";
import ElasticGridBackground from "@/components/animations/ElasticGridBackground";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Rubber Canvas Mesh */}
      <ElasticGridBackground />

      <div className="relative z-10 space-y-8 pt-24 sm:pt-28">
        {/* Floating Glass Pill Header */}
        <LandingNav />

        {/* Search Bar Sub-Header Container */}
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4 font-mono text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link href="/" className="hover:text-foreground">dev-sync</Link>
              <span>/</span>
              <Link href="/docs" className="text-foreground font-semibold">docs</Link>
            </div>
            <DocsSearchModal />
          </div>
        </div>

        {/* 3-Column Documentation Layout Shell */}
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 pb-24">
          <div className="flex gap-12">
            {/* Left Sidebar Navigation Tree */}
            <div className="hidden lg:block">
              <DocsSidebar />
            </div>

            {/* Center Main Documentation Article */}
            <main className="flex-1 min-w-0">
              {children}
            </main>

            {/* Right Table of Contents */}
            <TableOfContents />
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
