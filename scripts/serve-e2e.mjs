import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const outputRoot = resolve(
  workspace,
  "apps",
  "extension",
  ".output",
  "chrome-mv3",
);
const packageManager = process.env.npm_execpath;
if (!packageManager) {
  throw new Error("Run the E2E suite through pnpm so npm_execpath is set.");
}
const build = spawnSync(
  process.execPath,
  [packageManager, "--filter", "@contextlines/extension", "build"],
  {
    cwd: workspace,
    env: { ...process.env, WXT_PUBLIC_USE_MOCKS: "true" },
    stdio: "inherit",
  },
);

if (build.status !== 0) process.exit(build.status ?? 1);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname === "/" ? "/sidepanel.html" : url.pathname;
  const file = resolve(outputRoot, `.${decodeURIComponent(pathname)}`);
  if (
    !file.startsWith(`${outputRoot}${sep}`) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.listen(4173, "127.0.0.1", () => {
  process.stdout.write("ContextLines E2E server: http://127.0.0.1:4173\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
