import { PageContent, PageHeader } from "@/components/PageHeader";
import { TodoView } from "@/components/todo/TodoView";

export default function TodoPage() {
  return (
    <>
      <PageHeader title="Escalations" description="The tasks, bids, questions and offers your agents need a person to handle." />
      <PageContent>
        <TodoView />
      </PageContent>
    </>
  );
}
