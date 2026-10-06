import type { Metadata } from "next";
import { LeadForm } from "@/components/lead-form";

export const metadata: Metadata = { title: "Capture a lead" };

export default function NewLeadPage() {
  return (
    <div className="flex flex-col gap-6 pt-8">
      <header>
        <p className="meta text-ink-3">Quick capture</p>
        <h1 className="display mt-1 text-[clamp(1.9rem,4vw,2.6rem)]">Add a badge</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          Thirty seconds, standing up. Name and event are enough — everything else can wait until
          you&apos;re back at a laptop.
        </p>
      </header>
      <LeadForm />
    </div>
  );
}
