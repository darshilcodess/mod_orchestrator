import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Activity, Cpu, Power, RefreshCw, ExternalLink, Monitor, Terminal, Rocket } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = 'http://localhost:3005';

function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState(localStorage.getItem('mod_os') || 'win32');

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 3005);
    return () => clearInterval(interval);
  }, [os]);

  const fetchProjects = async () => {
    try {
      const resp = await axios.get(`${API_URL}/projects`, { params: { os } });
      setProjects(resp.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const handleOsChange = (newOs) => {
    setOs(newOs);
    localStorage.setItem('mod_os', newOs);
    toast.info(`Switched to ${newOs === 'win32' ? 'Windows' : 'Linux'} mode`);
  };

  const startProcess = async (projectId, type) => {
    toast.promise(
      axios.post(`${API_URL}/start`, { projectId, type, os }),
      {
        pending: `Starting ${type}...`,
        success: `${type} start signal sent!`,
        error: `Failed to start ${type} 🤯`
      }
    );
    // UI will update via the poll interval
  };

  const startBoth = (projectId) => {
    // Avoid port collisions by starting only what's not running.
    // (This is called by the "Start Project" button.)
    startProcess(projectId, 'backend');
    startProcess(projectId, 'frontend');
  };

  const stopBoth = (project) => {
    killPort(project.backend.port);
    killPort(project.frontend.port);
  };

  const killPort = async (port) => {
    try {
      const resp = await axios.post(`${API_URL}/kill-port`, { port, os });
      if (resp.data.status === 'killed') {
        toast.success(`Port ${port} killed successfully`);
      } else {
        toast.warn(`Status for port ${port}: ${resp.data.status}`);
      }
      setTimeout(fetchProjects, 1000);
    } catch (err) {
      toast.error('Failed to kill port');
    }
  };

  return (
    <div className="min-h-screen w-screen p-8 bg-gradient-to-br from-[#ff8c2d] via-white to-[#4caf50] text-slate-900 font-sans overflow-x-hidden">
      <ToastContainer theme="dark" position="bottom-right" />
      <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-[#ff8c2d] via-white to-[#4caf50] p-6 rounded-2xl shadow-xl border border-white/20 backdrop-blur-sm">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Orchestrator
          </h1>
          <p className="text-slate-700 font-medium mt-1">Manage your development ecosystem.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* OS Selector */}
          <div className="flex bg-white/20 p-1 rounded-xl border border-white/30 backdrop-blur-md">
            <button 
              onClick={() => handleOsChange('win32')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${os === 'win32' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white'}`}
            >
              <Monitor className="w-4 h-4" /> Windows
            </button>
            <button 
              onClick={() => handleOsChange('linux')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${os === 'linux' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:text-white'}`}
            >
              <Terminal className="w-4 h-4" /> Linux
            </button>
          </div>

          <button onClick={fetchProjects} className="p-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl transition text-slate-700 hover:text-slate-900 shadow-md">
            <RefreshCw className="w-5 h-5" />
          </button>
  
        </div>
      </header>

      {loading && projects.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project) => (
            <div key={project.id} className="bg-white/70 border border-white/40 rounded-2xl overflow-hidden shadow-2xl hover:border-white/60 transition-all backdrop-blur-md">
              <div className="p-6 border-b border-white/20 bg-white/40">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-slate-900 truncate">{project.name}</h2>
                    <p className="text-sm text-slate-600 truncate mt-1">{project.path}</p>
                  </div>
                  
                  {project.backend.running && project.frontend.running ? (
                    <button 
                      onClick={() => stopBoth(project)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 active:scale-95"
                    >
                      <Power className="w-5 h-5" /> Close Project
                    </button>
                  ) : (
                    <button 
                      onClick={() => startBoth(project.id)}
                      disabled={
                        project.backend.running ||
                        project.frontend.running ||
                        (project.backend.progress > 0 && project.backend.progress < 100) ||
                        (project.frontend.progress > 0 && project.frontend.progress < 100)
                      }
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${((project.backend.progress > 0 && project.backend.progress < 100) || (project.frontend.progress > 0 && project.frontend.progress < 100)) ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 active:scale-95'}`}
                    >
                      <Rocket className="w-5 h-5" /> {((project.backend.progress > 0 && project.backend.progress < 100) || (project.frontend.progress > 0 && project.frontend.progress < 100)) ? 'Starting...' : 'Start Project'}
                    </button>
                  )}

                  <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shrink-0">
                    <Cpu className="text-blue-400 w-6 h-6" />
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Backend Section */}
                <div className="bg-white/50 p-4 rounded-xl border border-white/40">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">Backend</span>
                      <span className={`w-3 h-3 rounded-full ${project.backend.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}></span>
                    </div>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Port {project.backend.port}</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => startProcess(project.id, 'backend')}
                      disabled={project.backend.running || (project.backend.progress > 0 && project.backend.progress < 100)}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${project.backend.running || (project.backend.progress > 0 && project.backend.progress < 100) ? 'bg-black/10 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'}`}
                    >
                      <Play className="w-4 h-4" /> {(project.backend.progress > 0 && project.backend.progress < 100) ? 'Starting...' : 'Start'}
                    </button>
                    <button 
                      onClick={() => killPort(project.backend.port)}
                      disabled={!project.backend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.backend.running ? 'bg-black/5 border-black/10 text-slate-400 cursor-not-allowed' : 'bg-rose-600/20 hover:bg-rose-600 text-rose-600 hover:text-white border-rose-500/30'}`}
                    >
                      <Power className="w-4 h-4" /> Kill
                    </button>
                    <button 
                      onClick={() => window.open(`http://localhost:${project.backend.port}${project.backend.docsPath || '/docs'}`, '_blank')}
                      disabled={!project.backend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.backend.running ? 'bg-black/5 border-black/10 text-slate-400 cursor-not-allowed' : 'bg-blue-600/20 hover:bg-blue-600 text-blue-600 hover:text-white border-blue-500/30'}`}
                    >
                      <ExternalLink className="w-4 h-4" /> {project.backend.docsLabel || 'Docs'}
                    </button>
                  </div>
                  {project.backend.progress > 0 && project.backend.progress < 100 && (
                    <div className="mt-3 h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${project.backend.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Frontend Section */}
                <div className="bg-white/50 p-4 rounded-xl border border-white/40">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">Frontend</span>
                      <span className={`w-3 h-3 rounded-full ${project.frontend.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}></span>
                    </div>
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Port {project.frontend.port}</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => startProcess(project.id, 'frontend')}
                      disabled={project.frontend.running || (project.frontend.progress > 0 && project.frontend.progress < 100)}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${project.frontend.running || (project.frontend.progress > 0 && project.frontend.progress < 100) ? 'bg-black/10 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'}`}
                    >
                      <Play className="w-4 h-4" /> {(project.frontend.progress > 0 && project.frontend.progress < 100) ? 'Starting...' : 'Start'}
                    </button>
                    <button 
                      onClick={() => killPort(project.frontend.port)}
                      disabled={!project.frontend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.frontend.running ? 'bg-black/5 border-black/10 text-slate-400 cursor-not-allowed' : 'bg-rose-600/20 hover:bg-rose-600 text-rose-600 hover:text-white border-rose-500/30'}`}
                    >
                      <Power className="w-4 h-4" /> Kill
                    </button>
                    <button 
                      onClick={() => window.open(`http://localhost:${project.frontend.port}`, '_blank')}
                      disabled={!project.frontend.running}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium border transition-all ${!project.frontend.running ? 'bg-black/5 border-black/10 text-slate-400 cursor-not-allowed' : 'bg-blue-600/20 hover:bg-blue-600 text-blue-600 hover:text-white border-blue-500/30'}`}
                    >
                      <ExternalLink className="w-4 h-4" /> View
                    </button>
                  </div>
                  {project.frontend.progress > 0 && project.frontend.progress < 100 && (
                    <div className="mt-3 h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-1000 ease-out"
                        style={{ width: `${project.frontend.progress}%` }}
                      ></div>
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
