const express = require('express');
const { spawn, exec } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3005;

const corsOptions = {
  origin: [
    "http://localhost:3001",
    "http://localhost:5175",
    "http://localhost:5176",
  ]
}

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Project configurations with OS variations
const projects = {
  'mod_ticketing': {
    name: 'Ticketing System',
    path: {
      win32: 'c:\\antino_mod\\mod_ticketing\\mod_ticketing_offline',
      linux: '/home/user/Antino/mod_ticketing/mod_ticketing_offline'
    },
    backend: {
      path: 'server',
      win32_command: 'call venv\\Scripts\\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      linux_command: 'source venv/bin/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      port: 8000,
      readyPatterns: [
        { pattern: 'Started server process', progress: 30 },
        { pattern: 'Waiting for application startup', progress: 60 },
        { pattern: 'Application startup complete', progress: 100 }
      ]
    },
    frontend: {
      path: 'client',
      win32_command: 'npm run dev -- --port 5175',
      linux_command: 'npm run dev -- --port 5175',
      port: 5175,
      readyPatterns: [
        { pattern: 'vite', progress: 40 },
        { pattern: 'ready in', progress: 100 }
      ]
    }
  },
  'mod_zoho_rag': {
    name: 'Zoho RAG',
    path: {
      win32: 'c:\\antino_mod\\mod_zoho_rag\\zoho_rag',
      linux: '/home/user/Antino/mod_zoho/zoho_rag'
    },
    backend: {
      path: 'zoho-analytics-rag',
      win32_command: 'call venv\\Scripts\\activate.bat && set API_PORT=8001 && python main.py',
      linux_command: 'source venv/bin/activate && export API_PORT=8001 && python main.py',
      port: 8001,
      readyPatterns: [
        { pattern: 'Initialized session database', progress: 10 },
        { pattern: 'Initializing RAG system', progress: 20 },
        { pattern: 'Initializing vector store', progress: 30 },
        { pattern: 'Loading embedding model', progress: 45 },
        { pattern: 'Embedding model loaded', progress: 70 },
        { pattern: 'Vector store now contains', progress: 90 },
        { pattern: 'Application startup complete', progress: 100 }
      ]
    },
    frontend: {
      path: 'zoho-react',
      win32_command: 'npm run dev -- --port 5176',
      linux_command: 'npm run dev -- --port 5176',
      port: 5176,
      readyPatterns: [
        { pattern: 'vite', progress: 40 },
        { pattern: 'ready in', progress: 100 }
      ]
    }
  }
};

const processes = {};
const startupProgress = {};

// Helper to check if a port is in use
const checkPort = (port, osType = process.platform) => {
  return new Promise((resolve) => {
    let cmd = '';
    if (osType === 'win32') {
      cmd = `netstat -ano | findstr :${port} | findstr LISTENING`;
    } else {
      cmd = `lsof -i :${port} -sTCP:LISTEN -t`;
    }

    exec(cmd, (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

app.get('/projects', async (req, res) => {
  const { os = process.platform } = req.query;
  const projectsWithStatus = await Promise.all(
    Object.keys(projects).map(async (key) => {
      const p = projects[key];
      const backendRunning = await checkPort(p.backend.port, os);
      const frontendRunning = await checkPort(p.frontend.port, os);
      const projectPath = p.path[os] || p.path['win32'];

      // If port is running, clear progress if not already done
      if (backendRunning) delete startupProgress[`${key}-backend`];
      if (frontendRunning) delete startupProgress[`${key}-frontend`];

      return {
        id: key,
        name: p.name,
        path: projectPath,
        backend: { 
          ...p.backend, 
          running: backendRunning,
          progress: startupProgress[`${key}-backend`] || (backendRunning ? 100 : 0)
        },
        frontend: { 
          ...p.frontend, 
          running: frontendRunning,
          progress: startupProgress[`${key}-frontend`] || (frontendRunning ? 100 : 0)
        }
      };
    })
  );
  res.json(projectsWithStatus);
});

app.post('/start', (req, res) => {
  const { projectId, type, os = process.platform } = req.body;
  const project = projects[projectId];
  if (!project) return res.status(404).send('Project not found');

  const config = project[type];
  const projectPath = project.path[os] || project.path['win32'];
  const fullPath = path.join(projectPath, config.path);
  const command = os === 'win32' ? config.win32_command : config.linux_command;

  console.log(`Starting ${type} for ${projectId} on ${os} in ${fullPath}`);

  const processId = `${projectId}-${type}`;
  startupProgress[processId] = 5; // Initial signal that it's starting

  const child = spawn(command, [], {
    cwd: fullPath,
    shell: true,
    detached: true,
    stdio: 'pipe'
  });

  child.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[${processId}] ${output.trim()}`);
    
    if (config.readyPatterns) {
      config.readyPatterns.forEach(rp => {
        if (output.includes(rp.pattern)) {
          startupProgress[processId] = Math.max(startupProgress[processId] || 0, rp.progress);
        }
      });
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    // Some frameworks log important info to stderr
    if (config.readyPatterns) {
      config.readyPatterns.forEach(rp => {
        if (output.includes(rp.pattern)) {
          startupProgress[processId] = Math.max(startupProgress[processId] || 0, rp.progress);
        }
      });
    }
  });

  child.on('exit', () => {
    delete startupProgress[processId];
    delete processes[processId];
  });

  child.unref();
  processes[processId] = child;

  res.json({ status: 'started', processId });
});

app.post('/kill-port', (req, res) => {
  const { port, os = process.platform } = req.body;
  if (!port) return res.status(400).send('Port required');

  console.log(`Killing processes on port ${port} (${os})`);

  if (os === 'win32') {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout) return res.json({ status: 'no process found' });
      const pids = new Set();
      stdout.trim().split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid) && pid !== '0') pids.add(pid);
      });
      if (pids.size === 0) return res.json({ status: 'no process found' });
      let killedCount = 0;
      pids.forEach(pid => {
        exec(`taskkill /F /T /PID ${pid}`, () => {
          killedCount++;
          if (killedCount === pids.size) res.json({ status: 'killed', pids: Array.from(pids) });
        });
      });
    });
  } else {
    exec(`fuser -k ${port}/tcp`, (err) => {
      if (err) return res.json({ status: 'error or no process', error: err.message });
      res.json({ status: 'killed' });
    });
  }
});

app.listen(port, () => {
  console.log(`Orchestrator server listening at http://localhost:${port}`);
  console.log(`Detected Platform: ${process.platform}`);
});
