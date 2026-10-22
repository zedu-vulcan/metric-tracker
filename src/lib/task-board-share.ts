export type TaskBoardShareState = {
  status: "idle" | "copied" | "error";
  url: string;
};

/** Owns clipboard attempts and the success timer; errors stay available for manual copy. */
export function createTaskBoardShareController({
  writeText,
  onChange,
}: {
  writeText: (url: string) => Promise<void>;
  onChange: (state: TaskBoardShareState) => void;
}) {
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    attempt += 1;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return {
    async copy(url: string) {
      cancel();
      const current = attempt;
      onChange({ status: "idle", url });
      try {
        await writeText(url);
        if (current !== attempt) return;
        onChange({ status: "copied", url });
        timer = setTimeout(() => {
          timer = undefined;
          onChange({ status: "idle", url: "" });
        }, 1800);
      } catch {
        if (current === attempt) onChange({ status: "error", url });
      }
    },
    reset() {
      cancel();
      onChange({ status: "idle", url: "" });
    },
    dispose: cancel,
  };
}
