# LearnFlow - Render Deployment

AI-powered Learning Management System with smart scheduling and progress tracking.  
This project is structured for easy deployment on [Render](https://render.com).

## Directory Structure

```
learnflow-deploy/
├── client/                 # React frontend (Vite)
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express API backend
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── render.yaml             # Render Blueprint (optional)
└── README.md
```

## Deploy on Render

### Option A: Blueprint (Recommended)

1. Push this repo to GitHub (or use `learnflow-deploy` as the repo root)
2. In [Render Dashboard](https://dashboard.render.com), click **New** → **Blueprint**
3. Connect your repo; if `learnflow-deploy` is inside another folder, set **Root Directory** to `learnflow-deploy`
4. Render will create two services from `render.yaml`:
   - **learnflow-api** (Web Service) – backend
   - **learnflow-web** (Static Site) – frontend

5. Set environment variables (required):

   **learnflow-api:**
   - `MONGODB_URI` – MongoDB connection string
   - `JWT_SECRET` – secret for JWT (or use auto-generated)
   - `CLIENT_URL` – your frontend URL, e.g. `https://learnflow-web.onrender.com`
   - `HUGGINGFACE_API_KEY` – (optional) for AI features

   **learnflow-web:**
   - `VITE_API_URL` – backend API URL, e.g. `https://learnflow-api.onrender.com/api`

6. Deploy backend first, then frontend (so you can copy the backend URL into `VITE_API_URL`)

### Option B: Manual Setup

**Backend (Web Service)**

1. New → Web Service
2. Build: `cd server && npm install`
3. Start: `cd server && npm start`
4. Root directory: `server` (or repo root if you use `cd server`)
5. Env vars: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `HUGGINGFACE_API_KEY`

**Frontend (Static Site)**

1. New → Static Site
2. Build: `cd client && npm install && npm run build`
3. Publish directory: `client/dist`
4. Env var: `VITE_API_URL` = `https://your-api.onrender.com/api`

## Local Development

**Backend**

```bash
cd server
cp .env.example .env
# Edit .env with MONGODB_URI, JWT_SECRET, etc.
npm install
npm run dev
```

**Frontend**

```bash
cd client
# Optional: create .env with VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000
