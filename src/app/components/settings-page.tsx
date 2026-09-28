import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="container mx-auto px-4 lg:px-6 py-8 pb-12 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold">Application settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preferences for Handwritten Equation Solver.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose the interface theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map((option) => (
              <Button
                key={option.value}
                variant={theme === option.value ? "default" : "outline"}
                className="flex flex-col gap-1.5 h-auto py-3"
                onClick={() => setTheme(option.value)}
              >
                <option.icon className="h-5 w-5" />
                <span className="text-xs">{option.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mathematical display</CardTitle>
          <CardDescription>How recognized equations and solutions are shown.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>The solver page renders recognized equations, steps, and solutions as mathematical notation.</p>
          <p>Preview zoom on the solver page changes only the on-screen size of that rendering.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recognition</CardTitle>
          <CardDescription>How a handwritten image is accepted.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Upload one PNG, JPG, JPEG, or WEBP image at a time. You can also paste an image with Ctrl+V.</p>
          <p>There are no separate recognition modes to configure. Each upload is recognized automatically.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
          <CardDescription>How a recognized equation is solved.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>After recognition, the equation is analyzed and solved automatically. Editing the recognized equation solves the updated expression after a short pause.</p>
          <p>Real-valued solutions are used. Verification is shown only when the solver can check the result.</p>
        </CardContent>
      </Card>
    </div>
  );
}
