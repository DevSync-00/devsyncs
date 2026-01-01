# Devsync AI — Project Charter & Ground Truth

## 0. Purpose of This Document

This document exists to **eliminate ambiguity, hallucination, and scope drift**.

Any AI agent (including Cursor) working on this repository must:
- Read this document before generating code
- Treat it as the **single source of truth**
- Default to *not acting* if a request conflicts with this charter

This project is **not a general AI coding assistant**.
It is a **database-first autonomous synchronization system**.

---

## 1. What Devsync AI Is

Devsync AI is an **end-to-end system** that ensures **correctness and alignment** between:

- Live databases
- Migration files
- ORM schemas
- SQL schema files
- Application code

It detects mismatches, explains them, and proposes **safe, reversible fixes**.

It operates through:
- A robust CLI
- A VS Code extension
- A structured AI reasoning layer
- A code autocomplete tool

---

## 2. What Devsync AI Is NOT

Devsync AI is NOT:
- A chatbot
- A speculative refactor engine
- A “best guess” migration generator
- A system that auto-applies database changes

If unsure → **do nothing and ask for confirmation**.

---

## 3. Absolute Safety Rules (Non-Negotiable)

1. **No destructive database actions by default**
2. All database writes must be:
   - Explicitly opt-in
   - Previewed
   - Reversible
3. Read-only inspection is always the default
4. Failure must be safe and explainable

If a requested action violates any of the above → refuse and explain why.

---

## 4. Schema Discovery Priority (Must Be Followed Exactly)

Schema discovery must occur in this order — **never reorder**:

1. Detect database connection string  
   → Inspect live database (read-only)

2. Else detect schema files:
   - `.sql`
   - `.prisma`
   - migration folders
   - ORM schema definitions

3. Else deeply scan the entire codebase  
   → Infer schema intent from usage

Skipping or reordering these steps is a bug.

---

## 5. Canonical Schema Requirement

All schema inputs must be converted into a **single canonical schema format** before:

- Diffing
- AI reasoning
- Fix generation
- Migration planning

No AI reasoning is allowed on raw schemas.

---

## 6. AI Usage Constraints

- Use only user-provided API keys
- Never send code or schema data without explicit user intent
- All AI output must be:
  - Structured
  - Explainable
  - Deterministic where possible
- No hidden reasoning or black-box actions

---

## 7. Required Implementation Phases

Development must proceed strictly in this order:

1. CLI Foundation
2. Project Scanner Engine
3. Schema Extraction
4. Schema Normalization
5. Conflict Detection Engine
6. AI Reasoning Layer
7. Fix & Migration Engine
8. VS Code Extension

Do not move to the next phase until the current one is logically complete.

---

## 8. Influential Reference Projects

The following repositories must be understood and reused where appropriate:

- Claude-Coder (task reasoning & safety loops)
- Cline (VS Code integration & guarded execution)
- Continue (model switching & context control)
- Liam ERD (schema visualization principles)
- ChartDB (multi-database schema normalization)

Reinventing solved problems is discouraged.

---

## 9. Output Quality Requirements

Every subsystem must include:
- Design explanation
- Clear responsibilities
- Example inputs and outputs
- Edge case handling
- Safe failure modes

Silence or uncertainty is preferable to incorrect output.

---

## 10. Default Behavior When Unsure

If there is insufficient information:
- Do not guess
- Do not invent APIs
- Do not fabricate schema
- Ask for clarification or stop

Correctness > Completeness > Speed.

---

## 11. Final Principle

Devsync AI exists to **earn developer trust**.

Trust is built through:
- Transparency
- Reversibility
- Explainability
- Respect for the database as a production asset

Any behavior that undermines trust is a bug.
