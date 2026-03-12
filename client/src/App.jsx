import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Activity, Cpu, Power, RefreshCw, ExternalLink } from 'lucide-react';

const API_URL = 'http://localhost:3000';

function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState({});

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const resp = await axios.get(`${API_URL}/projects`);
      setProjects(resp.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const startProcess = async (projectId, type) => {
    const key = `${projectId}-${type}`;
    if (starting[key]) return;

    setStarting(prev => ({ ...prev, [key]: true }));
    try {
      await axios.post(`${API_URL}/start`, { projectId, type });
      setTimeout(() => {
        setStarting(prev => ({ ...prev, [key]: false }));
        fetchProjects();
      }, 5000);
    } catch (err) {
      setStarting(prev => ({ ...prev, [key]: false }));
      alert('Failed to start');
    }
  };

  const killPort = async (port) => {
    try {
      await axios.post(`${API_URL}/kill-port`, { port });
      setTimeout(fetchProjects, 1000); // Give it a second to free the port
    } catch (err) {
      alert('Failed to kill port');
    }
  };

  return (
    <div className="h-screen w-screen p-8 bg-slate-950 text-slate-100 font-sans">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            MOD Orchestrator
          </h1>
          <p className="text-slate-400 mt-2">Manage your development ecosystem from one place.</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchProjects} className="p-2 hover:bg-slate-800 rounded-lg transition">
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </button>
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2">
            <Activity className="text-emerald-500 w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">System Online</span>
          </div>
        </div>
      </header>

      {loading && projects.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project) => (
            <div key={project.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl hover:border-slate-700 transition-all">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{project.name}</h2>
                    <p className="text-sm text-slate-400 mt-1 truncate max-w-xs">{project.path}</p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Cpu className="text-blue-400 w-6 h-6" />
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Backend Section */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Backend</span>
                      <span className={`w-3 h-3 rounded-full ${project.backend.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}></span>
                    </div>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Port {project.backend.port}</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => startProcess(project.id, 'backend')}
                      disabled={project.backend.running || starting[`${project.id}-backend`]}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${project.backend.running || starting[`${project.id}-backend`] ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                    >
                      <Play className="w-4 h-4" /> {starting[`${project.id}-backend`] ? 'Starting...' : 'Start'}
                    </button>
                    <button 
                      onClick={() => killPort(project.backend.port)}
                      disabled={!project.backend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.backend.running ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border-rose-500/30'}`}
                    >
                      <Power className="w-4 h-4" /> Kill
                    </button>
                    <button 
                      onClick={() => window.open(`http://localhost:${project.backend.port}/docs`, '_blank')}
                      disabled={!project.backend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.backend.running ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border-blue-500/30'}`}
                    >
                      <ExternalLink className="w-4 h-4" /> Docs
                    </button>
                  </div>
                  {starting[`${project.id}-backend`] && (
                    <div className="mt-3 h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 animate-progress"></div>
                    </div>
                  )}
                </div>

                {/* Frontend Section */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Frontend</span>
                      <span className={`w-3 h-3 rounded-full ${project.frontend.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}></span>
                    </div>
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Port {project.frontend.port}</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => startProcess(project.id, 'frontend')}
                      disabled={project.frontend.running || starting[`${project.id}-frontend`]}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${project.frontend.running || starting[`${project.id}-frontend`] ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                    >
                      <Play className="w-4 h-4" /> {starting[`${project.id}-frontend`] ? 'Starting...' : 'Start'}
                    </button>
                    <button 
                      onClick={() => killPort(project.frontend.port)}
                      disabled={!project.frontend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.frontend.running ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border-rose-500/30'}`}
                    >
                      <Power className="w-4 h-4" /> Kill
                    </button>
                    <button 
                      onClick={() => window.open(`http://localhost:${project.frontend.port}`, '_blank')}
                      disabled={!project.frontend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.frontend.running ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border-blue-500/30'}`}
                    >
                      <ExternalLink className="w-4 h-4" /> View
                    </button>
                  </div>
                  {starting[`${project.id}-frontend`] && (
                    <div className="mt-3 h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 animate-progress"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
