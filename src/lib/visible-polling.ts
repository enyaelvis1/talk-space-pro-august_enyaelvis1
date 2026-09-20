type PollingEnvironment = {
  document: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
};

// Schedule after completion so a slow request cannot overlap the next poll.
export function startVisiblePolling(
  task: () => Promise<unknown>,
  intervalMs: number,
  environment: PollingEnvironment = {
    document,
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (id) => window.clearTimeout(id),
  },
) {
  let stopped = false;
  let running = false;
  let timer: number | undefined;
  const clear = () => {
    if (timer !== undefined) environment.clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    clear();
    if (!stopped && !environment.document.hidden && !running)
      timer = environment.setTimeout(() => void run(), intervalMs);
  };
  const run = async () => {
    clear();
    if (stopped || running || environment.document.hidden) return;
    running = true;
    try {
      await task();
    } catch (error) {
      console.error("Background refresh failed.", error);
    } finally {
      running = false;
      schedule();
    }
  };
  const onVisibilityChange = () => {
    if (environment.document.hidden) clear();
    else void run();
  };
  environment.document.addEventListener("visibilitychange", onVisibilityChange);
  schedule();
  return () => {
    stopped = true;
    clear();
    environment.document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
