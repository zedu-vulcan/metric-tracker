import { TaskView } from "@/components/tasks/TaskView";

export default function TaskPage({ params }: { params: { taskId: string } }) {
  return <TaskView taskId={params.taskId} />;
}
