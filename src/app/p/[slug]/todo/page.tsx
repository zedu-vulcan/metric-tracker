import { PageContent, PageHeader } from "@/components/PageHeader";
import { TodoView } from "@/components/todo/TodoView";

export default function TodoPage() {
  return (
    <>
      <PageHeader title="Awaiting You" description="The tasks, bids, questions and offers that are waiting on you." />
      <PageContent>
        <TodoView />
      </PageContent>
    </>
  );
}
