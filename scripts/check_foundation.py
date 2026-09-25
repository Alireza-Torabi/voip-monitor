#!/usr/bin/env python3
"""Validate the public Phase 1 repository foundation."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    ".env.example", ".gitignore", ".node-version", "AGENTS.md", "README.md", "README.fa.md",
    "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md", "LICENSE", "NOTICE",
    "package.json", "package-lock.json", "tsconfig.base.json", "docker-compose.yml",
    "backend/package.json", "backend/src/index.ts", "backend/src/server.ts", "backend/src/config.ts",
    "backend/test/health.test.mjs", "backend/test/config.test.mjs", "frontend/package.json", "frontend/src/App.tsx",
    "frontend/src/main.tsx", "frontend/test/App.test.tsx", "shared/package.json",
    "shared/src/index.ts", "shared/tsconfig.json",
    ".github/workflows/foundation.yml", "scripts/check_licenses.py",
    "docs/PROJECT_CONTEXT.md", "docs/MASTER_PLAN.md", "docs/DECISIONS.md",
    "docs/ARCHITECTURE.md", "docs/DEPENDENCY_REVIEW.md",
    "docs/INSTALL.md", "docs/INSTALL.fa.md",
    "docs/CONFIGURATION.md", "docs/CONFIGURATION.fa.md",
    "docs/OPERATIONS.md", "docs/OPERATIONS.fa.md",
    "docs/TROUBLESHOOTING.md", "docs/TROUBLESHOOTING.fa.md",
]
FORBIDDEN_SUFFIXES = (".db", ".sqlite", ".sqlite3", ".pcap", ".pcapng",
                      ".pem", ".key", ".p12", ".pfx", ".log")
FORBIDDEN_NAMES = {".env", "id_rsa", "id_ed25519"}
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    re.compile(r"(?im)^\s*(?:AMI_PASSWORD|SSH_PASSWORD|PASSWORD|API_TOKEN)\s*[:=]\s*[^#\s<][^\s#]*"),
]


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=False)


def check() -> list[str]:
    errors: list[str] = []
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            errors.append(f"Missing required file: {name}")
    if errors:
        return errors

    files_result = git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
    if files_result.returncode:
        return [f"Cannot enumerate public files: {files_result.stderr.strip()}"]
    public_files = [Path(name) for name in files_result.stdout.split("\0") if name]
    for path in public_files:
        name = path.name
        if path.parts and path.parts[0] in {".local", "secrets", "runtime", "data"}:
            errors.append(f"Private/runtime path would be public: {path}")
        if name in FORBIDDEN_NAMES or name.endswith(FORBIDDEN_SUFFIXES):
            errors.append(f"Forbidden public artifact: {path}")
        try:
            content = (ROOT / path).read_text(encoding="utf-8")
        except (UnicodeError, OSError):
            continue
        for pattern in SECRET_PATTERNS:
            if pattern.search(content):
                errors.append(f"Possible secret pattern in: {path}")

    for path in public_files:
        if path.suffix != ".md":
            continue
        content = (ROOT / path).read_text(encoding="utf-8")
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", content):
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            local = target.split("#", 1)[0]
            if not (ROOT / path.parent / local).exists():
                errors.append(f"Broken local link in {path}: {target}")

    ignored = git("check-ignore", "-q", ".local/DEPLOYMENT_CONTEXT.md")
    if ignored.returncode != 0:
        errors.append(".local/DEPLOYMENT_CONTEXT.md is not ignored")
    for example in ("runtime/check.db", "secrets/master.key", "data/state.sqlite3",
                    ".env", "capture.pcap", "server.pem"):
        if git("check-ignore", "-q", example).returncode != 0:
            errors.append(f"Runtime/private path is not ignored: {example}")

    env = (ROOT / ".env.example").read_text(encoding="utf-8")
    expected = {"APP_ENV", "APP_HOST", "APP_PORT", "APP_LOG_LEVEL", "APP_PBX_NETWORK_MODE", "DATA_PATH"}
    present = {line.split("=", 1)[0] for line in env.splitlines()
               if "=" in line and not line.lstrip().startswith("#")}
    if present != expected:
        errors.append(".env.example must contain only APP_ENV, APP_HOST, APP_PORT, APP_LOG_LEVEL, APP_PBX_NETWORK_MODE, and DATA_PATH")
    if "README.fa.md" not in (ROOT / "README.md").read_text(encoding="utf-8"):
        errors.append("README.md must link to README.fa.md")
    if "README.md" not in (ROOT / "README.fa.md").read_text(encoding="utf-8"):
        errors.append("README.fa.md must link to README.md")
    for name in ("README.fa.md", "docs/INSTALL.fa.md", "docs/CONFIGURATION.fa.md",
                 "docs/OPERATIONS.fa.md", "docs/TROUBLESHOOTING.fa.md"):
        content = (ROOT / name).read_text(encoding="utf-8")
        if content.count('<div dir="rtl">') != content.count("</div>"):
            errors.append(f"Unbalanced RTL container: {name}")
        if any("```" in block for block in re.findall(r'<div dir="rtl">(.*?)</div>', content, flags=re.S)):
            errors.append(f"Code fence inside RTL container: {name}")
    try:
        manifest = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        if manifest.get("private") is not True or manifest.get("license") != "Apache-2.0":
            errors.append("Root package manifest must be private and Apache-2.0")
        if manifest.get("workspaces") != ["backend", "frontend", "shared"]:
            errors.append("Unexpected npm workspaces")
    except (json.JSONDecodeError, OSError) as exc:
        errors.append(f"Invalid root package manifest: {exc}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    errors = check()
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Phase 1 foundation checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
