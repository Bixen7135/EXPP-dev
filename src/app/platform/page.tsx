import type { Metadata } from "next";
import { PlatformLanding } from "./PlatformLanding";

export const metadata: Metadata = {
  title: "EXPP Platform",
  description: "Платформа EXPP для школ, учителей и учеников.",
};

export default function PlatformPage() {
  return <PlatformLanding />;
}
