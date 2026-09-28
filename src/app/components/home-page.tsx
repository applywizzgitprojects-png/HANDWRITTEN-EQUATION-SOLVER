import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { SUPPORTED_PROBLEMS } from "@/app/content/supported-problems";
import { Upload } from "lucide-react";

interface HomePageProps {
  onNavigate: (page: string) => void;
  onNewConvert: () => void;
}

const PROCESS = [
  { step: "01", title: "Capture" },
  { step: "02", title: "Recognize" },
  { step: "03", title: "Analyze" },
  { step: "04", title: "Solve" },
  { step: "05", title: "Verify" },
];

const CAPABILITIES = [
  {
    title: "Handwriting recognition",
    description: "Recognizes handwritten mathematical expressions from uploaded images using a deep-learning recognition pipeline.",
  },
  {
    title: "OpenCV preprocessing",
    description: "Preprocesses handwritten input through image normalization and mathematical image preparation before recognition.",
  },
  {
    title: "Deep learning OCR",
    description: "Uses a neural image-to-mathematical-notation pipeline to identify symbols, operators, numbers, variables, and equation structure.",
  },
  {
    title: "Mathematical parsing",
    description: "Converts the recognized mathematical notation into a structured representation suitable for symbolic analysis.",
  },
  {
    title: "Automatic equation solving",
    description: "Automatically analyzes the recognized equation and computes its mathematical solution.",
  },
  {
    title: "Step-by-step solution",
    description: "Displays the solving process in a clear mathematical sequence rather than returning only the final answer.",
  },
  {
    title: "Solution verification",
    description: "Checks the computed solution against the original equation where verification is supported.",
  },
];

const WORKFLOW = [
  { title: "Upload handwriting", description: "Upload a single image containing a handwritten mathematical equation." },
  { title: "Image preprocessing", description: "OpenCV prepares the handwritten image for recognition." },
  { title: "Handwriting recognition", description: "The deep-learning recognition model identifies the mathematical structure and converts it into mathematical notation." },
  { title: "Mathematical analysis", description: "The recognized equation is parsed, validated, and classified." },
  { title: "Automatic solving", description: "The mathematical solver determines the solution." },
  { title: "Solution verification", description: "The solution is checked against the equation whenever reliable verification is available." },
  { title: "Step-by-step result", description: "The final result and solving process are presented clearly to the user." },
];

const STACK = [
  { label: "Computer vision", value: "OpenCV" },
  { label: "Deep learning", value: "PyTorch-based handwritten mathematical expression recognition" },
  { label: "Recognition architecture", value: "DenseNet-based visual encoder and Transformer-based decoder" },
  { label: "Backend", value: "FastAPI" },
  { label: "Mathematical solver", value: "SymPy" },
  { label: "Frontend", value: "React + TypeScript" },
  { label: "Mathematical rendering", value: "KaTeX" },
];

export function HomePage({ onNewConvert }: HomePageProps) {
  return (
    <div>
      <section className="container mx-auto px-4 lg:px-6 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Handwritten Equation Solver using OCR + Deep Learning
          </p>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Handwritten Equation
            <br />
            <span className="text-primary">Solver</span>
          </h1>
          <p className="text-base sm:text-lg font-medium">
            OCR + Deep Learning for Handwritten Mathematical Equations
          </p>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Upload a handwritten mathematical equation and let the system recognize the handwriting, convert it into structured mathematical notation, solve it automatically, and present the solution step by step.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" onClick={onNewConvert}>
              <Upload className="mr-2 h-4 w-4" />
              Start Solving
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">View How It Works</a>
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-12">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PROCESS.map((item) => (
              <div key={item.step} className="rounded-xl border bg-card px-3 py-4 text-center">
                <p className="text-xs font-medium text-primary">{item.step}</p>
                <p className="mt-1 text-sm font-medium">{item.title}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            From handwritten input to a verified mathematical solution.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-card py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-6 max-w-5xl">
          <h2 className="text-xl font-semibold">Key capabilities</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <Card key={item.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="container mx-auto px-4 lg:px-6 py-12 lg:py-16 max-w-3xl">
        <h2 className="text-xl font-semibold">How the system works</h2>
        <ol className="mt-6 space-y-4">
          {WORKFLOW.map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border bg-card py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-6 max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold">About the project</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Handwritten Equation Solver using OCR + Deep Learning is designed to bridge handwritten mathematical input and automated mathematical reasoning. The system combines computer vision preprocessing, deep-learning-based handwriting recognition, mathematical parsing, symbolic solving, and solution verification into a single workflow.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            An intelligent handwritten mathematical equation solving system that uses OpenCV for image preprocessing and deep-learning-based handwriting recognition to convert handwritten mathematical expressions into structured mathematical notation, automatically analyze and solve equations, and provide step-by-step solutions with verification.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-6 py-12 lg:py-16 max-w-5xl">
        <h2 className="text-xl font-semibold">Mathematical problems</h2>
        <p className="text-sm text-muted-foreground mt-2">
          These are the problem types the current solver can work with. Selected categories cover common forms, not every possible equation.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_PROBLEMS.map((item) => (
            <div key={item.name} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.support}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-6 max-w-3xl">
          <h2 className="text-xl font-semibold">Technology stack</h2>
          <dl className="mt-6 space-y-3">
            {STACK.map((item) => (
              <div key={item.label} className="grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4">
                <dt className="text-sm font-medium">{item.label}</dt>
                <dd className="text-sm text-muted-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground mt-6">
            Recognition architecture: DenseNet-based encoder with Transformer decoding and attention refinement.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-6 py-12 lg:py-16 text-center max-w-2xl">
        <h2 className="text-2xl font-semibold">Turn handwriting into solutions</h2>
        <p className="text-sm text-muted-foreground mt-3">
          Upload a handwritten equation and let the system recognize, solve, and explain it.
        </p>
        <Button size="lg" className="mt-6" onClick={onNewConvert}>
          Start Solving
        </Button>
      </section>
    </div>
  );
}
