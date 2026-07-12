#!/usr/bin/env python3
"""Anonymize PMO_Platform.docx: remove Fanaye Technologies and personal names."""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

# Longest matches first so partial replacements do not leave fragments.
REPLACEMENTS: list[tuple[str, str]] = [
    (
        "Document prepared by Fanaye Technologies for CyberSec PMO Tool",
        "Document prepared for Cybsec PMO Platform",
    ),
    (
        "Fanaye Technologies (Bereket) retains delegated IAM roles for pipeline deployment and environment support.",
        "The implementation partner retains delegated IAM roles for pipeline deployment and environment support only, as defined in the access matrix. Cybsec retains full ownership of subscriptions and root access.",
    ),
    (
        "Fanaye Technologies — Principal Frontend Architect",
        "PMO Platform Team",
    ),
    (
        "Prepared by Bereket Mesefen — Fanaye Technologies  |  Confidential",
        "Prepared by: PMO Platform Team  |  Confidential",
    ),
    (
        "Prepared by: Bereket Mesefen — Fanaye Technologies",
        "Prepared by: PMO Platform Team",
    ),
    (
        "Prepared by Bereket Mesefen — Fanaye Technologies",
        "Prepared by: PMO Platform Team",
    ),
    (
        "Version 1.0 | June 2026 | Prepared by Bereket Mesefen — Fanaye Technologies",
        "Version 1.0 | June 2026 | Prepared by: PMO Platform Team",
    ),
    (
        "Bereket Mesefen — Fanaye Technologies",
        "PMO Platform Team",
    ),
    (
        "Fanaye Technologies  |  Confidential",
        "PMO Platform Team  |  Confidential",
    ),
    (
        "Fanaye Technologies                     Client:",
        "PMO Platform Team                     Client:",
    ),
    (
        "Fanaye Technologies   Page",
        "PMO Platform Team   Page",
    ),
    ("Bereket QA / Dev", "QA / Development Team"),
    ("Bereket self-tests", "The QA team self-tests"),
    ("Bereket Done", "Verification Done"),
    ("Bereket QA", "QA Team"),
    ("Bereket Mesefen", "PMO Platform Team"),
    ("Fanaye Technologies", "PMO Platform Team"),
]

# Second-pass branding (already-anonymized docs).
BRANDING_REPLACEMENTS: list[tuple[str, str]] = [
    ("Prepared by: Cybsec PMO Programme", "Prepared by: PMO Platform Team"),
    ("Cybsec PMO Programme  |  Confidential", "PMO Platform Team  |  Confidential"),
    ("Cybsec PMO Programme                     Client:", "PMO Platform Team                     Client:"),
    ("Cybsec PMO Programme   Page", "PMO Platform Team   Page"),
    ("Technical Architecture Team", "PMO Platform Team"),
    ("Cybsec PMO Programme", "PMO Platform Team"),
]

WORD_XML_PREFIX = "word/"
DEFAULT_DOC = Path(__file__).resolve().parents[1] / "PMO_Platform.docx"


def apply_replacements(text: str, mapping: list[tuple[str, str]]) -> tuple[str, int]:
    total = 0
    for old, new in mapping:
        count = text.count(old)
        if count:
            text = text.replace(old, new)
            total += count
    return text, total


def anonymize_xml(text: str) -> tuple[str, int]:
    text, count = apply_replacements(text, REPLACEMENTS)
    text, branding = apply_replacements(text, BRANDING_REPLACEMENTS)
    return text, count + branding


def anonymize_docx(doc_path: Path, backup: bool = True) -> None:
    if not doc_path.is_file():
        raise FileNotFoundError(doc_path)

    backup_path = doc_path.with_suffix(doc_path.suffix + ".bak")
    if backup:
        shutil.copy2(doc_path, backup_path)
        print(f"Backup: {backup_path}")

    tmp_path = doc_path.with_suffix(".tmp.docx")
    replacements = 0

    with zipfile.ZipFile(doc_path, "r") as zin, zipfile.ZipFile(tmp_path, "w") as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.startswith(WORD_XML_PREFIX) and item.filename.endswith(".xml"):
                text = data.decode("utf-8")
                text, count = anonymize_xml(text)
                replacements += count
                data = text.encode("utf-8")
            zout.writestr(item, data)

    tmp_path.replace(doc_path)
    print(f"Updated: {doc_path}")
    print(f"Replacements applied: {replacements}")


def verify(doc_path: Path) -> None:
    with zipfile.ZipFile(doc_path) as z:
        parts = []
        for name in z.namelist():
            if name.startswith(WORD_XML_PREFIX) and name.endswith(".xml"):
                parts.append(z.read(name).decode("utf-8", errors="replace"))
    blob = " ".join(parts)
    for term in ("Fanaye", "Bereket", "fanaye", "Cybsec PMO Programme"):
        hits = len(re.findall(re.escape(term), blob, re.I))
        print(f"  remaining '{term}': {hits}")
    team_hits = len(re.findall(re.escape("PMO Platform Team"), blob, re.I))
    print(f"  'PMO Platform Team' occurrences: {team_hits}")


def main() -> int:
    doc_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DOC
    anonymize_docx(doc_path)
    print("Verification:")
    verify(doc_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
