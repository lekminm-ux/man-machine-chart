# Prompt — GPT-5.6 Context Checkpoint / New-Chat Handoff

Use this prompt when a GPT-5.6 Sol/Terra/Luna chat reaches the project's
context checkpoint. Before pasting it, replace every bracketed field with the
actual current state. Do not leave a generic handoff when a concrete status is
available.

The OpenAI API model documentation currently lists a 1,050,000-token context
window for the GPT-5.6 family. This project's 70% checkpoint is 735,000 tokens.
The source is [OpenAI API Models](https://developers.openai.com/api/docs/models);
re-check it if the vendor changes the model limits.

```text
ROLE: [Codex / GPT-5.6 Sol / GPT-5.6 Terra / GPT-5.6 Luna]
MODE: CONTINUE_FROM_CONTEXT_CHECKPOINT — continue from the written project
state below; do not restart completed work or trust stale chat history.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT CHECKPOINT
The previous chat reached the project's GPT-5.6 context checkpoint:
1,050,000-token API context window × 70% = 735,000 tokens.
Checkpoint observed at: [YYYY-MM-DD HH:mm timezone]
Reported usage: [exact value, or UNKNOWN — state why]
Do not infer that this authorizes commit, push, deploy, Production D1 access,
schema changes, reset, seed, or any other external write.

READ FIRST — exact order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
   (read the latest 5–8 entries)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
   (read the current status, module status, roadmap, and open risks when the
   next task concerns a module or release)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/README.md
5. Run `git status --short --branch` and `git log --oneline -10`.

CURRENT STATUS — verified before this prompt was prepared
- Completed work: [specific completed phase/task and commit, if any]
- Verification already completed: [tests/lint/build/browser/live evidence]
- Current branch/commit: [branch and commit]
- Working-tree changes: [exact modified/untracked files, or clean]
- Known risks/findings: [specific items, or none]

IMMEDIATE NEXT TASK
[One concrete next action. If the user has not authorized it, stop at the
decision point and ask rather than committing, deploying, or changing scope.]

HANDOFF RULES
- Preserve all existing uncommitted and untracked files exactly as found.
- Inspect actual files from disk before editing; do not rely on this prompt or
  the previous chat as the only source of truth.
- Continue only the immediate task above. Do not redo completed verification
  unless the current files or evidence make it necessary.
- Follow the Database Safety Gate and the current Claude/Codex role split in
  PROJECT_CONTEXT.md and docs/AI_PROMPTS/README.md.
- At the end, update CHANGELOG_AI.md and report exact checks and any blocker.
```

When the threshold is reached, the assistant should tell the user in Thai that
the checkpoint was reached, provide this filled-in prompt as a ready-to-copy
handoff, and ask the user to open a new chat. If the exact usage was not
available, say so explicitly instead of presenting 735,000 as a measured value.
