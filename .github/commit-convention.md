# Follow the Conventional Commits standard:
# <type>(<scope>): <short summary>
# Example: feat(kafka): add producer and consumer helpers

# === Commit Summary (required) ===
# Use imperative mood ("add", "fix", "update"), max ~72 chars.
# Example: feat(config): add minimal Kafka and env configuration
<type>(<scope>): <summary>

# === Commit Body (optional, but recommended) ===
# - Explain WHAT changed and WHY (not how)
# - Mention context, reasoning, or references
# - Wrap lines at ~72 characters for readability
#
# Example:
# Added helper functions to create Kafka producers and consumers.
# This improves reusability across orchestrator and adapter services.

# === Footer (optional) ===
# - Reference issues, tasks, or future improvements
# - Example: Closes #12  or  Related to LYZR-AGENT-003
#
# Example:
# Closes #infra-setup
# ---------------------------------------------


# 🧩 TYPES — choose one:
# ---------------------------------------------
# feat:     A new feature or module
# fix:      A bug fix or defect correction
# chore:    Maintenance, tooling, infra, or config updates
# docs:     Documentation changes only
# style:    Code formatting, linting, naming (no logic change)
# refactor: Code restructuring (no feature/bug fix)
# perf:     Performance improvements
# test:     Add or update tests
# build:    Build system or dependency updates
# ci:       Continuous integration or deployment updates
# revert:   Reverts a previous commit
# ---------------------------------------------


# ⚙️ SCOPES — specific to this project:
# ---------------------------------------------
# infra        → Docker, Kafka, environment setup
# config       → Environment configuration, dotenv, env-var
# kafka        → Kafka client helpers, producers, consumers
# utils        → Utility functions (uuid, timestamps, sleep)
# orchestrator → Workflow manager / event processor logic
# adapter      → Human approval adapters (Slack, email, etc.)
# test         → Unit or integration tests
# docs         → README, architecture docs, etc.
# ---------------------------------------------


# ✅ EXAMPLES:
# feat(kafka): add helper for producer/consumer creation
# chore(infra): add docker-compose for Kafka and Zookeeper
# fix(orchestrator): handle missing approval responses gracefully
# test(common): mock Kafka for unit testing
# docs(readme): add future improvements section
# ---------------------------------------------

# (Lines starting with # are ignored)