import { validateTaskType, type TaskTypeConfig } from "@/lib/points";

export type { TaskTypeConfig };

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Client-side validation for the task-type form: the points rules plus slug
 * uniqueness against the currently loaded list. The server enforces the same
 * rules (plus uniqueness in the DB) in `src/lib/task-types-server.ts`.
 */
export function validateTaskTypeForm(
  input: { slug: string; points: number; maxPoints: number },
  existing: TaskTypeConfig[],
  editingId?: string
): string[] {
  const errors = validateTaskType({ points: input.points, maxPoints: input.maxPoints });
  if (!input.slug.trim()) {
    errors.push("Slug is required.");
  }
  const clash = existing.some((type) => type.slug === input.slug.trim() && type.id !== editingId);
  if (clash) {
    errors.push("Another task type already uses this slug.");
  }
  return errors;
}
