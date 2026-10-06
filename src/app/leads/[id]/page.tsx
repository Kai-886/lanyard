import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LeadDetail } from "@/components/lead-detail";

export const metadata: Metadata = { title: "Badge" };

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Existence check on the server so an unknown id returns a real 404 status
  // rather than a 200 shell with a client-side apology. The client still
  // handles the case where the lead is deleted while the page is open.
  const exists = await db.lead
    .findUnique({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!exists) notFound();

  return <LeadDetail id={id} />;
}
