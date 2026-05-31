# Backlog — Deferred Features

Ideas that are explicitly out of scope for the current build.
Each entry has a rationale. Revisit when scoping the next iteration.

---

## Automated prompt evolution (V2)

User defines a task; system generates and tests prompt variants automatically.

Deferred because stochasticity makes "optimization" noisy without multiple samples per variant, and the N×M async orchestration adds complexity not justified for V1. The judge infrastructure already in place makes this a natural extension.

---

## Multi-model comparison

Run the same prompt on two or more models side by side and compare scores.

Deferred — adds significant UI complexity. Useful once users have a mature prompt and want to evaluate it across providers.

---
