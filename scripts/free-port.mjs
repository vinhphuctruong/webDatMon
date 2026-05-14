import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
}

function getListeningPids(port) {
  const out = run(`netstat -ano | findstr :${port}`);
  const lines = out
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);

  const pids = new Set();
  for (const line of lines) {
    // Example: TCP  0.0.0.0:8081  0.0.0.0:0  LISTENING  24748
    if (!/LISTENING/i.test(line)) continue;
    const parts = line.split(/\s+/g);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  return [...pids];
}

function getProcessName(pid) {
  // CSV output: "Image Name","PID",...
  const out = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).trim();
  if (!out || out.startsWith("INFO:")) return null;
  const first = out.split(",")[0] ?? "";
  return first.replace(/^"|"$/g, "");
}

function killPid(pid) {
  run(`taskkill /PID ${pid} /F`);
}

const portArg = process.argv[2];
const port = Number(portArg);
if (!portArg || !Number.isInteger(port) || port <= 0) {
  console.error("Usage: node scripts/free-port.mjs <port>");
  process.exit(2);
}

const forceKill = process.env.FORCE_KILL === "1";

let pids = [];
try {
  pids = getListeningPids(port);
} catch {
  // findstr returns non-zero when no matches
  process.exit(0);
}

if (pids.length === 0) process.exit(0);

for (const pid of pids) {
  const name = getProcessName(pid) || "unknown";
  const isNode = name.toLowerCase() === "node.exe" || name.toLowerCase() === "node";

  if (!isNode && !forceKill) {
    console.error(
      `[free-port] Port ${port} đang bị chiếm bởi PID ${pid} (${name}). ` +
        `Không tự động kill vì không phải node.exe. ` +
        `Hãy tự tắt process đó hoặc chạy lại với FORCE_KILL=1 nếu chắc chắn.`,
    );
    process.exit(1);
  }

  console.log(`[free-port] Killing PID ${pid} (${name}) on port ${port}...`);
  try {
    killPid(pid);
  } catch (e) {
    console.error(`[free-port] Không kill được PID ${pid}:`, e?.message ?? e);
    process.exit(1);
  }
}

