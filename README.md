# RepoGraph AI

Turn any public GitHub repository into an interactive Neo4j codebase knowledge graph. Analyze repository DNA, dependencies, circular loops, 5-tier architecture maps, API-to-code execution paths, and grounded AI explanations.

---

## 1. Project Overview

RepoGraph AI bridges GitHub source code and graph-native intelligence:

$$\text{GitHub Repository} \longrightarrow \text{AST \& Code Parser} \longrightarrow \text{Neo4j Graph Database} \longrightarrow \text{Cypher Traversals} \longrightarrow \text{Interactive Graph UI} \longrightarrow \text{AI Explanation}$$

Neo4j is the primary source of truth for all repository entities and relationships.

### Core Capabilities

1. **Repository DNA**: Graphs repositories, folders, files, functions, classes, APIs, technologies, and features connected by typed relationships (`HAS_FOLDER`, `CONTAINS`, `DEFINES`, `IMPORTS`, `CALLS`, `IMPLEMENTED_BY`, `USES`, `DOCUMENTS`).
2. **README ↔ Code Graph**: Extracts core features, technologies, and architecture concepts using semantic AI parsing and maps them directly to the implementation files.
3. **Dependency Explorer**: Traverses direct dependencies and downstream dependents for any file with 1-click graph highlighting.
4. **Circular Dependency Detector**: Uses graph cycle detection algorithms to identify import loops ($A \to B \to C \to A$) and isolate them visually in the graph.
5. **Architecture Graph**: Synthesizes 5 architectural layers (**Frontend**, **API**, **Backend/Services**, **Database**, **External Services**) derived from repository evidence.
6. **API → Code Graph**: Automatically detects route endpoints (FastAPI, Express, Next.js) and highlights the full path from endpoint $\to$ handler $\to$ domain service $\to$ database query.

---

## 2. System Architecture

```
[ Frontend (React 19 + Tailwind + D3 Canvas) ]
                     │
         REST API Requests (/api/*)
                     │
                     ▼
[ Express Server + Vite Middleware (server.ts) ]
   ├── GitHub Service (REST tree & source ingestion)
   ├── Code Parser (Python & TypeScript AST analysis)
   ├── Architecture Synthesizer (5-tier evidence grouping)
   ├── AI Service (@google/genai / OpenAI grounded explanations)
   └── Neo4j Driver Service (Official neo4j-driver with Cypher engine)
                     │
                     ▼
[ Neo4j Database / Neo4j Aura (bolt:// / bolt+s://) ]
```

---

## 3. Environment Variables

Create a `.env` file in the root directory:

```bash
# GEMINI_API_KEY: Required for Gemini AI API calls (README extraction, graph explanations)
GEMINI_API_KEY="your-gemini-api-key"

# OPENAI_API_KEY: Optional fallback for OpenAI semantic parsing if desired
OPENAI_API_KEY=""

# NEO4J_URI: Connection URI for Neo4j Aura or local instance
NEO4J_URI="bolt://localhost:7687"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="your-neo4j-password"

# GITHUB_TOKEN: Optional GitHub Personal Access Token to avoid REST API rate-limits
GITHUB_TOKEN=""

# APP_URL: The URL where this applet is hosted
APP_URL="http://localhost:3000"
```

---

## 4. Neo4j Setup

### Option A: Neo4j Aura (Cloud - Recommended)
1. Sign up for a free cloud database at [Neo4j Aura](https://neo4j.com/cloud/aura-graph-database/).
2. Copy your connection URI (`neo4j+s://xxxx.databases.neo4j.io`) and password into `.env`.
3. RepoGraph AI will automatically create unique constraints and indexes for `Repository`, `File`, `Folder`, `Function`, `Class`, and `API`.

### Option B: Local Neo4j with Docker
```bash
docker run -d \
  --name neo4j-repograph \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5-community
```

### Option C: Built-in High-Performance Graph Engine
If Neo4j credentials are not provided initially, RepoGraph AI automatically uses its high-performance in-memory Cypher graph engine. You can configure and test a remote Neo4j instance at any time through the in-app **Neo4j Engine** settings modal.

---

## 5. Local Development

Install dependencies and start the development server:

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Start the full-stack development server on port 3000
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 6. Running Automated Tests

Run the test suite verifying GitHub URL parsing, repository ingestion, code AST parsing, API detection, graph persistence, and circular dependency detection:

```bash
npm test
```

---

## 7. 3-Minute Demo Flow

1. Paste any public GitHub URL (e.g., `https://github.com/tiangolo/fastapi-realworld-example-app`) or click one of the verified sample buttons.
2. Click **Analyze Repository**.
3. View the **Repository DNA** perspective showing folders, files, AST functions, and technologies.
4. Switch to **Architecture** tab to view the 5-layer system diagram (**Frontend** $\to$ **API** $\to$ **Services** $\to$ **Database** $\to$ **External**).
5. Switch to **APIs** tab and click `POST /api/users/login` $\to$ click **Trace API Path** to view the full endpoint execution path.
6. Select `auth.py` and inspect **Dependencies** and **Dependents**.
7. Switch to **Cycles** tab and click the detected cycle to highlight the circular import loop.
8. Click **Explain** in the right panel to generate an AI explanation grounded strictly in the Neo4j graph facts.

---

## 8. Troubleshooting

- **GitHub 403 Rate Limit**: If you analyze many repositories, GitHub's unauthenticated IP rate limit (60 req/hr) may be reached. Add a free GitHub token to `GITHUB_TOKEN` in `.env`.
- **Neo4j Connection Failed**: Verify your Neo4j Aura URI format (`neo4j+s://...`). Test connection via the top-bar database badge.
