import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command) {
  return execSync(command, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const packName = run("npm pack --dry-run --json");
const [packMeta] = JSON.parse(packName);
const files = packMeta.files.map((file) => file.path).sort();

const allowedExact = new Set([
  "package.json",
  "README.md",
  "LICENSE",
  "LICENSE.md",
  "CHANGELOG.md",
]);

const unexpected = files.filter(
  (file) => !(allowedExact.has(file) || file.startsWith("dist/") || file === "dist")
);

if (unexpected.length) {
  console.error("Unexpected packaged files:", unexpected);
  process.exit(1);
}

if (!files.includes("package.json") || !files.some((f) => f.startsWith("dist/"))) {
  console.error("Pack archive missing package.json or dist artifacts:", files);
  process.exit(1);
}

const tarball = run("npm pack");
const tarballPath = path.join(root, tarball);

try {
  const extractDir = path.join(root, ".pack-inspect");
  rmSync(extractDir, { recursive: true, force: true });
  run(`mkdir -p "${extractDir}" && tar -xzf "${tarballPath}" -C "${extractDir}"`);

  const distDir = path.join(extractDir, "package", "dist");
  if (!existsSync(distDir)) {
    console.error("Packaged dist directory missing");
    process.exit(1);
  }

  const distFiles = readdirSync(distDir);
  const bundleCandidates = distFiles.filter((name) =>
    /\.(js|cjs|mjs)$/.test(name)
  );

  for (const fileName of bundleCandidates) {
    const contents = readFileSync(path.join(distDir, fileName), "utf8");
    if (
      /from\s+["']react["']|require\(["']react["']\)|from\s+["']react-dom["']|require\(["']react-dom["']\)/.test(
        contents
      ) === false &&
      /\bReact\.createElement\b/.test(contents) &&
      !/external|peer/.test(contents)
    ) {
      // Bundles may reference the React global in UMD; ensure the react package
      // source itself was not inlined by checking for common React internals.
    }

    if (
      /react\.production\.min|react-dom\.production\.min|__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED/.test(
        contents
      )
    ) {
      console.error(`React appears bundled into ${fileName}`);
      process.exit(1);
    }
  }

  console.log("Pack inspection passed:", files.join(", "));
} finally {
  rmSync(tarballPath, { force: true });
  rmSync(path.join(root, ".pack-inspect"), { recursive: true, force: true });
}
