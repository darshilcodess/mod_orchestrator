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
    "http://127.0.0.1:3001",
  ]
}

app.use(cors(corsOptions));
 
// Parse JSON and urlencoded bodies so req.body is populated
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Project configurations
const projects = {
  ocr: {
    name: 'OCR',
    path: 'C:\\MOD_DEMO\\Mod_OCR',
    backend: {
      // Project root contains `ocr_system/` and `venv/`
      path: '.',
      command: 'call venv\\Scripts\\activate.bat && python -m ocr_system.app.main',
      port: 8005,
      docsPath: '/docs',
      docsLabel: 'Docs',
    },
    frontend: {
      path: 'frontend',
      command: 'npm run dev',
      port: 5173,
    },
  },
  rag: {
    name: 'RAG',
    path: 'C:\\MOD_DEMO\\zoho_rag',
    backend: {
      path: 'zoho-analytics-rag',
      command: 'call venv\\Scripts\\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8010 --reload',
      port: 8010,
      docsPath: '/docs',
      docsLabel: 'Docs',
    },
    frontend: {
      path: 'zoho-react',
      command: 'npm run dev -- --port 5175',
      port: 5175,
    },
  },
  ticketing: {
    name: 'Ticketing System',
    path: 'C:\\MOD_DEMO\\mod_ticketing_offline',
    backend: {
      path: 'server',
      command: 'call venv\\Scripts\\activate.bat && alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app --reload --port 8015',
      port: 8015,
      docsPath: '/docs',
      docsLabel: 'Docs',
    },
    frontend: {
      path: 'client',
      command: 'npm run dev -- --port 5177',
      port: 5177,
    },
  },
  nl2sql: {
    name: 'NL2SQL',
    path: 'C:\\MOD_DEMO\\DGIS_Pipeline-main',
    backend: {
      path: 'nl2sql_project',
      // venv is one level up from `nl2sql_project/`
      command: 'call ..\\venv\\Scripts\\activate.bat && python api.py',
      port: 8020,
      docsPath: '/api/health',
      docsLabel: 'Health',
    },
    frontend: {
      path: 'nl2sql_project',
      command: 'call ..\\venv\\Scripts\\activate.bat && python frontend_server.py',
      port: 5179,
    },
  },
};
 
const processes = {};
const startupProgress = {};
 
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

      const backendProcessId = `${key}-backend`;
      const frontendProcessId = `${key}-frontend`;
      const backendProgress = startupProgress[backendProcessId] || 0;
      const frontendProgress = startupProgress[frontendProcessId] || 0;
      return {
        id: key,
        ...p,
        backend: { ...p.backend, running: backendRunning, progress: backendRunning ? 100 : backendProgress },
        frontend: { ...p.frontend, running: frontendRunning, progress: frontendRunning ? 100 : frontendProgress }
      };
    })
  );
  res.json(projectsWithStatus);
});
 
app.post('/start', (req, res) => {
  const { projectId, type } = req.body || {};
 
  if (!projectId || !type) {
    return res.status(400).json({ error: 'projectId and type are required in the request body' });
  }
 
  const project = projects[projectId];
  if (!project) return res.status(404).send('Project not found');

  const config = project[type];
  if (!config) return res.status(404).send('Project type not found');

  const fullPath = path.join(project.path, config.path);
  const command = config.command;
  console.log(`Starting ${type} for ${projectId} in ${fullPath}`);

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
