#!/usr/bin/env python3
"""Convert a caption file into the repo's transcript Markdown (one ~1-minute paragraph per line).

Usage:
  python3 tools/to_transcript_md.py <captions> <out.md> --title T --series S --url U --source SRC

<captions> is either YouTube json3 (`events[].segs[].utf8`, `tStartMs`) or mlx-whisper
JSON (`segments[].start/.text`). Every paragraph starts with `[HH:MM:SS]`, the line
number becoming the anchor for later corrections (see .claude/rules/transcript-cleanup.md).
"""
import argparse
import json
import re
from pathlib import Path


def load_segments(path: Path):
    d = json.loads(path.read_text())
    if "events" in d:  # YouTube json3
        for e in d["events"]:
            if "segs" not in e:
                continue
            t = "".join(s.get("utf8", "") for s in e["segs"]).replace("\n", " ").strip()
            if t:
                yield e["tStartMs"] / 1000, t
    elif "segments" in d:  # mlx-whisper
        for s in d["segments"]:
            t = s["text"].strip()
            if t:
                yield s["start"], t
    else:
        raise SystemExit(f"unrecognised caption format: {path}")


def stamp(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"[{h:02d}:{m:02d}:{s:02d}]"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("captions", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--title", required=True)
    ap.add_argument("--series", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--source", required=True, help="e.g. 'YouTube auto-captions (ar-orig)'")
    ap.add_argument("--para-seconds", type=int, default=60)
    args = ap.parse_args()

    out = [f"# {args.title}", "", f"- Series: {args.series}", f"- URL: {args.url}",
           f"- Source: {args.source}", ""]
    block, start = [], None
    for ts, text in load_segments(args.captions):
        if start is None:
            start = ts
        block.append(text)
        if ts - start >= args.para_seconds:
            out += [stamp(start) + " " + re.sub(r"\s+", " ", " ".join(block)), ""]
            block, start = [], None
    if block:
        out.append(stamp(start) + " " + re.sub(r"\s+", " ", " ".join(block)))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(out) + "\n")
    words = sum(len(l.split()) for l in out)
    print(f"{args.out}: {len(out)} lines, ~{words} words")


if __name__ == "__main__":
    main()
