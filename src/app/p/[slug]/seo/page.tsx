import { getProjectPage } from "@/lib/project-page";
import { getLatestView, getSeoPageUrl } from "./data";
import { SeoChecker } from "./SeoChecker";

export const dynamic = "force-dynamic";

export default async function SeoPage({ params }: { params: { slug: string } }) {
  const { project } = await getProjectPage(params.slug);
  const [initial, initialUrl] = await Promise.all([getLatestView(project.id), getSeoPageUrl(project.id)]);
  return <SeoChecker initial={initial} initialUrl={initialUrl} />;
}
