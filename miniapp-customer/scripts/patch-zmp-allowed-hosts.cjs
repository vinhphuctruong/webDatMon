const fs = require("node:fs");
const path = require("node:path");

function readFileSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function writeFileIfChanged(filePath, before, after) {
  if (before === after) {
    return false;
  }
  fs.writeFileSync(filePath, after, "utf8");
  return true;
}

function hasCheck(content, check) {
  if (!check) {
    return false;
  }
  if (typeof check === "string") {
    return content.includes(check);
  }
  return check.test(content);
}

function applyLiteralPatch(content, find, replace, check) {
  if (hasCheck(content, check) || content.includes(replace)) {
    return { content, changed: false, alreadyPatched: true, found: true };
  }
  if (!content.includes(find)) {
    return { content, changed: false, alreadyPatched: false, found: false };
  }
  return {
    content: content.replace(find, replace),
    changed: true,
    alreadyPatched: false,
    found: true,
  };
}

function applyRegexPatch(content, find, replace, check) {
  if (hasCheck(content, check)) {
    return { content, changed: false, alreadyPatched: true, found: true };
  }
  if (!find.test(content)) {
    return { content, changed: false, alreadyPatched: false, found: false };
  }
  return {
    content: content.replace(find, replace),
    changed: true,
    alreadyPatched: false,
    found: true,
  };
}

function patchZmpCliCore(cwd) {
  const targets = [
    {
      file: path.join(cwd, "node_modules/zmp-cli-core/dist/index.js"),
      patches: [
        {
          type: "literal",
          find: "'hmr':_0x1871f3",
          replace: "'hmr':_0x1871f3,'allowedHosts':!![]",
          check: "'hmr':_0x1871f3,'allowedHosts':!![]",
          label: "cjs-start-local",
        },
        {
          type: "literal",
          find: "'allowedHosts':!![]},'define'",
          replace:
            "'allowedHosts':!![],'proxy':{'/api':{'target':process['env']['VITE_API_PROXY_TARGET']||'http://localhost:8081','changeOrigin':!![],'secure':![]}}},'define'",
          check:
            "'proxy':{'/api':{'target':process['env']['VITE_API_PROXY_TARGET']||'http://localhost:8081','changeOrigin':!![],'secure':![]}}",
          label: "cjs-start-local-proxy",
        },
        {
          type: "literal",
          find: "'cors':{'origin':/(https|zbrowser):\\/\\/h5\\.zdn\\.vn/}",
          replace:
            "'cors':{'origin':/(https|zbrowser):\\/\\/h5\\.zdn\\.vn/},'allowedHosts':!![]",
          check:
            "'cors':{'origin':/(https|zbrowser):\\/\\/h5\\.zdn\\.vn/},'allowedHosts':!![]",
          label: "cjs-start-device",
        },
      ],
    },
    {
      file: path.join(cwd, "node_modules/zmp-cli-core/dist/esm/start/start-local.js"),
      patches: [
        {
          type: "regex",
          find: /hmr,\r?\n\s*},/,
          replace: "hmr,\n                allowedHosts: true,\n            },",
          check: /allowedHosts:\s*true/,
          label: "esm-start-local",
        },
        {
          type: "regex",
          find: /allowedHosts:\s*true,\r?\n\s*},/,
          replace:
            "allowedHosts: true,\n                proxy: {\n                    \"/api\": {\n                        target: process.env.VITE_API_PROXY_TARGET || \"http://localhost:8081\",\n                        changeOrigin: true,\n                        secure: false,\n                    },\n                },\n            },",
          check: /proxy:\s*{\s*"\/api"/,
          label: "esm-start-local-proxy",
        },
      ],
    },
    {
      file: path.join(cwd, "node_modules/zmp-cli-core/dist/esm/start/start-device.js"),
      patches: [
        {
          type: "regex",
          find: /cors:\s*{\r?\n\s*origin:\s*\/\(https\|zbrowser\):\\\/\\\/h5\\\.zdn\\\.vn\/,\r?\n\s*},\r?\n\s*},/,
          replace:
            "cors: {\n                    origin: /(https|zbrowser):\\/\\/h5\\.zdn\\.vn/,\n                },\n                allowedHosts: true,\n            },",
          check: /allowedHosts:\s*true/,
          label: "esm-start-device",
        },
        {
          type: "regex",
          find: /allowedHosts:\s*true,\r?\n\s*},/,
          replace:
            "allowedHosts: true,\n                proxy: {\n                    \"/api\": {\n                        target: process.env.VITE_API_PROXY_TARGET || \"http://localhost:8081\",\n                        changeOrigin: true,\n                        secure: false,\n                    },\n                },\n            },",
          check: /proxy:\s*{\s*"\/api"/,
          label: "esm-start-device-proxy",
        },
      ],
    },
    {
      file: path.join(cwd, "node_modules/zmp-cli/start/index.js"),
      patches: [
        {
          type: "literal",
          find: "'config':{'host':_0x32f8e0(0x150)",
          replace: "'config':{'hostname':'0.0.0.0'",
          check: "'config':{'hostname':'0.0.0.0'",
          label: "zmp-cli-start-hostname",
        },
        {
          type: "literal",
          find: "'config':{'hostname':_0x32f8e0(0x150)",
          replace: "'config':{'hostname':'0.0.0.0'",
          check: "'config':{'hostname':'0.0.0.0'",
          label: "zmp-cli-start-hostname-hardcode",
        },
      ],
    },
    {
      file: path.join(cwd, "node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js"),
      patches: [
        {
          type: "literal",
          find: "if (isFileOrExtensionProtocolRE.test(host)) {\n    return true;\n  }",
          replace:
            "if (isFileOrExtensionProtocolRE.test(host)) {\n    return true;\n  }\n  const normalizedHost = host.trim().toLowerCase();\n  if (normalizedHost.endsWith('.ngrok-free.dev')) {\n    return true;\n  }",
          check: "normalizedHost.endsWith('.ngrok-free.dev')",
          label: "vite-allow-ngrok-host",
        },
      ],
    },
  ];

  const logs = [];
  let totalChanged = 0;

  for (const target of targets) {
    const original = readFileSafe(target.file);
    if (original === null) {
      logs.push(`[skip] Missing: ${target.file}`);
      continue;
    }

    let current = original;
    let fileChanged = false;

    for (const patch of target.patches) {
      const result =
        patch.type === "regex"
          ? applyRegexPatch(current, patch.find, patch.replace, patch.check)
          : applyLiteralPatch(current, patch.find, patch.replace, patch.check);
      current = result.content;
      if (result.changed) {
        fileChanged = true;
        logs.push(`[patch] ${patch.label}`);
      } else if (result.alreadyPatched) {
        logs.push(`[ok] ${patch.label} already patched`);
      } else if (!result.found) {
        logs.push(`[warn] ${patch.label} pattern not found`);
      }
    }

    if (fileChanged && writeFileIfChanged(target.file, original, current)) {
      totalChanged += 1;
      logs.push(`[write] ${target.file}`);
    }
  }

  return { totalChanged, logs };
}

function main() {
  const cwd = process.cwd();
  const result = patchZmpCliCore(cwd);
  for (const line of result.logs) {
    console.log(line);
  }
}

main();
