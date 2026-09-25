#!/usr/bin/env python3
"""Reject unreviewed license identifiers in the npm lockfile."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWED = {
    "Apache-2.0",
    "MIT",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "MPL-2.0",
    "BlueOak-1.0.0",
    "MIT-0",
    "CC0-1.0",
}


def check() -> list[str]:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    for name, package in lock["packages"].items():
        if not name.startswith("node_modules/"):
            continue
        if name.startswith("node_modules/@voip-monitor/"):
            continue
        license_id = package.get("license")
        if license_id not in REVIEWED:
            errors.append(f"{name}: unreviewed license {license_id!r}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    errors = check()
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Resolved npm license identifiers are in the reviewed set.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
