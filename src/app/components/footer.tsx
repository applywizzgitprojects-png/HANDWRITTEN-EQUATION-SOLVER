interface FooterProps {
  onNavigate: (page: string) => void;
}

const LINKS = [
  { id: "home", label: "Home" },
  { id: "convert", label: "Solver" },
  { id: "dashboard", label: "Dashboard" },
  { id: "about", label: "About" },
];

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 lg:px-6 py-8 pb-24 md:pb-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-semibold">Handwritten Equation Solver</p>
            <p className="text-sm text-muted-foreground">
              OCR + Deep Learning for Handwritten Mathematical Equations
            </p>
            <p className="text-xs text-muted-foreground">
              Handwritten Equation Solver — From handwritten mathematics to verified solutions.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            {LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate(link.id)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
