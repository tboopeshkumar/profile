#!/usr/bin/env python3
"""Convert a LinkedIn data export into data/profile.json.

Usage:
    python3 tools/linkedin_to_json.py path/to/Basic_LinkedInDataExport.zip
    python3 tools/linkedin_to_json.py path/to/unzipped-folder

Get the export from LinkedIn: Settings & Privacy -> Data privacy ->
Get a copy of your data. Only the CSVs below are read; everything else
(connections, messages, ...) is ignored and never published.

The existing profile.json is used as a base, so a hand-set photo, links,
and any sections LinkedIn does not export are kept.
"""
import csv
import io
import json
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "profile.json"

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


class Export:
    """Reads CSVs from either a zip file or a directory, matching names case-insensitively."""

    def __init__(self, path):
        self.path = Path(path)
        if self.path.is_file():
            self.zip = zipfile.ZipFile(self.path)
            self.names = {Path(n).name.lower(): n for n in self.zip.namelist()}
        else:
            self.zip = None
            self.names = {p.name.lower(): p for p in self.path.rglob("*.csv")}

    def rows(self, filename, required_column):
        key = self.names.get(filename.lower())
        if key is None:
            return []
        if self.zip:
            text = self.zip.read(key).decode("utf-8-sig")
        else:
            text = Path(key).read_text(encoding="utf-8-sig")
        lines = text.splitlines(keepends=True)
        # Some exports start with a "Notes:" preamble; skip to the real header.
        start = next((i for i, l in enumerate(lines) if required_column in l), 0)
        reader = csv.DictReader(io.StringIO("".join(lines[start:])))
        return [{k.strip(): (v or "").strip() for k, v in r.items() if k} for r in reader]


def iso_date(s):
    """'Apr 2021' -> '2021-04', '2021' -> '2021', '' -> None."""
    s = (s or "").strip()
    if not s:
        return None
    m = re.match(r"([A-Za-z]{3})[a-z]*\.?\s+(\d{4})", s)
    if m and m.group(1).lower() in MONTHS:
        return f"{m.group(2)}-{MONTHS[m.group(1).lower()]:02d}"
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", s)  # 4/15/21 style
    if m:
        year = int(m.group(3))
        year += 2000 if year < 100 else 0
        return f"{year}-{int(m.group(1)):02d}"
    m = re.search(r"\d{4}", s)
    return m.group(0) if m else s


def sort_key(item):
    # Current roles first, then most recent start.
    return (item.get("end") is None, item.get("end") or "", item.get("start") or "")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ex = Export(sys.argv[1])
    profile = json.loads(OUT.read_text()) if OUT.exists() else {"basics": {}}
    basics = profile.setdefault("basics", {})

    prof = ex.rows("Profile.csv", "First Name")
    if prof:
        p = prof[0]
        name = " ".join(x for x in [p.get("First Name"), p.get("Last Name")] if x)
        basics["name"] = name or basics.get("name")
        basics["title"] = basics.get("title") or p.get("Headline")
        basics["summary"] = p.get("Summary") or basics.get("summary")
        basics["location"] = p.get("Geo Location") or basics.get("location")

    emails = ex.rows("Email Addresses.csv", "Email Address")
    primary = next((e for e in emails if e.get("Primary", "").lower() == "yes"), emails[0] if emails else None)
    if primary and not basics.get("email"):
        basics["email"] = primary["Email Address"]

    positions = ex.rows("Positions.csv", "Company Name")
    if positions:
        # Group roles by company. Hand-curated fields on an existing entry with the
        # same company name (short, client, domain, tags, earlier) are kept.
        existing = {e.get("company"): e for e in profile.get("experience", [])}
        grouped = {}
        for r in positions:
            company = r.get("Company Name")
            old = existing.get(company, {})
            entry = grouped.setdefault(company, {
                **{k: v for k, v in old.items() if k not in ("roles", "highlights")},
                "company": company,
                "location": r.get("Location") or old.get("location"),
                "roles": [],
                "highlights": [],
            })
            entry["roles"].append({
                "title": r.get("Title"),
                "start": iso_date(r.get("Started On")),
                "end": iso_date(r.get("Finished On")),
            })
            desc = r.get("Description") or ""
            entry["highlights"] += [re.sub(r"^[-•*▪●]\s*", "", l).strip() for l in desc.splitlines() if l.strip()]
        for entry in grouped.values():
            entry["roles"].sort(key=sort_key, reverse=True)
            entry["highlights"] = entry["highlights"] or existing.get(entry["company"], {}).get("highlights", [])
            entry.setdefault("tags", [])
        profile["experience"] = sorted(grouped.values(), key=lambda e: sort_key(e["roles"][0]), reverse=True)

    # Skills are grouped by hand; LinkedIn skills not listed yet go into "Other".
    skills = [r["Name"] for r in ex.rows("Skills.csv", "Name") if r.get("Name")]
    if skills:
        groups = profile.setdefault("skills", [])
        known = {s for g in groups for s in g.get("items", [])}
        new = [s for s in skills if s not in known]
        if new:
            other = next((g for g in groups if g.get("group") == "Other"), None)
            if other is None:
                other = {"group": "Other", "items": []}
                groups.append(other)
            other["items"] += new

    education = [{
        "degree": ", ".join(x for x in [r.get("Degree Name"), r.get("Notes")] if x) or None,
        "school": r.get("School Name"),
        "start": iso_date(r.get("Start Date")),
        "end": iso_date(r.get("End Date")),
    } for r in ex.rows("Education.csv", "School Name")]
    if education:
        profile["education"] = sorted(education, key=lambda e: e.get("end") or e.get("start") or "", reverse=True)

    certs = [{
        "name": r.get("Name"),
        "authority": r.get("Authority") or None,
        "url": r.get("Url") or None,
        "date": iso_date(r.get("Started On")),
    } for r in ex.rows("Certifications.csv", "Authority")]
    if certs:
        profile["certifications"] = sorted(certs, key=lambda c: c.get("date") or "", reverse=True)

    languages = [{"name": r.get("Name"), "proficiency": r.get("Proficiency") or None}
                 for r in ex.rows("Languages.csv", "Proficiency")]
    if languages:
        profile["languages"] = languages

    profile["_generated"] = f"LinkedIn import {datetime.now():%Y-%m-%d}"
    OUT.write_text(json.dumps(profile, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(positions)} positions, {len(skills)} skills, "
          f"{len(education)} education, {len(certs)} certifications.")


if __name__ == "__main__":
    main()
