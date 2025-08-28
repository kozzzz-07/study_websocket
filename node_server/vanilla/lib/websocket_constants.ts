export const PORT = 8080;

// https://nodejs.org/api/process.html
export const CUSTOM_ERRORS = [
  "uncaughtException",
  "unhandledRejection",
  "SIGINT", // ターミナルで "Ctrl + C" によるイベントをトリガーした場合に発生
] as const;
