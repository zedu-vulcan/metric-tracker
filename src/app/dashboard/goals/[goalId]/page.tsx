import { GoalDetailView } from "@/components/goals/GoalDetailView";

export default function GoalPage({ params }: { params: { goalId: string } }) {
  return <GoalDetailView goalId={params.goalId} />;
}
