import { notFound } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import GenerationResultClient from "@/modules/generation/GenerationResultClient";

type Props = { params: Promise<{ id: string }> };

export default async function GenerationResultPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  return (
    <GenerationResultClient
      requestId={id}
      workspaceBasePath="/dashboard"
      assignmentEditBasePath="/dashboard/assignments"
    />
  );
}
