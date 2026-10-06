import { Suspense } from "react";
import type { Metadata } from "next";
import { Rail } from "@/components/rail";

export const metadata: Metadata = { title: "The rail" };

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 pt-8 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[210px] rounded-[4px]" />
          ))}
        </div>
      }
    >
      <div className="pt-6">
        <Rail />
      </div>
    </Suspense>
  );
}
