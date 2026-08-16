import { describe, expect, it } from "vitest";

import {
  validateDevelopmentDatabaseEnvironment,
  validateDevelopmentResetEnvironment
} from "../src/development-database.js";

describe("development database safeguards", () => {
  it("accepts the expected local development database", () => {
    expect(
      validateDevelopmentDatabaseEnvironment({
        DATABASE_URL: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os",
        NODE_ENV: "development"
      })
    ).toEqual({
      databaseName: "bridge_os",
      databaseUrl: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os"
    });
  });

  it("rejects seeding outside development or against a remote host", () => {
    expect(() =>
      validateDevelopmentDatabaseEnvironment({
        DATABASE_URL: "postgres://bridge_os@example.com:5432/bridge_os",
        NODE_ENV: "development"
      })
    ).toThrow("localhost");

    expect(() =>
      validateDevelopmentDatabaseEnvironment({
        DATABASE_URL: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os",
        NODE_ENV: "production"
      })
    ).toThrow();
  });

  it("rejects production-like database names", () => {
    expect(() =>
      validateDevelopmentDatabaseEnvironment({
        DATABASE_URL: "postgres://postgres@localhost:5432/bridge_os_production",
        NODE_ENV: "development"
      })
    ).toThrow("production-like");
  });

  it("requires an explicit reset confirmation token", () => {
    expect(() =>
      validateDevelopmentResetEnvironment({
        DATABASE_URL: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os",
        NODE_ENV: "development"
      })
    ).toThrow();

    expect(
      validateDevelopmentResetEnvironment({
        ALLOW_DATABASE_RESET: "bridge-os-local-reset",
        DATABASE_URL: "postgres://bridge_os:bridge_os@127.0.0.1:5432/bridge_os_dev",
        NODE_ENV: "development"
      }).databaseName
    ).toBe("bridge_os_dev");
  });
});
