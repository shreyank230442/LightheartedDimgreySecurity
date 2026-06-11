---
name: NixOS pip in workflow shell
description: pip install in Replit workflow shell requires --break-system-packages; bash tool does not
---

In the Replit NixOS environment, the workflow shell (start.sh / bash start.sh) and the interactive bash tool use different Python environments. The workflow shell hits the "externally-managed-environment" PEP 668 block from NixOS.

**Rule:** Always add `--break-system-packages` to any `pip install` command that runs inside a workflow shell script (start.sh, entrypoint.sh, etc.).

**Why:** NixOS guards the system Python against modification by shell scripts, but the interactive bash tool bypasses this. Forgetting the flag causes the workflow to fail at startup with "This environment is externally managed".

**How to apply:** In every start.sh / entrypoint:
```bash
python3.11 -m pip install -q --break-system-packages <packages>
```
