import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongod = await MongoMemoryServer.create();

try {
  const child = spawn(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      "test/caseHelix.test.js",
      "test/round3_investigation.test.js",
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: {
        ...process.env,
        MONGO_URI_TEST: mongod.getUri("cypherclash_test"),
      },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await mongod.stop();
}
