import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Read state by key. Returns undefined if not found.
 */
export function readState(stateDir: string, key: string): Record<string, unknown> | undefined {
  const filePath = path.join(stateDir, `${key}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Write state atomically. Adds _timestamp for staleness detection.
 */
export function writeState(stateDir: string, key: string, data: Record<string, unknown>): void {
  fs.mkdirSync(stateDir, { recursive: true });
  const filePath = path.join(stateDir, `${key}.json`);
  const withTimestamp = { ...data, _timestamp: Date.now() };
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(withTimestamp, null, 2));
  fs.renameSync(tmpPath, filePath);
}

/**
 * Clear (delete) a state by key.
 */
export function clearState(stateDir: string, key: string): void {
  const filePath = path.join(stateDir, `${key}.json`);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore if doesn't exist
  }
}

/**
 * List all state keys in the state directory.
 */
export function listStates(stateDir: string): string[] {
  if (!fs.existsSync(stateDir)) return [];
  return fs
    .readdirSync(stateDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/**
 * Check if a state is stale (older than timeout seconds).
 */
export function isStale(state: Record<string, unknown>, timeoutSeconds: number): boolean {
  const timestamp = state._timestamp as number | undefined;
  if (!timestamp) return true;
  return (Date.now() - timestamp) / 1000 > timeoutSeconds;
}
