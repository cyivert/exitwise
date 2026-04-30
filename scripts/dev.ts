type DevProcess = {
  name: string;
  process: Bun.Subprocess<"inherit", "inherit", "inherit">;
};

const apiPort = Number(process.env.PORT ?? 8080);
const vitePort = Number(process.env.VITE_PORT ?? 5173);
const pidFile = ".agents/dev-pids.json";

type DevPidFile = {
  pids: number[];
};

async function stopPreviousDevStack() {
  const file = Bun.file(pidFile);
  if (await file.exists()) {
    try {
      const data = await file.json() as DevPidFile;
      for (const pid of data.pids) {
        if (pid && pid !== process.pid) {
          try {
            process.kill(pid);
          } catch {
            // Process already gone.
          }
        }
      }
      await Bun.write(pidFile, JSON.stringify({ pids: [] }));
    } catch {
      await Bun.write(pidFile, JSON.stringify({ pids: [] }));
    }
  }

  if (process.platform === "win32") {
    const vitePath = `${process.cwd()}\\node_modules\\vite`.replace(/'/g, "''");
    await Bun.spawn([
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.Name -match 'node|bun' -and $_.CommandLine -like '*${vitePath}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ]).exited;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

await stopPreviousDevStack();

async function isPortOpen(port: number) {
  try {
    await fetch(`http://localhost:${port}`, {
      signal: AbortSignal.timeout(500),
    });
    return false;
  } catch {
    // No HTTP listener answered. Fall through to bind check.
  }

  try {
    const server = Bun.serve({
      hostname: "localhost",
      port,
      fetch() {
        return new Response("ok");
      },
    });
    server.stop(true);
    return true;
  } catch {
    return false;
  }
}

async function assertPortOpen(name: string, port: number) {
  if (await isPortOpen(port)) return;

  console.error(
    `${name} port ${port} is already in use. Stop that process or set ${
      name === "api" ? "PORT" : "VITE_PORT"
    } to another port.`
  );
  process.exit(1);
}

await assertPortOpen("api", apiPort);
await assertPortOpen("vite", vitePort);

const processes: DevProcess[] = [
  {
    name: "api",
    process: Bun.spawn(["bun", "run", "server.ts"], {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env: { ...process.env, PORT: String(apiPort) },
    }),
  },
  {
    name: "vite",
    process: Bun.spawn(["bun", "x", "vite", "--host", "localhost", "--port", String(vitePort), "--strictPort"], {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env: {
        ...process.env,
        VITE_API_URL: process.env.VITE_API_URL ?? `http://localhost:${vitePort}`,
      },
    }),
  },
];

await Bun.write(
  pidFile,
  JSON.stringify({
    pids: [process.pid, ...processes.map((child) => child.process.pid).filter(Boolean)],
  })
);

console.log(`Frontend: http://localhost:${vitePort}`);
console.log(`API: http://localhost:${apiPort}`);

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    child.process.kill();
  }

  Bun.write(pidFile, JSON.stringify({ pids: [] })).catch(() => {});

  process.exit(exitCode);
}

process.on("SIGINT", () => stopAll());
process.on("SIGTERM", () => stopAll());

await Promise.race(
  processes.map(async (child) => {
    const exitCode = await child.process.exited;
    if (!shuttingDown) {
      console.error(`${child.name} exited with code ${exitCode}`);
      stopAll(exitCode || 1);
    }
  }),
);
