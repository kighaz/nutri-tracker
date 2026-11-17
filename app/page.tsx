import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  // AppShell reads the current date on the client, which Cache Components requires behind Suspense.
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <AppShell />
    </Suspense>
  );
}
