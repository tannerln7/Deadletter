import { parseArgs } from "node:util";

import { initializeShareDatabase, revokeAllActiveGrants } from "../lib/server/shares/database.ts";

const { positionals } = parseArgs({ allowPositionals: true });
const command = positionals[0];
if (command === "init") {
  initializeShareDatabase();
  console.log("Share database schema is ready.");
} else if (command === "revoke-all") {
  console.log(`Revoked ${revokeAllActiveGrants()} active grant(s).`);
} else {
  console.error("Usage: pnpm shares:db <init|revoke-all>");
  process.exitCode = 2;
}
