import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

const TECHNOLOGIES = [
  {
    title: "Computer Vision",
    description: "OpenCV-based image preprocessing prepares a handwritten equation for recognition.",
  },
  {
    title: "Deep Learning",
    description: "Neural handwritten mathematical expression recognition identifies symbols and equation structure.",
  },
  {
    title: "Mathematical Processing",
    description: "Structured mathematical parsing turns recognized notation into an expression the solver can analyze.",
  },
  {
    title: "Symbolic Mathematics",
    description: "Symbolic equation solving computes results for supported problem types.",
  },
  {
    title: "Rendering",
    description: "Mathematical notation rendering presents the recognized equation, steps, and solution.",
  },
  {
    title: "Verification",
    description: "Solution validation checks a result against the original equation where that check is supported.",
  },
];

export function AboutPage() {
  return (
    <div className="pb-8">
      <section className="container mx-auto px-4 lg:px-6 py-10 lg:py-14 max-w-4xl space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">About</p>
        <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">About Handwritten Equation Solver</h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Handwritten Equation Solver combines computer vision, deep learning, mathematical parsing, symbolic solving, and verification into a single workflow for interpreting handwritten mathematical equations.
        </p>
      </section>

      <section className="container mx-auto px-4 lg:px-6 pb-10 max-w-4xl grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The problem</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Traditional mathematical software expects typed or structured input. Handwritten equations require an additional recognition stage before mathematical reasoning can begin.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The approach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The system processes a handwritten equation image, recognizes its mathematical structure, converts it into a structured representation, and automatically solves the resulting equation.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 lg:px-6 pb-12 max-w-4xl">
        <h2 className="text-xl font-semibold mb-4">Technology</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TECHNOLOGIES.map((item) => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
