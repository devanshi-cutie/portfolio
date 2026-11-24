import { UserError } from "../lib/env";

export interface SeedArgs {
  dryRun: boolean;
  onlyDb: boolean;
  force: boolean;
  concurrency: number;
  help: boolean;
}

export const USAGE = `Usage: npm run seed -- [flags]

  --dry-run          print the plan (files, public_ids, compression) — no network, no credentials
  --only-db          skip Cloudinary uploads; write DB rows for the deterministic public_ids
  --force            re-upload assets and overwrite seeded DB rows and site settings
  --concurrency=N    parallel uploads (default 2, max 8)
  --help             show this help`;

export function parseArgs(argv: string[]): SeedArgs {
  const args: SeedArgs = { dryRun: false, onlyDb: false, force: false, concurrency: 2, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--only-db") args.onlyDb = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--concurrency" || arg.startsWith("--concurrency=")) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 8) {
        throw new UserError(`--concurrency must be an integer from 1 to 8 (got "${raw ?? ""}").`);
      }
      args.concurrency = n;
    } else {
      throw new UserError(`Unknown flag "${arg}".\n\n${USAGE}`);
    }
  }
  return args;
}
