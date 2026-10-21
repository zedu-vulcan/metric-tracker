import { TaskView } from "@/components/goals/TaskView";

export default function TaskPage({ params }: { params: { goalId: string; workstreamId: string; taskId: string } }) {
  return <TaskView goalId={params.goalId} workstreamId={params.workstreamId} taskId={params.taskId} />;
}
