import { execSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const reactVersion = process.argv[2];
if (!reactVersion) {
  console.error("Usage: node scripts/validate-consumer.mjs <react-version>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureSrc = path.join(root, "test", "consumer-fixture");
const workDir = mkdtempSync(path.join(tmpdir(), "oc-react-sdk-consumer-"));

function run(command, cwd = workDir) {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, npm_config_package_lock: "false" },
  }).trim();
}

try {
  cpSync(fixtureSrc, workDir, { recursive: true });

  const tarball = run("npm pack", root);
  const tarballPath = path.join(root, tarball);

  const typesReact =
    reactVersion.startsWith("18.") ? "18.3.12" : "19.0.10";
  const typesReactDom =
    reactVersion.startsWith("18.") ? "18.3.1" : "19.0.4";

  writeFileSync(
    path.join(workDir, "package.json"),
    JSON.stringify(
      {
        name: "ordercloud-react-sdk-consumer-fixture",
        private: true,
        type: "module",
        scripts: {
          build: "vite build",
        },
        dependencies: {
          "@ordercloud/react-sdk": `file:${tarballPath}`,
          "@hookform/resolvers": "^5.7.1",
          "@tanstack/react-query": "^5.62.2",
          "@tanstack/react-table": "^8.20.5",
          axios: "^1.7.0",
          "ordercloud-javascript-sdk": "^12.0.0",
          react: reactVersion,
          "react-dom": reactVersion,
          "react-hook-form": "^7.53.2",
        },
        devDependencies: {
          "@types/react": typesReact,
          "@types/react-dom": typesReactDom,
          "@vitejs/plugin-react": "^4.5.1",
          typescript: "^5.2.2",
          vite: "^6.3.5",
        },
      },
      null,
      2
    )
  );

  run("npm install");

  const lsOutput = run("npm ls react react-dom --all");
  const reactMatches = [...lsOutput.matchAll(/react@([^\s]+)/g)].map(
    (match) => match[1]
  );
  const reactDomMatches = [...lsOutput.matchAll(/react-dom@([^\s]+)/g)].map(
    (match) => match[1]
  );

  const uniqueReact = [...new Set(reactMatches)];
  const uniqueReactDom = [...new Set(reactDomMatches)];

  if (uniqueReact.length !== 1 || uniqueReactDom.length !== 1) {
    console.error("Expected exactly one react and one react-dom version");
    console.error(lsOutput);
    process.exit(1);
  }

  for (const [packageName, resolvedVersion] of [
    ["react", uniqueReact[0]],
    ["react-dom", uniqueReactDom[0]],
  ]) {
    if (!resolvedVersion.includes(reactVersion)) {
      console.error(
        `Expected ${packageName} ${reactVersion}, resolved ${resolvedVersion}`
      );
      process.exit(1);
    }
  }

  run("npm run build");

  const distIndex = path.join(workDir, "dist", "index.html");
  const built = readFileSync(distIndex, "utf8");
  if (!built.includes("root")) {
    console.error("Consumer build did not emit expected HTML");
    process.exit(1);
  }

  console.log(
    `Consumer validation passed for React ${reactVersion} (react=${uniqueReact[0]}, react-dom=${uniqueReactDom[0]})`
  );

  rmSync(tarballPath, { force: true });
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
