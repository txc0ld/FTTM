#!/usr/bin/env bash
# ============================================================================
# Claude Code Repo Bootstrap
# Sets up full agent management infrastructure for any repo
# Usage: ./cc-bootstrap.sh [--yolo] [--teams] [--minimal]
# ============================================================================

set -euo pipefail

# --- Flags ---
YOLO=false
TEAMS=false
MINIMAL=false

for arg in "$@"; do
  case $arg in
    --yolo)    YOLO=true ;;
    --teams)   TEAMS=true ;;
    --minimal) MINIMAL=true ;;
    --help|-h)
      echo "Usage: ./cc-bootstrap.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --yolo     Set defaultMode to bypassPermissions (container use only)"
      echo "  --teams    Enable experimental agent teams"
      echo "  --minimal  Scaffold structure only, no agent definitions"
      echo "  -h, --help Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Claude Code Repo Bootstrap             ║${NC}"
echo -e "${CYAN}║   Agent Management Infrastructure        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# --- Verify we're in a git repo (or init one) ---
if [ ! -d ".git" ]; then
  warn "Not a git repo. Initializing..."
  git init
  log "Git initialized"
fi

PROJECT_NAME=$(basename "$(pwd)")
info "Setting up: ${PROJECT_NAME}"
echo ""

# ============================================================================
# 1. Directory Structure
# ============================================================================
info "Creating directory structure..."

mkdir -p .claude/agents
mkdir -p .claude/commands
mkdir -p .claude/hooks
mkdir -p docs/specs
mkdir -p docs/architecture

log "Directory structure created"

# ============================================================================
# 2. CLAUDE.md — Root project context
# ============================================================================
if [ ! -f "CLAUDE.md" ]; then
  info "Creating CLAUDE.md..."
  cat > CLAUDE.md << 'CLAUDEMD'
# Project Context

## Identity
<!-- Update with your project details -->
- Project: [PROJECT_NAME]
- Stack: [e.g., TypeScript / Solidity / Python]
- Status: Active development

## Build & Run
```bash
# Dev
npm run dev

# Test
npm test

# Lint
npm run lint

# Build
npm run build

# Deploy
# [add deploy command]
```

## Architecture
<!-- Claude will auto-populate this on first deep read -->
```
/src          — application source
/tests        — test suites
/docs         — specs and architecture docs
/contracts    — smart contracts (if applicable)
/.claude      — agent config, commands, hooks
```

## Code Conventions
- Strict TypeScript (no `any`)
- All public functions documented with JSDoc
- Tests required for all new features
- Conventional commits: `type(scope): description`
- Error handling: explicit, no silent catches
- No secrets in code — use .env

## Security Rules
- Validate all external input
- Auth checks on every endpoint
- No hardcoded credentials, API keys, or secrets
- Dependencies must be from trusted sources
- Run security review agent on auth/data changes

## Agent Behavior
- **Always** run tests before committing
- **Always** create/update changelog for features
- Use `Explore` subagent when uncertain about codebase
- Use `Plan` subagent before any multi-file refactor
- Prefer small, focused commits over large batches
- When modifying >3 files, create a brief plan first
- Check for existing patterns before creating new abstractions

## Key Decisions Log
<!-- Append architectural decisions here -->
| Date | Decision | Rationale |
|------|----------|-----------|
| | | |
CLAUDEMD

  # Replace placeholder
  sed -i "s/\[PROJECT_NAME\]/${PROJECT_NAME}/" CLAUDE.md
  log "CLAUDE.md created"
else
  warn "CLAUDE.md already exists — skipping"
fi

# ============================================================================
# 3. .claudeignore
# ============================================================================
if [ ! -f ".claudeignore" ]; then
  info "Creating .claudeignore..."
  cat > .claudeignore << 'IGNORE'
# Dependencies
node_modules/
vendor/
.venv/
__pycache__/

# Build output
dist/
build/
out/
.next/
coverage/

# Environment & secrets
.env
.env.*
*.pem
*.key

# Lock files (large, low signal)
package-lock.json
pnpm-lock.yaml
yarn.lock
Pipfile.lock
poetry.lock

# IDE & OS
.idea/
.vscode/
*.swp
.DS_Store
Thumbs.db

# Artifacts
*.log
*.map
*.min.js
*.min.css
IGNORE
  log ".claudeignore created"
else
  warn ".claudeignore already exists — skipping"
fi

# ============================================================================
# 4. Settings — Permissions & Preferences
# ============================================================================
info "Creating .claude/settings.json..."

if [ "$YOLO" = true ]; then
  DEFAULT_MODE="bypassPermissions"
  warn "YOLO mode enabled — use in containers only"
else
  DEFAULT_MODE="acceptEdits"
fi

# Build env block
ENV_BLOCK=""
if [ "$TEAMS" = true ]; then
  ENV_BLOCK=',
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }'
  log "Agent teams enabled"
fi

cat > .claude/settings.json << SETTINGS
{
  "permissions": {
    "defaultMode": "${DEFAULT_MODE}",
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(npm *)",
      "Bash(pnpm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(python *)",
      "Bash(pip *)",
      "Bash(git *)",
      "Bash(gh *)",
      "Bash(cat *)",
      "Bash(ls *)",
      "Bash(mkdir *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Bash(echo *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(grep *)",
      "Bash(find *)",
      "Bash(wc *)",
      "Bash(sort *)",
      "Bash(diff *)",
      "Bash(touch *)",
      "Bash(sed *)",
      "Bash(awk *)",
      "Bash(jq *)",
      "Bash(curl *)",
      "Bash(docker *)",
      "Bash(forge *)",
      "Bash(hardhat *)",
      "Bash(cast *)",
      "Bash(anvil *)",
      "Task(*)",
      "Agent(*)"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~*)",
      "Bash(sudo rm *)",
      "Bash(sudo chmod *)",
      "Bash(chmod 777 *)",
      "Bash(> /dev/*)",
      "Bash(mkfs *)",
      "Bash(dd if=*)"
    ]
  },
  "preferences": {
    "model": "sonnet",
    "maxBudgetUsd": 25
  }${ENV_BLOCK}
}
SETTINGS

log "Settings configured (mode: ${DEFAULT_MODE})"

# ============================================================================
# 5. Subagents
# ============================================================================
if [ "$MINIMAL" = false ]; then
  info "Creating subagents..."

  # --- Security Reviewer ---
  cat > .claude/agents/security-reviewer.md << 'AGENT'
---
name: security-reviewer
description: Reviews code for security vulnerabilities. Auto-triggered on changes to auth, data handling, API endpoints, or environment config.
tools: Read, Grep, Glob, Bash
model: opus
permissionMode: plan
---
You are a senior security engineer performing code review.

## Process
1. Identify all recently changed files (use git diff if available)
2. Categorize changes: auth, data handling, API, config, dependencies
3. For each category, check against:
   - OWASP Top 10
   - Hardcoded secrets or credentials
   - SQL/NoSQL injection vectors
   - XSS and CSRF vulnerabilities
   - Insecure deserialization
   - Broken access control
   - Security misconfiguration
4. Check dependency changes against known CVEs
5. Verify .env files are not committed

## Output Format
For each finding:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **File**: path and line
- **Issue**: what's wrong
- **Fix**: specific remediation

If no issues found, confirm with brief summary of what was reviewed.
AGENT
  log "Agent: security-reviewer"

  # --- Test Writer ---
  cat > .claude/agents/test-writer.md << 'AGENT'
---
name: test-writer
description: Writes comprehensive test suites for specified modules. Follows existing test patterns in the repo.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---
You are a senior QA engineer writing tests.

## Process
1. Read the target module/file thoroughly
2. Scan existing tests to match patterns, frameworks, and conventions
3. Identify all code paths: happy path, edge cases, error states
4. Write tests covering:
   - Unit tests for pure functions
   - Integration tests for I/O and API calls
   - Edge cases: null, undefined, empty, boundary values
   - Error handling: thrown exceptions, rejected promises
5. Run the test suite to verify all tests pass
6. Report coverage summary

## Rules
- Match the existing test framework (Jest, Vitest, pytest, etc.)
- Match existing naming conventions and file structure
- Never mock what you can test directly
- Every test must have a clear assertion
- Group related tests with describe/context blocks
AGENT
  log "Agent: test-writer"

  # --- Architect / Planner ---
  cat > .claude/agents/architect.md << 'AGENT'
---
name: architect
description: Creates implementation plans for complex features. Breaks down work into sequenced tasks with dependencies.
tools: Read, Grep, Glob
model: opus
permissionMode: plan
---
You are a senior software architect creating implementation plans.

## Process
1. Understand the full requirement and its boundaries
2. Map the existing codebase architecture relevant to the change
3. Identify all files that need to be created or modified
4. Sequence work into atomic tasks with clear dependencies
5. Identify risks, edge cases, and required migrations
6. Output a structured plan

## Output Format
### Overview
Brief summary of approach and key decisions.

### Tasks (ordered)
For each task:
- **Task N**: [title]
- **Files**: list of files to create/modify
- **Depends on**: task numbers
- **Description**: what to do
- **Acceptance criteria**: how to verify it's done

### Risks
- Risk and mitigation for each identified concern

### Open Questions
- Anything that needs human input before proceeding
AGENT
  log "Agent: architect"

  # --- Code Reviewer ---
  cat > .claude/agents/reviewer.md << 'AGENT'
---
name: reviewer
description: Performs comprehensive code review against project conventions and best practices.
tools: Read, Grep, Glob, Bash
model: sonnet
permissionMode: plan
---
You are a senior engineer performing code review.

## Process
1. Read CLAUDE.md for project conventions
2. Get the diff of recent changes (git diff HEAD~1 or staged)
3. Review against:
   - Project code conventions
   - Type safety and error handling
   - Performance implications
   - Test coverage for new code
   - Documentation for public APIs
   - No debug code or console.logs left in
4. Check for code smells: duplication, god functions, deep nesting

## Output
- **Approve** / **Request Changes** / **Comment**
- For each issue: file, line, concern, suggested fix
- Note any patterns that should be added to CLAUDE.md
AGENT
  log "Agent: reviewer"

  # --- Refactor Agent ---
  cat > .claude/agents/refactorer.md << 'AGENT'
---
name: refactorer
description: Executes safe, incremental refactoring with tests verified at each step.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---
You are a senior engineer performing incremental refactoring.

## Rules
1. NEVER refactor and change behavior simultaneously
2. Run tests BEFORE starting — establish green baseline
3. Make one structural change at a time
4. Run tests AFTER each change — must stay green
5. Commit after each verified step
6. If tests break, revert immediately and reassess

## Process
1. Understand the refactoring goal
2. Run existing tests — confirm green
3. Plan the sequence of purely structural changes
4. Execute each change → test → commit cycle
5. After all changes, run full test suite
6. Summarize what was done and verify no behavior changed
AGENT
  log "Agent: refactorer"

fi

# ============================================================================
# 6. Slash Commands
# ============================================================================
if [ "$MINIMAL" = false ]; then
  info "Creating slash commands..."

  # --- /review ---
  cat > .claude/commands/review.md << 'CMD'
Perform a comprehensive code review of recent changes:

1. Run `git diff HEAD~1` (or staged if no commits) to identify changes
2. Check all changes against conventions in CLAUDE.md
3. Verify error handling and edge cases
4. Run the security-reviewer agent on any auth/data/API changes
5. Check test coverage — flag any new code without tests
6. Look for secrets, debug code, or TODO items left in
7. Validate no breaking changes to public APIs without documentation

Output a structured review with actionable items.
CMD
  log "Command: /review"

  # --- /plan ---
  cat > .claude/commands/plan.md << 'CMD'
Create an implementation plan for the requested feature or change:

1. Use the architect agent to analyze the requirement
2. Map affected files and systems
3. Break into sequenced, atomic tasks
4. Identify risks and dependencies
5. Write the plan to docs/specs/[feature-name]-plan.md
6. Summarize the plan and ask for approval before implementation

Do NOT start implementation until the plan is explicitly approved.
CMD
  log "Command: /plan"

  # --- /ship ---
  cat > .claude/commands/ship.md << 'CMD'
Prepare the current work for merge:

1. Run the full test suite — fix any failures
2. Run linter — fix any issues
3. Run security-reviewer agent
4. Run reviewer agent on all staged/recent changes
5. Generate a conventional commit message
6. Update CHANGELOG.md (create if missing)
7. Show a summary of everything that will be committed

Wait for explicit confirmation before committing.
CMD
  log "Command: /ship"

  # --- /bootstrap ---
  cat > .claude/commands/bootstrap.md << 'CMD'
Deep-read the entire repository and update project context:

1. Read all source files, configs, and documentation
2. Identify the tech stack, frameworks, and key dependencies
3. Map the architecture: entry points, routing, data flow
4. Discover build commands, test commands, and deploy process
5. Update CLAUDE.md with accurate information for all sections
6. Note any patterns, conventions, or anti-patterns observed
7. List any issues found (missing tests, stale docs, etc.)

This is a read-only analysis — update only CLAUDE.md.
CMD
  log "Command: /bootstrap"

  # --- /swarm ---
  if [ "$TEAMS" = true ]; then
    cat > .claude/commands/swarm.md << 'CMD'
Launch an agent team for parallel implementation:

1. Read the implementation plan from docs/specs/ (or create one first using /plan)
2. Spawn a team with the lead coordinating
3. Assign teammates based on the plan:
   - One per independent layer/module (e.g., frontend, backend, contracts)
   - One dedicated to test writing
   - One for security review (on auth/data work)
4. Each teammate works on their assigned tasks independently
5. Lead synthesizes results and handles cross-cutting concerns
6. Run full integration test suite after all teammates complete
7. Summarize work done by each teammate

Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
CMD
    log "Command: /swarm"
  fi

fi

# ============================================================================
# 7. Hook Templates
# ============================================================================
if [ "$MINIMAL" = false ]; then
  info "Creating hook templates..."
  cat > .claude/hooks/README.md << 'HOOKS'
# Hook Configuration

Add hooks to `.claude/settings.json` under the `hooks` key.

## Available Hook Points
- `PreToolUse`  — runs before a tool executes (can approve/deny/modify)
- `PostToolUse` — runs after a tool executes (e.g., auto-format)
- `Notification` — runs on notifications (e.g., Slack alerts)

## Example: Auto-format after edits
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "command": "npx prettier --write $CLAUDE_FILE_PATH 2>/dev/null || true"
      }
    ]
  }
}
```

## Example: Lint before commit
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(git commit*)",
        "command": "npm run lint"
      }
    ]
  }
}
```

## Example: Notify on completion
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "*",
        "command": "echo 'Claude finished: $CLAUDE_NOTIFICATION' >> /tmp/claude-log.txt"
      }
    ]
  }
}
```
HOOKS
  log "Hook templates created"
fi

# ============================================================================
# 8. Git Config
# ============================================================================
info "Updating .gitignore..."

# Append Claude-specific ignores if not already present
CLAUDE_IGNORE_MARKER="# Claude Code"
if ! grep -q "$CLAUDE_IGNORE_MARKER" .gitignore 2>/dev/null; then
  cat >> .gitignore << 'GITIGNORE'

# Claude Code
.claude/settings.local.json
GITIGNORE
  log ".gitignore updated"
else
  warn "Claude ignore rules already in .gitignore"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Bootstrap Complete                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Files created:${NC}"
echo "    CLAUDE.md                        — project context (edit this)"
echo "    .claudeignore                    — file exclusions"
echo "    .claude/settings.json            — permissions & preferences"
if [ "$MINIMAL" = false ]; then
echo "    .claude/agents/                  — 5 subagents"
echo "      ├── security-reviewer.md"
echo "      ├── test-writer.md"
echo "      ├── architect.md"
echo "      ├── reviewer.md"
echo "      └── refactorer.md"
echo "    .claude/commands/                — slash commands"
echo "      ├── review.md       (/review)"
echo "      ├── plan.md         (/plan)"
echo "      ├── ship.md         (/ship)"
echo "      └── bootstrap.md    (/bootstrap)"
if [ "$TEAMS" = true ]; then
echo "      └── swarm.md        (/swarm)"
fi
echo "    .claude/hooks/README.md          — hook examples"
fi
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo "    1. Edit CLAUDE.md with your actual project details"
echo "    2. Run: claude"
echo "    3. Run: /bootstrap   (Claude deep-reads your repo and updates CLAUDE.md)"
echo "    4. Start building"
echo ""
if [ "$YOLO" = true ]; then
echo -e "  ${RED}⚠  YOLO mode is ON — run in a container, not bare metal${NC}"
echo ""
fi
