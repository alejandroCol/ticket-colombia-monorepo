/**
 * Firebase CLI empaqueta functions en un .zip bajo el TMP del sistema.
 * En algunos Mac/sandboxes /var/folders/.../T falla con EACCES; usamos tmp local.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const tmp = path.join(root, ".firebase-tmp");
fs.mkdirSync(tmp, { recursive: true });

const env = {
  ...process.env,
  TMPDIR: tmp,
  TMP: tmp,
  TEMP: tmp,
};

const extraArgs = process.argv.slice(2);

const r = spawnSync(
  "firebase",
  ["deploy", "--only", "functions", ...extraArgs],
  {
    stdio: "inherit",
    env,
    cwd: root,
    shell: true,
  }
);

process.exit(r.status === null ? 1 : r.status);
