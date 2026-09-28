import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";
import { HomePage } from "@/app/components/home-page";
import { DashboardPage } from "@/app/components/dashboard-page";
import { ConvertPage } from "@/app/components/convert-page";
import { AboutPage } from "@/app/components/about-page";
import { SettingsPage } from "@/app/components/settings-page";
import { Toaster } from "@/app/components/ui/sonner";

const PAGE_TITLES: Record<string, string> = {
  home: "Handwritten Equation Solver | OCR + Deep Learning",
  convert: "Handwritten Equation Solver | Solve Handwritten Equations",
  dashboard: "Handwritten Equation Solver | Dashboard",
  about: "Handwritten Equation Solver | About",
  settings: "Handwritten Equation Solver | Settings",
};

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [convertSession, setConvertSession] = useState(0);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNewConvert = () => {
    setConvertSession((session) => session + 1);
    setCurrentPage("convert");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    document.title = PAGE_TITLES[currentPage] ?? PAGE_TITLES.home;
  }, [currentPage]);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage onNavigate={handleNavigate} onNewConvert={handleNewConvert} />;
      case "dashboard":
        return <DashboardPage onNavigate={handleNavigate} onNewConvert={handleNewConvert} />;
      case "convert":
        return <ConvertPage resetToken={convertSession} />;
      case "about":
        return <AboutPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <HomePage onNavigate={handleNavigate} onNewConvert={handleNewConvert} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onNewConvert={handleNewConvert}
      />
      <main className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer onNavigate={handleNavigate} />
      <Toaster richColors position="top-right" />
    </div>
  );
}
