# delvin

Vendor Onboarding Portal — a mini Vendor Management System for an HR/hiring team.

- `backend/` — FastAPI service with an in-memory vendor store
- `frontend/` — React + TypeScript (Vite) UI

## Backend

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
.venv/bin/python -m pytest        # tests
```

API:

| Method | Path       | Description                                          |
| ------ | ---------- | ---------------------------------------------------- |
| POST   | `/vendors` | Register a vendor; `status` defaults to `Pending Approval` |
| GET    | `/vendors` | List all registered vendors                          |

`category` must be one of `Staffing Agency`, `Freelance Platform`, `Consultant`.

## Frontend

Requires Node 22 (see `frontend/.nvmrc`).

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

Set `VITE_API_BASE_URL` if the backend is not on `http://localhost:8000`.
