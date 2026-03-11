import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  readState,
  writeState,
  clearState,
  listStates,
} from "../extensions/state-manager-utils.js";

describe("state-manager-utils", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "state-"));
  });

  afterEach(() => {
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  describe("writeState / readState", () => {
    it("writes and reads state", () => {
      writeState(stateDir, "test", { active: true, count: 1 });
      const state = readState(stateDir, "test");
      expect(state).toMatchObject({ active: true, count: 1 });
    });

    it("returns undefined for nonexistent state", () => {
      expect(readState(stateDir, "nonexistent")).toBeUndefined();
    });

    it("overwrites existing state", () => {
      writeState(stateDir, "test", { v: 1 });
      writeState(stateDir, "test", { v: 2 });
      expect(readState(stateDir, "test")).toMatchObject({ v: 2 });
    });

    it("adds timestamp to written state", () => {
      writeState(stateDir, "test", { active: true });
      const state = readState(stateDir, "test") as Record<string, unknown>;
      expect(state._timestamp).toBeDefined();
      expect(typeof state._timestamp).toBe("number");
    });
  });

  describe("clearState", () => {
    it("removes state file", () => {
      writeState(stateDir, "test", { active: true });
      clearState(stateDir, "test");
      expect(readState(stateDir, "test")).toBeUndefined();
    });

    it("does not throw for nonexistent state", () => {
      expect(() => clearState(stateDir, "nonexistent")).not.toThrow();
    });
  });

  describe("listStates", () => {
    it("returns empty array for empty dir", () => {
      expect(listStates(stateDir)).toEqual([]);
    });

    it("lists all state keys", () => {
      writeState(stateDir, "alpha", { a: 1 });
      writeState(stateDir, "beta", { b: 2 });
      const keys = listStates(stateDir).sort();
      expect(keys).toEqual(["alpha", "beta"]);
    });
  });
});
