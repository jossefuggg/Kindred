import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { WidePage } from "@/components/layout/page";
import { CardSkeletonGrid, Empty } from "@/components/layout/blocks";
import { charitiesQuery } from "@/lib/data";
import { charityImage } from "@/lib/images";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/charities/")({
  head: () => ({
    meta: [
      { title: "Charities near you · Kindred" },
      { name: "description", content: "Browse local charities and apply to volunteer." },
      { property: "og:title", content: "Charities near you · Kindred" },
      { property: "og:description", content: "Browse local charities and apply to volunteer." },
    ],
  }),
  component: Charities,
});

function Charities() {
  const q = useQuery(charitiesQuery());
  const [area, setArea] = useState("All");
  const areas = ["All", ...new Set((q.data ?? []).map((c) => c.area).filter(Boolean))];
  const list = (q.data ?? []).filter((c) => area === "All" || c.area === area);

  return (
    <WidePage eyebrow="Directory" title="Charities near you" lead="Apply once. Your training comes with you.">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {areas.map((a) => (
          <button
            key={a}
            onClick={() => setArea(a)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150",
              area === a ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-text-2 hover:border-brand/50",
            )}
          >
            {a === "All" ? "All areas" : a}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <CardSkeletonGrid />
      ) : list.length === 0 ? (
        <Empty icon={Building2} title="No charities here yet" body="Try another area." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              to="/org/$id"
              params={{ id: c.id }}
              className="group overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <img src={charityImage(c.image_key)} alt="" loading="lazy" width={976} height={688} className="aspect-[16/9] w-full object-cover" />
              <div className="p-4">
                <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest">{c.cause || "Community"}</span>
                <p className="mt-3 font-display text-lg font-semibold tracking-tight text-text">{c.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-text-2">{c.description}</p>
                <p className="mt-3 flex items-center gap-1 text-xs text-text-3"><MapPin className="size-3.5" /> {c.area}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WidePage>
  );
}
