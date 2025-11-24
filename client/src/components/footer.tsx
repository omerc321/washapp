import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo/Brand */}
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Washapp.ae
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Your trusted car wash marketplace
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link href="/about">
              <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-about">
                About
              </a>
            </Link>
            <Link href="/terms">
              <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">
                Terms
              </a>
            </Link>
            <Link href="/privacy">
              <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">
                Privacy
              </a>
            </Link>
          </nav>

          {/* Copyright */}
          <div className="text-xs text-muted-foreground text-center sm:text-right">
            © {new Date().getFullYear()} Washapp.ae
          </div>
        </div>
      </div>
    </footer>
  );
}
