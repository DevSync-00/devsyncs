import Link from "next/link";
import Logo from "@/components/Logo";

const footerLinks = {
  Product: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#safety", label: "Safety" },
    { href: "/auth/signup", label: "Sign up" },
  ],
  Resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/docs/user-guide", label: "User guide" },
    { href: "/docs/troubleshooting", label: "Troubleshooting" },
    { href: "/auth/login", label: "Sign in" },
  ],
};

const Footer = () => {
  return (
    <footer className="border-t border-border bg-secondary/10">
      <div className="container mx-auto max-w-6xl px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <Logo variant="original" width={28} height={28} />
              <span className="font-display text-lg font-bold tracking-tight">
                DevSync<span className="text-gradient">.ai</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Database schema sync and migration safety for engineering teams.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-sm mb-4">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Dev-Sync.dev. All rights reserved.</p>
          <p className="text-xs">
            Scan read-only by default · Apply requires explicit approval
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
