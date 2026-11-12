const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const envConfigPath = path.resolve(__dirname, "../config/env.js");

const baseEnv = {
  PORT: "5000",
  MONGODB_URI: "mongodb://localhost:27017/harevent_test",
  FIREBASE_PROJECT_ID: "harevent-test",
};

function runEnvValidation(overrides = {}) {
  const childEnv = {
    ...baseEnv,
    ...overrides,
  };

  // Ensure every test starts with controlled environment variables.
  const controlledEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ...childEnv,
  };

  const result = spawnSync(
    process.execPath,
    ["-e", `require(${JSON.stringify(envConfigPath)})`],
    {
      env: controlledEnv,
      encoding: "utf8",
      timeout: 5000,
    },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: `${result.stdout}\n${result.stderr}`,
  };
}

function assertValidConfiguration(overrides = {}) {
  const result = runEnvValidation(overrides);

  assert.equal(
    result.status,
    0,
    `Expected valid configuration, but child process failed:\n${result.output}`,
  );
}

function assertInvalidConfiguration(overrides = {}, expectedMessage) {
  const result = runEnvValidation(overrides);

  assert.equal(
    result.status,
    1,
    `Expected validation failure, but child process exited with ${result.status}:\n${result.output}`,
  );

  assert.match(result.output, /Invalid environment configuration:/);

  if (expectedMessage) {
    assert.match(result.output, expectedMessage);
  }
}

test("development without CLIENT_URL should pass", () => {
  assertValidConfiguration({
    NODE_ENV: "development",
  });
});

test("test environment without CLIENT_URL should pass", () => {
  assertValidConfiguration({
    NODE_ENV: "test",
  });
});

test("production without CLIENT_URL should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "production",
    },
    /CLIENT_URL: CLIENT_URL is required in production/,
  );
});

test("production with a valid HTTPS origin should pass", () => {
  assertValidConfiguration({
    NODE_ENV: "production",
    CLIENT_URL: "https://harevent.example.com",
  });
});

test("development with a valid localhost origin should pass", () => {
  assertValidConfiguration({
    NODE_ENV: "development",
    CLIENT_URL: "http://localhost:5173",
  });
});

test("CLIENT_URL with surrounding whitespace should pass after trimming", () => {
  assertValidConfiguration({
    NODE_ENV: "production",
    CLIENT_URL: "  https://harevent.example.com  ",
  });
});

test("CLIENT_URL using FTP protocol should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "production",
      CLIENT_URL: "ftp://harevent.example.com",
    },
    /CLIENT_URL: CLIENT_URL must use HTTP or HTTPS/,
  );
});

test("CLIENT_URL containing a path should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "production",
      CLIENT_URL: "https://harevent.example.com/dashboard",
    },
    /CLIENT_URL: CLIENT_URL must use HTTP or HTTPS/,
  );
});

test("CLIENT_URL containing query parameters should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "production",
      CLIENT_URL: "https://harevent.example.com?source=test",
    },
    /CLIENT_URL: CLIENT_URL must use HTTP or HTTPS/,
  );
});

test("CLIENT_URL containing credentials should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "production",
      CLIENT_URL: "https://user:password@harevent.example.com",
    },
    /CLIENT_URL: CLIENT_URL must use HTTP or HTTPS/,
  );
});

test("unsupported NODE_ENV should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "staging",
    },
    /NODE_ENV/,
  );
});

test("invalid CLIENT_URL should fail", () => {
  assertInvalidConfiguration(
    {
      NODE_ENV: "production",
      CLIENT_URL: "not-a-valid-url",
    },
    /CLIENT_URL/,
  );
});
