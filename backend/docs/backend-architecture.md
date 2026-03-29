# Synod Backend Architecture

## Core shape

The backend is a TypeScript Express service that keeps the old Python prototype in place as legacy code, but no longer depends on it.

Request flow:

1. Auth middleware resolves the user or falls back to a seeded demo user in guest mode.
2. The recommendation service retrieves the user profile, explicit preferences, feedback history, and semantic memories.
3. The council pipeline runs:
   - Planner
   - Research
   - Preference
   - Critic
   - Synthesizer
   - Retention
4. Structured results are stored in PostgreSQL through Prisma.
5. A memory summary is embedded and indexed in Chroma for later retrieval.
6. Feedback writes back to both the preference table and semantic memory layer.

## Storage model

- PostgreSQL stores identities, preferences, sessions, options, agent messages, feedback, and embedding vectors for semantic recall.
- Chroma is now an optional mirror for semantic memory records keyed by `MemoryEmbedding.vectorId`.
- The backend works fully with PostgreSQL alone; Chroma only improves portability if you want an external vector service later.

## Agent responsibilities

- Planner: classifies the task, builds an execution graph, defines evaluation criteria, and identifies follow-up questions.
- Research: produces candidate options, evidence, and knowledge gaps. It can enrich results with optional Serper web search.
- Preference: converts profile and historical feedback into weighted priorities.
- Critic: penalizes fragile options, weak evidence, and unresolved assumptions.
- Synthesizer: selects the recommendation, produces alternatives, and explains the tradeoffs.
- Retention: detects low-confidence outcomes and proposes follow-up questions or exploration paths.

## Model strategy

The backend is runnable without any external model downloads:

- `AI_PROVIDER=mock` gives deterministic council behavior for local MVP work.
- `AI_PROVIDER=openai` upgrades the narrative quality of the agent outputs.
- `EMBEDDING_PROVIDER=local` gives deterministic embeddings without extra setup.
- `EMBEDDING_PROVIDER=openai` upgrades semantic recall quality when an OpenAI key is present.
- `CHROMA_URL` can be left empty for the MVP because semantic memory already works from PostgreSQL.
