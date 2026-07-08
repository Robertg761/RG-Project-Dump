import { Hero } from "@/components/Hero";
import { Projects } from "@/components/Projects";
import { Contact } from "@/components/Contact";
import { getAllPublicProjects } from "@/lib/projects";

// ISR: regenerate GitHub-sourced content every 6 hours.
export const revalidate = 21600;

export default async function Home() {
  const projects = await getAllPublicProjects();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "RG Project Dump",
    url: "https://rgprojectdump.ca",
    description: "A hub for projects, releases, and source code.",
    author: {
      "@type": "Person",
      name: "Robert Gordon",
      url: "https://github.com/Robertg761",
    },
  };

  return (
    <div className="flex flex-col w-full overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <Projects projects={projects} />
      <Contact />
    </div>
  );
}
