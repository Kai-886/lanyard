import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 pt-20">
      <p className="meta text-ink-3">404</p>
      <h1 className="display text-[clamp(2rem,5vw,3rem)]">No badge here.</h1>
      <p className="max-w-md text-sm leading-relaxed text-ink-2">
        Either this lead was deleted, or the link has a typo. The rail is the fastest way back.
      </p>
      <div className="flex gap-2">
        <Link href="/leads">
          <Button variant="primary" size="lg">Open the rail</Button>
        </Link>
        <Link href="/">
          <Button size="lg">Overview</Button>
        </Link>
      </div>
    </div>
  );
}
