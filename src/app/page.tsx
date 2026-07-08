import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { Contact } from "@/components/Contact";
import { getAllPublicProjects } from "@/lib/projects";

// ISR: regenerate GitHub-sourced content every 6 hours.
export const revalidate = 21600;

export default async function Home() {
  const projects = await getAllPublicProjects();

  return (
    <div className="flex flex-col w-full overflow-hidden">
      <Hero />
      <Projects projects={projects} />
      <Contact />
    </div>
  );
}
