import { useTheme } from "next-themes";
import { Button } from "@/app/components/ui/button";
import { Home, LayoutDashboard, PenLine, Info, Settings, Sun, Moon, Plus } from "lucide-react";
import { cn } from "@/app/components/ui/utils";

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onNewConvert: () => void;
}

export function Header({ currentPage, onNavigate, onNewConvert }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "convert", label: "Solver", icon: PenLine },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
        <button
          type="button"
          className="flex items-center gap-2 text-primary min-w-0"
          onClick={() => onNavigate("home")}
        >
          <PenLine className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline text-sm font-semibold truncate">Handwritten Equation Solver</span>
          <span className="lg:hidden text-sm font-semibold">Equation Solver</span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={currentPage === item.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onNavigate(item.id)}
              className={cn("gap-1.5 h-8 rounded-full px-3 text-xs", currentPage === item.id && "bg-primary text-primary-foreground shadow-sm")}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button onClick={onNewConvert} size="sm" className="hidden sm:flex h-8 rounded-full px-3 text-xs shadow-sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Equation
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate("settings")}
            className="h-8 w-8"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <nav className="flex items-center justify-around px-2 py-1.5">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(item.id)}
              className={cn("flex flex-col gap-0.5 h-auto py-1.5 px-2", currentPage === item.id && "text-primary")}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-[10px]">{item.label}</span>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
