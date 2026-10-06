import type { Metadata } from "next";
import { Overview } from "@/components/overview";

export const metadata: Metadata = { title: "Overview" };

export default function HomePage() {
  return <Overview />;
}
