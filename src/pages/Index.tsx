import { Mail, Github, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const projects = [
  { title: "Project Alpha", description: "A modern web application built with React and TypeScript." },
  { title: "Project Beta", description: "Mobile-first e-commerce platform with real-time features." },
  { title: "Project Gamma", description: "Data visualization dashboard for analytics." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Hi, I'm a Developer 👋</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          I build modern web experiences with clean code and thoughtful design.
        </p>
        <Button asChild className="mt-4">
          <a href="#contact">Get in touch</a>
        </Button>
      </section>

      {/* Projects */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="mb-8 text-3xl font-semibold">Projects</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.title}>
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="mb-4 text-3xl font-semibold">Contact</h2>
        <p className="mb-6 text-muted-foreground">Feel free to reach out!</p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" size="icon"><Mail className="h-5 w-5" /></Button>
          <Button variant="outline" size="icon"><Github className="h-5 w-5" /></Button>
          <Button variant="outline" size="icon"><Linkedin className="h-5 w-5" /></Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
