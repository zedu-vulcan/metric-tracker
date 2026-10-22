import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskBoardResults } from "../TaskBoardResults";
import { TaskBoardLegacyDialog, TaskBoardLegacyDetails } from "../TaskBoardLegacyDialog";
import { createTaskBoardFixtures } from "@/lib/fixtures/task-board";
import type { TaskBoardResponse, TaskBoardTask } from "@/lib/schemas/task-board";

// tsx uses the classic JSX runtime for this test file; provide the React
// namespace expected by existing shared primitives that use JSX without an import.
Object.assign(globalThis, { React });

const noop = () => {};

describe("TaskBoardResults component", () => {
  const { allStatusesResponse } = createTaskBoardFixtures();

  it("renders table with all 6 columns and fixture tasks", () => {
    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={allStatusesResponse}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Task"));
    assert.ok(html.includes("Goal / workstream"));
    assert.ok(html.includes("Type"));
    assert.ok(html.includes("Status"));
    assert.ok(html.includes("Assigned agent"));
    assert.ok(html.includes("Points"));
    assert.ok(html.includes("Newest first"));
  });

  it("renders 0 points as '0 pts' without losing zero", () => {
    const zeroTask: TaskBoardTask = {
      ...allStatusesResponse.tasks[0],
      id: "task_zero",
      title: "Zero Point Task",
      points: 0,
    };
    const response: TaskBoardResponse = {
      tasks: [zeroTask],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes(">0 <span"));
    assert.ok(html.includes("pts</span>"));
  });

  it("renders null points as 'Not set'", () => {
    const nullPointTask: TaskBoardTask = {
      ...allStatusesResponse.tasks[0],
      id: "task_null",
      title: "Null Point Task",
      points: null,
    };
    const response: TaskBoardResponse = {
      tasks: [nullPointTask],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Not set"));
  });

  it("renders legacy tasks with 'No goal / Legacy task'", () => {
    const legacyTask = allStatusesResponse.tasks.find((t) => t.id === "task_demo_legacy");
    assert.ok(legacyTask, "Fixture legacy task should exist");

    const response: TaskBoardResponse = {
      tasks: [legacyTask!],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("No goal / Legacy task"));
    // Legacy task has no detailsUrl, so it renders a button instead of an anchor
    assert.ok(html.includes("<button"));
    assert.ok(html.includes("An older checklist task"));
  });

  it("uses the provided details URL for normal task titles", () => {
    const task = allStatusesResponse.tasks.find((item) => item.detailsUrl !== null);
    assert.ok(task, "Fixture should have a task with a details URL");
    const response: TaskBoardResponse = {
      tasks: [task!],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes(`href="${task!.detailsUrl}"`));
    assert.ok(html.includes(task!.title));
    assert.ok(html.includes("focus-visible:ring-2"));
  });

  it("renders assigned worker name with owner context in parentheses", () => {
    const assignedTask = allStatusesResponse.tasks.find((t) => t.assignedAgent !== null);
    assert.ok(assignedTask, "Fixture should have an assigned task");

    const response: TaskBoardResponse = {
      tasks: [assignedTask!],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes(assignedTask!.assignedAgent!.name));
    assert.ok(html.includes(`(${assignedTask!.assignedAgent!.ownerName})`));
  });

  it("renders unassigned worker with 'Unassigned' label", () => {
    const unassignedTask = allStatusesResponse.tasks.find((t) => t.assignedAgent === null);
    assert.ok(unassignedTask, "Fixture should have an unassigned task");

    const response: TaskBoardResponse = {
      tasks: [unassignedTask!],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Unassigned"));
  });

  it("renders 'Open for bids' badge when isOpenForBids is true", () => {
    const openForBidsTask = allStatusesResponse.tasks.find((t) => t.isOpenForBids);
    assert.ok(openForBidsTask, "Fixture should have an open for bids task");

    const response: TaskBoardResponse = {
      tasks: [openForBidsTask!],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={response}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Open for bids"));
  });

  it("renders error alert with retry button when error is set", () => {
    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={null}
        loading={false}
        error="Network connection failed"
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Unable to load tasks"));
    assert.ok(html.includes("Network connection failed"));
    assert.ok(html.includes("Retry"));
  });

  it("renders 'No tasks open for bids' when empty without filters", () => {
    const emptyResponse: TaskBoardResponse = {
      tasks: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={emptyResponse}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("No tasks open for bids"));
    assert.ok(html.includes("There are currently no tasks open for bidding in this project."));
  });

  it("renders 'No matching tasks' with clear filters button when empty with filters", () => {
    const emptyResponse: TaskBoardResponse = {
      tasks: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={emptyResponse}
        loading={false}
        error={null}
        hasFilters={true}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("No matching tasks"));
    assert.ok(html.includes("Clear filters"));
  });

  it("offers All statuses when an agent filter has no open-for-bids matches", () => {
    const emptyResponse: TaskBoardResponse = {
      tasks: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={emptyResponse}
        loading={false}
        error={null}
        hasFilters={true}
        suggestAllStatuses={true}
        onShowAllStatuses={noop}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );
    assert.ok(html.includes("This agent may have tasks in other statuses."));
    assert.ok(html.includes("Show all statuses"));
  });

  it("shows the project-empty state only when the response establishes zero project tasks", () => {
    const emptyResponse: TaskBoardResponse = {
      tasks: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={emptyResponse}
        loading={false}
        error={null}
        hasFilters={true}
        isProjectEmpty={true}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );
    assert.ok(html.includes("No project tasks yet"));
  });

  it("renders 'Page out of range' when current page exceeds total pages", () => {
    const outOfRangeResponse: TaskBoardResponse = {
      tasks: [],
      pagination: { page: 5, pageSize: 20, total: 20, totalPages: 1 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={outOfRangeResponse}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Page out of range"));
    assert.ok(html.includes("Go to first page"));
  });

  it("renders pagination controls when total pages > 1", () => {
    const multiPageResponse: TaskBoardResponse = {
      tasks: allStatusesResponse.tasks,
      pagination: { page: 1, pageSize: 20, total: 45, totalPages: 3 },
    };

    const html = renderToStaticMarkup(
      <TaskBoardResults
        data={multiPageResponse}
        loading={false}
        error={null}
        hasFilters={false}
        onPageChange={noop}
        onRetry={noop}
        onReset={noop}
      />
    );

    assert.ok(html.includes("Page <strong"));
    assert.ok(html.includes("1</strong> of <strong"));
    assert.ok(html.includes("3</strong>"));
    assert.ok(html.includes("Previous"));
    assert.ok(html.includes("Next"));
  });
});

describe("TaskBoardLegacyDialog component", () => {
  const { allStatusesResponse } = createTaskBoardFixtures();
  const legacyTask = allStatusesResponse.tasks.find((t) => t.id === "task_demo_legacy");

  it("renders legacy task details with read-only fields", () => {
    const html = renderToStaticMarkup(
      <TaskBoardLegacyDetails task={legacyTask!} onClose={noop} />
    );

    assert.ok(html.includes("An older checklist task"));
    assert.ok(html.includes("No goal / Legacy task"));
    assert.ok(html.includes("Points: Not set"));
    assert.ok(html.includes("Close"));
  });

});
