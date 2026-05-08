export function workerHealth() {
  return { ok: true, service: "worker", phase: "gov-01-scaffold" } as const;
}

if (process.env.NODE_ENV !== "test") {
  console.log("Eyther worker scaffold ready for Railway backend jobs");
  setInterval(() => {
    // Keep the Railway worker process alive until real scheduled jobs are wired.
  }, 60_000);
}
