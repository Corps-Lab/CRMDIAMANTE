type AppRuntime = "mock" | "online";

const rawRuntime = (
  import.meta.env.VITE_APP_RUNTIME ||
  import.meta.env.VITE_APP_MODE ||
  ""
)
  .toString()
  .trim()
  .toLowerCase();

export const appRuntime: AppRuntime = rawRuntime === "online" ? "online" : "mock";
export const isOnlineRuntime = appRuntime === "online";
export const isMockRuntime = appRuntime === "mock";
