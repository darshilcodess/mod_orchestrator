const express = require('express');
const { spawn, exec } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Project configurations
const projects = {
  'mod_ticketing': {
    name: 'Ticketing System',
    path: 'c:\\antino_mod\\mod_ticketing\\mod_ticketing_offline',
    backend: {
      path: 'server',
      command: 'call venv\\Scripts\\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      port: 8000
    },
    frontend: {
      path: 'client',
      command: 'npm run dev -- --port 5175',
      port: 5175
    }
  },
  'mod_zoho_rag': {
    name: 'Zoho RAG',
    path: 'c:\\antino_mod\\mod_zoho_rag\\zoho_rag',
    backend: {
      path: 'zoho-analytics-rag',
      command: 'call venv\\Scripts\\activate.bat && set API_PORT=8001 && python main.py',
      port: 8001
    },
    frontend: {
      path: 'zoho-react',
      command: 'npm run dev -- --port 5176',
      port: 5176
    }
  }
};

const processes = {};

// Helper to check if a port is in use
const checkPort = (port) => {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

app.get('/projects', async (req, res) => {
  const projectsWithStatus = await Promise.all(
    Object.keys(projects).map(async (key) => {
      const p = projects[key];
      const backendRunning = await checkPort(p.backend.port);
      const frontendRunning = await checkPort(p.frontend.port);
      return {
        id: key,
        ...p,
        backend: { ...p.backend, running: backendRunning },
        frontend: { ...p.frontend, running: frontendRunning }
      };
    })
  );
  res.json(projectsWithStatus);
});

app.post('/start', (req, res) => {
  const { projectId, type } = req.body;
  const project = projects[projectId];
  if (!project) return res.status(404).send('Project not found');

  const config = project[type];
  const fullPath = path.join(project.path, config.path);

  console.log(`Starting ${type} for ${projectId} in ${fullPath}`);

  // For Windows, we use shell: true to handle environment variables and composite commands
  const child = spawn(config.command, [], {
    cwd: fullPath,
    shell: true,
    detached: true,
    stdio: 'ignore' // We don't want to hang the server waiting for output
  });

  child.unref(); // Allow the parent to exit independently of the child

  const processId = `${projectId}-${type}`;
  processes[processId] = child;

  res.json({ status: 'started', processId });
});

app.post('/kill-port', (req, res) => {
  const { port } = req.body;
  if (!port) return res.status(400).send('Port required');

  console.log(`Killing processes on port ${port}`);

  exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
    if (err || !stdout) {
      return res.json({ status: 'no process found' });
    }

    const lines = stdout.trim().split('\n');
    const pids = new Set();
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid) && pid !== '0') pids.add(pid);
    });

    if (pids.size === 0) return res.json({ status: 'no process found' });

    let killedCount = 0;
    pids.forEach(pid => {
      exec(`taskkill /F /T /PID ${pid}`, (killErr) => {
        killedCount++;
        if (killedCount === pids.size) {
          res.json({ status: 'killed', pids: Array.from(pids) });
        }
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Orchestrator server listening at http://localhost:${port}`);
});
