# MOD Orchestrator

This project starts and manages the 4 MOD projects (OCR, RAG, Ticketing, NL2SQL) from a single web UI.

## Orchestrator Ports

- Orchestrator Frontend (React / Vite): `http://localhost:3001`
- Orchestrator Backend (Express): `http://localhost:3005`

## Start Orchestrator (start both)

Run from this folder:

```bash
./start.sh
```

If you have not installed dependencies yet:

```bash
(cd server && npm install)
(cd client && npm install)
```

## Projects Port Map (Backend + Frontend)

No port collisions are intended; these are the ports configured in the orchestrator.

| Project | Backend (FastAPI/Flask) | Frontend (React/Static) |
|---|---:|---:|
| OCR | `8005` | `5173` |
| RAG | `8010` | `5175` |
| Ticketing | `8015` | `5177` |
| NL2SQL | `8020` | `5179` |

## Project Directories + Virtual Environments

| Project | Project directory (where orchestrator starts it) | `venv` location |
|---|---|---|
| OCR | `C:\\MOD_DEMO\\Mod_OCR` | `C:\\MOD_DEMO\\Mod_OCR\\venv` |
| RAG | `C:\\MOD_DEMO\\zoho_rag` | `C:\\MOD_DEMO\\zoho_rag\\zoho-analytics-rag\\venv` |
| Ticketing | `C:\\MOD_DEMO\\mod_ticketing_offline` | `C:\\MOD_DEMO\\mod_ticketing_offline\\server\\venv` |
| NL2SQL | `C:\\MOD_DEMO\\DGIS_Pipeline-main` | `C:\\MOD_DEMO\\DGIS_Pipeline-main\\venv` |

## Notes

- Backends are started/stopped by the orchestrator via the `kill-port` endpoint (Windows uses `taskkill`).
- Frontends communicate directly with their respective backend ports (or the backend CORS settings must match those frontend ports).

