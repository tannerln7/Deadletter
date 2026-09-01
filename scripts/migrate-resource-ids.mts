import { parseArgs } from "node:util";

import { migrateResourceIds } from "../lib/server/resource-migration.ts";

const { values } = parseArgs({
  options: {
    check: { type: "boolean" },
    write: { type: "boolean" },
    "archive-root": { type: "string" },
  },
  strict: true,
});

if (values.check === values.write) {
  console.error("Choose exactly one of --check or --write.");
  process.exitCode = 2;
} else {
  const result = await migrateResourceIds({ archiveRoot: values["archive-root"], write: values.write });
  for (const issue of result.issues) console.log(`${issue.kind.toUpperCase()} ${issue.file}: ${issue.message}`);
  for (const file of result.changed) console.log(`UPDATED ${file}`);
  if (result.wrote) console.log(`Assigned ${result.missingCount} stable resource ID(s).`);
  else if (result.missingCount === 0 && result.issues.length === 0) console.log("All resources have valid unique IDs.");
  process.exitCode = result.issues.some((issue) => issue.kind !== "missing") || (values.check && result.missingCount > 0) ? 1 : 0;
}
