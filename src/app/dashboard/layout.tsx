import type { ReactNode } from "react";
import PlatformPreciseLocationCapture from "@/app/PlatformPreciseLocationCapture";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformPreciseLocationCapture />
      {children}
    </>
  );
}
