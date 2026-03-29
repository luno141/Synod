# SYNOD — Multi-Agent Decision Intelligence Platform

> A virtual advisory board powered by multiple AI agents. Instead of one generic AI response, Synod creates expert personas, runs them in parallel, and synthesizes a structured recommendation.

![License](https://img.shields.io/badge/license-MIT-violet)
![Python](https://img.shields.io/badge/python-3.12+-blue)
![Next.js](https://img.shields.io/badge/next.js-15-black)

## 🧠 What is Synod?

Synod is **not** a ChatGPT wrapper. It's a multi-agent decision intelligence system.

| ChatGPT Wrapper | Synod |
|---|---|
| One prompt → one model → one answer | Multiple agents with different roles |
| No memory of past decisions | Feedback-driven learning loop |
| No structure | Pros, cons, risks, disagreements, confidence score |
| No orchestration | Parallel execution via `asyncio.gather` |

### How It Works

1. **You ask a question** — "Should I build an AI SaaS for college students?"
2. **4 expert agents analyze in parallel** — VC, Engineer, Marketing, Product Manager
3. **A Synthesizer combines their analyses** into a structured recommendation
4. **Past decisions inform future ones** via vector similarity (Pinecone + Jina)
5. **Your feedback improves future recommendations** — a learning loop

## 🏗 Architecture

```
User → Next.js Frontend → FastAPI Backend
                              ├── Agent Orchestrator (asyncio.gather)
                              │   ├── VC Agent
                              │   ├── Engineer Agent
                              │   ├── Marketing Agent
                              │   └── Product Manager Agent
                              ├── Synthesizer Agent
                              ├── Memory (Pinecone + Jina)
                              └── Database (MongoDB)
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **MongoDB** (local or cloud)
- **Groq API Key** (or Ollama for local inference)

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd SYNOD

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 2. Start Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open Browser

Navigate to [http://localhost:3000](http://localhost:3000)

## 🐳 Docker (Full Stack)

```bash
# Copy env files
cp backend/.env.example backend/.env

# Start everything
docker-compose up --build
```

This starts MongoDB, the FastAPI backend, and the Next.js frontend.

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes* | Groq API key for fast inference |
| `GROQ_MODEL` | No | Model name (default: `llama-3.3-70b-versatile`) |
| `OLLAMA_BASE_URL` | No | Ollama URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | No | Ollama model (default: `llama3`) |
| `MONGODB_URI` | No | MongoDB connection string (default: `mongodb://localhost:27017`) |
| `PINECONE_API_KEY` | No | Enables vector memory for context-aware recommendations |
| `JINA_API_KEY` | No | Required if using Pinecone (for embeddings) |

*\*Either Groq API key or running Ollama instance is required*

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: `http://localhost:8000`) |

## 📁 Project Structure

```
SYNOD/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── config.py            # Environment config
│   │   ├── routes/decisions.py  # API endpoints
│   │   ├── services/
│   │   │   ├── llm.py           # Groq + Ollama
│   │   │   ├── agents.py        # Parallel orchestration
│   │   │   ├── synthesis.py     # Verdict generation
│   │   │   ├── embeddings.py    # Jina vectors
│   │   │   └── memory.py        # Pinecone store
│   │   ├── prompts/             # Modular agent prompts
│   │   ├── models/schemas.py    # Pydantic models
│   │   └── db/mongo.py          # MongoDB CRUD
│   └── Dockerfile
├── frontend/
│   ├── app/page.tsx             # Main page
│   ├── components/              # 7 UI components
│   ├── lib/                     # Types + API client
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 📜 License

MIT
