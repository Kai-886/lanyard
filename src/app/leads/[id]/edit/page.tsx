import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LeadForm } from "@/components/lead-form";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const exists = await db.lead
    .findUnique({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!exists) notFound();

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header>
        <p className="meta text-ink-3">Editing</p>
        <h1 className="display mt-1 text-[clamp(1.9rem,4vw,2.6rem)]">Update badge</h1>
      </header>
      <LeadForm leadId={id} />
    </div>
  );
}
