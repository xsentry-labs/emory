import path from "node:path";

export const dataDir = () => path.resolve(process.env.DATA_DIR || "./data");

export const workerIntervalMs = () => {
  const s = Number(process.env.WORKER_INTERVAL_SECONDS);
  return (Number.isFinite(s) && s >= 5 ? s : 60) * 1000;
};
