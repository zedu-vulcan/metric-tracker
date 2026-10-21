import { WorkstreamView } from "@/components/goals/WorkstreamView";

export default function WorkstreamPage({ params }: { params: { goalId: string; workstreamId: string } }) {
  return <WorkstreamView goalId={params.goalId} workstreamId={params.workstreamId} />;
}
