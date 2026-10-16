# JIRA Ticket Context Skill

An AI assistant skill that fetches full JIRA ticket context (details, comments, attachments, images) using `jcfa` (jira-cli-for-agents) running in Docker.

## Security and Safety Concerns

### API Token Storage

Your Jira API token is stored in **plaintext** at `~/.jcfa/config.yaml`. This file contains your email, Jira domain, and API token in clear text. Anyone with read access to this file has full access to your Jira instance with your permissions.

**Mitigations:**
- The file is created with `600` permissions by default (owner read/write only). Verify with: `ls -la ~/.jcfa/config.yaml`
- If permissions are wrong, fix them: `chmod 600 ~/.jcfa/config.yaml`
- Do not commit `~/.jcfa/` to version control. Add it to your global gitignore.
- Rotate your API token periodically at https://id.atlassian.com/manage-profile/security/api-tokens
- Use a token with the minimum required scopes for your use case

### Token Exposure in AI Assistant Context

When the skill runs `jcfa get` or `jcfa attachment` commands, the **output** (ticket content, comments, attachments) is loaded into the AI assistant's conversation context. This means:

- Ticket content, including potentially sensitive business data, is sent to your AI provider's API
- If your JIRA tickets contain credentials, PII, or confidential information, that data enters the conversation
- Conversation context may be retained per your AI provider's data policies

**Mitigations:**
- Only use this skill with tickets you're comfortable having processed by your AI assistant
- Be aware that the full ticket description, all comments, and attachment metadata are sent to the API
- Review your AI provider's data retention policies for your usage tier

### Docker Volume Mounts

The skill mounts two host directories into the Docker container:

1. **`~/.jcfa:/root/.jcfa`** (read-only in practice) — exposes your auth config to the container
2. **`/tmp/jira/<ticket-id>:/tmp/jira/<ticket-id>`** (read-write) — where attachments are downloaded

**Risks:**
- The container runs as root internally. While the `jcfa` binary is the only entrypoint, a compromised image could theoretically access mounted paths.
- Downloaded attachments in `/tmp/jira/` are world-readable by default on most systems.

**Mitigations:**
- The container is ephemeral (`--rm` flag) — it is destroyed after each command
- Only the two specified paths are mounted; the container cannot access the rest of your filesystem
- `/tmp/jira/` is cleaned up on system reboot
- Build the Docker image yourself from the Dockerfile in this directory rather than pulling a pre-built image — you can audit exactly what goes in

### Attachment Downloads

The skill downloads all non-video attachments from a ticket to `/tmp/jira/<ticket-id>/`. Be aware that:

- Attachments could contain malicious files (executables, macros, etc.)
- The skill does not scan downloads for malware
- Downloaded files persist until manually deleted or system reboot

### Network Access

The Docker container makes outbound HTTPS requests to your Jira instance. It does not listen on any ports or accept inbound connections.

## Setup

1. Build the Docker image (from the directory containing this README):
   ```bash
   docker build -t jcfa:latest .
   ```

2. Configure auth (interactive — run in your terminal, not inside an AI assistant session):
   ```bash
   docker run -it --rm -v ~/.jcfa:/root/.jcfa jcfa:latest configure
   ```

3. Lock down the config file:
   ```bash
   chmod 600 ~/.jcfa/config.yaml
   ```

## Usage

In any AI assistant session with this skill loaded:
- Type `/jira TICKET-ID` to explicitly fetch a ticket
- Or just mention a ticket ID (e.g., "look at PX-2825") and the assistant will invoke the skill automatically
