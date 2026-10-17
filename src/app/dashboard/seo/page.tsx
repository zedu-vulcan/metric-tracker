import { Suspense } from "react";
import { SeoAnalyticsView } from "@/components/seo/SeoAnalyticsView";

export const dynamic = "force-dynamic";

export default function SeoAnalyticsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-b bg-background/90 px-4 backdrop-blur-sm sm:px-[clamp(20px,4vw,48px)]">
        <h1 className="m-0 text-base leading-none font-bold tracking-[-0.03em] text-foreground">SEO Analytics</h1>
      </header>

      <div className="flex-1 p-4 sm:px-[clamp(20px,4vw,48px)] sm:py-6">
        <Suspense>
          <SeoAnalyticsView />
        </Suspense>
      </div>
    </div>
  );
}
