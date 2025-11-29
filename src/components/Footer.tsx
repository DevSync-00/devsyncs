const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <div className="font-bold text-2xl mb-2">
              DevSync<span className="text-gradient">.ai</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI DevOps Copilot for Modern Development
            </p>
          </div>

          <div className="flex gap-8 text-sm">
            <a href="https://dev-sync.dev/docs" className="text-muted-foreground hover:text-primary transition-colors">
              Documentation
            </a>
            <a href="https://dev-sync.dev/blog" className="text-muted-foreground hover:text-primary transition-colors">
              Blog
            </a>
            <a href="https://dev-sync.dev/privacy" className="text-muted-foreground hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="https://dev-sync.dev/terms" className="text-muted-foreground hover:text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} DevSync.ai. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
