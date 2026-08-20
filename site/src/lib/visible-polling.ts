export function startVisiblePolling(refresh: () => void | Promise<unknown>, intervalMs: number): () => void {
  let timer: number | null = null;
  let disposed = false;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
  const run = () => {
    if (!disposed && document.visibilityState === "visible") void refresh();
  };
  const start = () => {
    stop();
    if (disposed || document.visibilityState !== "visible") return;
    run();
    timer = window.setInterval(run, intervalMs);
  };
  const onVisibility = () => start();

  document.addEventListener("visibilitychange", onVisibility);
  start();
  return () => {
    disposed = true;
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
