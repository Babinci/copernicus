#!/usr/bin/env python3
"""Generate and statically validate portable practitioner HTML reports."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


MODES = {"brief", "update", "explanation", "decision", "review", "lesson"}
FORBIDDEN_TAGS = {"script", "iframe", "form", "object", "embed", "base"}
SENSITIVE_PATTERNS: Tuple[Tuple[str, re.Pattern[str]], ...] = (
    ("private-key header", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("common secret token", re.compile(r"\b(?:sk|ghp|github_pat|xoxb|AIza)[-_A-Za-z0-9]{16,}\b")),
    ("credential assignment", re.compile(r"(?i)\b(?:api[_-]?key|password|secret|access[_-]?token)\s*[:=]\s*['\"]?[A-Za-z0-9_./+=-]{8,}")),
    ("home-directory path", re.compile(r"(?:/home|/Users)/[^/\s\"'<]+/")),
    ("Windows user path", re.compile(r"(?i)[A-Z]:\\Users\\[^\\\s\"'<]+\\")),
    ("private-key-like hex", re.compile(r"\b0x[a-fA-F0-9]{64}\b")),
)


def _text(value: Any) -> str:
    return html.escape(str(value), quote=True).replace("\n", "<br>\n")


def _plain(value: Any) -> str:
    return str(value).strip()


def _require_string(data: Mapping[str, Any], field: str) -> str:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"`{field}` must be a non-empty string")
    return value.strip()


def _string_list(value: Any, field: str, minimum: int = 0, maximum: Optional[int] = None) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise ValueError(f"`{field}` must be a list of non-empty strings")
    if len(value) < minimum or (maximum is not None and len(value) > maximum):
        limit = f"{minimum}..{maximum}" if maximum is not None else f"at least {minimum}"
        raise ValueError(f"`{field}` must contain {limit} entries")
    return [item.strip() for item in value]


def _safe_relative(value: str) -> bool:
    path = PurePosixPath(value)
    return bool(value) and value == value.strip() and not path.is_absolute() and ".." not in path.parts and "\\" not in value and ":" not in value and "%" not in value


def _contains_css_asset(value: str) -> bool:
    return "\\" in value or bool(re.search(r"@import\b|url\s*\(|(?:-webkit-)?image-set\s*\(", value, re.I))


def _validate_data(data: Any) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("report input must be a JSON object")
    result: Dict[str, Any] = dict(data)
    result["title"] = _require_string(result, "title")
    result["summary"] = _require_string(result, "summary")
    mode = _require_string(result, "mode").lower()
    if mode not in MODES:
        raise ValueError(f"`mode` must be one of: {', '.join(sorted(MODES))}")
    result["mode"] = mode

    sections = result.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("`sections` must be a non-empty list")
    checked_sections = []
    for index, section in enumerate(sections, start=1):
        if not isinstance(section, dict):
            raise ValueError(f"section {index} must be an object")
        heading = _require_string(section, "heading")
        body = section.get("body", "")
        if body is not None and not isinstance(body, str):
            raise ValueError(f"section {index} `body` must be a string")
        items = _string_list(section.get("items"), f"sections[{index}].items")
        if not str(body or "").strip() and not items:
            raise ValueError(f"section {index} needs `body`, `items`, or both")
        checked_sections.append({"heading": heading, "body": str(body or "").strip(), "items": items})
    result["sections"] = checked_sections

    for field in ("facts", "inferences", "unknowns"):
        result[field] = _string_list(result.get(field), field)
    for field in ("audience", "scope"):
        if result.get(field) is not None and not isinstance(result[field], str):
            raise ValueError(f"`{field}` must be a string when provided")

    recommendation = result.get("recommendation")
    if recommendation is not None:
        if not isinstance(recommendation, dict):
            raise ValueError("`recommendation` must be an object")
        result["recommendation"] = {
            "text": _require_string(recommendation, "text"),
            "falsifier": _require_string(recommendation, "falsifier"),
        }
    if (mode in {"decision", "review", "update"} or result.get("recommendation")) and not any(
        result[field] for field in ("facts", "inferences", "unknowns")
    ):
        raise ValueError("evidence-bearing reports need at least one fact, inference, or unknown")

    sources = result.get("sources", [])
    if not isinstance(sources, list):
        raise ValueError("`sources` must be a list")
    checked_sources = []
    for index, source in enumerate(sources, start=1):
        if isinstance(source, str) and source.strip():
            checked_sources.append({"label": source.strip()})
        elif isinstance(source, dict):
            label = _require_string(source, "label")
            url = source.get("url")
            if url is not None and (not isinstance(url, str) or not re.match(r"https?://", url)):
                raise ValueError(f"source {index} URL must start with http:// or https://")
            checked_sources.append({"label": label, "url": url})
        else:
            raise ValueError(f"source {index} must be a string or object with `label`")
    result["sources"] = checked_sources

    diagram = result.get("diagram")
    if diagram is not None:
        if not isinstance(diagram, dict):
            raise ValueError("`diagram` must be an object")
        steps = _string_list(diagram.get("steps"), "diagram.steps", minimum=2, maximum=6)
        if any(len(step) > 42 for step in steps):
            raise ValueError("each diagram step must be 42 characters or shorter")
        checked_diagram = {
            "title": _require_string(diagram, "title"),
            "description": _require_string(diagram, "description"),
            "steps": steps,
        }
        sidecar = diagram.get("sidecar")
        if sidecar is not None:
            if not isinstance(sidecar, str) or not _safe_relative(sidecar) or not sidecar.endswith(".excalidraw"):
                raise ValueError("diagram `sidecar` must be a safe relative .excalidraw path")
            checked_diagram["sidecar"] = sidecar
        result["diagram"] = checked_diagram

    quiz = result.get("quiz")
    if quiz is not None:
        if mode != "lesson":
            raise ValueError("`quiz` is supported only in `lesson` mode")
        if not isinstance(quiz, dict):
            raise ValueError("`quiz` must be an object")
        result["quiz"] = {
            "question": _require_string(quiz, "question"),
            "choices": _string_list(quiz.get("choices"), "quiz.choices", minimum=2, maximum=6),
            "answer": _require_string(quiz, "answer"),
            "explanation": _plain(quiz.get("explanation", "")),
        }
    return result


def _sensitive_findings(text: str) -> List[str]:
    return [f"possible {label}" for label, pattern in SENSITIVE_PATTERNS if pattern.search(text)]


def _slug(value: str, used: Iterable[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "section"
    used_set = set(used)
    candidate = base
    suffix = 2
    while candidate in used_set:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _render_paragraphs(body: str) -> str:
    return "\n".join(f"<p>{_text(part)}</p>" for part in body.split("\n\n") if part.strip())


def _render_items(items: Sequence[str]) -> str:
    if not items:
        return ""
    return "<ul>" + "".join(f"<li>{_text(item)}</li>" for item in items) + "</ul>"


def _wrap_flow_label(label: str) -> List[str]:
    words = label.split()
    lines: List[str] = []
    current = ""
    for word in words:
        proposal = f"{current} {word}".strip()
        if current and len(proposal) > 18:
            lines.append(current)
            current = word
        else:
            current = proposal
    if current:
        lines.append(current)
    return lines[:2]


def _render_flow(diagram: Mapping[str, Any]) -> str:
    steps = diagram["steps"]
    width = 40 + len(steps) * 160 + (len(steps) - 1) * 40
    pieces = [
        '<section id="flow" aria-labelledby="flow-heading" class="flow">',
        '<h2 id="flow-heading">Relationship map</h2>',
        f'<p>{_text(diagram["description"])}</p>',
        f'<svg role="img" aria-labelledby="flow-title flow-desc" viewBox="0 0 {width} 160">',
        f'<title id="flow-title">{_text(diagram["title"])}</title>',
        f'<desc id="flow-desc">{_text(diagram["description"])}</desc>',
        '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#1e3a5f" /></marker></defs>',
    ]
    for index, step in enumerate(steps):
        x = 20 + index * 200
        pieces.append(f'<rect x="{x}" y="58" width="160" height="64" rx="10" fill="#dbeafe" stroke="#1e3a5f" stroke-width="2" />')
        labels = _wrap_flow_label(step)
        first_y = 82 if len(labels) == 1 else 73
        for line_index, line in enumerate(labels):
            pieces.append(f'<text x="{x + 80}" y="{first_y + line_index * 20}" text-anchor="middle" fill="#374151">{_text(line)}</text>')
        if index < len(steps) - 1:
            pieces.append(f'<line x1="{x + 162}" y1="90" x2="{x + 198}" y2="90" stroke="#1e3a5f" stroke-width="2" marker-end="url(#arrow)" />')
    pieces.append("</svg>")
    if diagram.get("sidecar"):
        pieces.append(f'<p class="sidecar">Optional editable companion: <a href="{_text(diagram["sidecar"])}">{_text(diagram["sidecar"])}</a></p>')
    pieces.append("</section>")
    return "\n".join(pieces)


def _render_truth_section(identifier: str, title: str, items: Sequence[str], note: str) -> str:
    if not items:
        return ""
    return f'<section id="{identifier}" aria-labelledby="{identifier}-heading" class="truth {identifier}"><h2 id="{identifier}-heading">{title}</h2><p>{_text(note)}</p>{_render_items(items)}</section>'


def _build_html(data: Mapping[str, Any]) -> str:
    used_ids = {"report", "point", "flow", "observed", "inferred", "unknowns", "recommendation", "sources", "reflection"}
    sections = []
    for section in data["sections"]:
        identifier = _slug(section["heading"], used_ids)
        used_ids.add(identifier)
        sections.append(
            f'<section id="{identifier}" aria-labelledby="{identifier}-heading"><h2 id="{identifier}-heading">{_text(section["heading"])}</h2>{_render_paragraphs(section["body"])}{_render_items(section["items"])}</section>'
        )
    truth = "\n".join(
        filter(
            None,
            [
                _render_truth_section("observed", "Observed", data["facts"], "Directly supported statements or measurements."),
                _render_truth_section("inferred", "Inferred", data["inferences"], "Reasoned interpretations that could change with new evidence."),
                _render_truth_section("unknowns", "Unknown", data["unknowns"], "Important gaps that should not be silently filled with a guess."),
            ],
        )
    )
    recommendation = ""
    if data.get("recommendation"):
        recommendation = (
            '<section id="recommendation" aria-labelledby="recommendation-heading" class="recommendation">'
            '<h2 id="recommendation-heading">Recommendation</h2>'
            f'<p>{_text(data["recommendation"]["text"])}</p>'
            f'<p><strong>Falsifier:</strong> {_text(data["recommendation"]["falsifier"])}</p>'
            '</section>'
        )
    source_items = []
    for source in data["sources"]:
        if source.get("url"):
            source_items.append(f'<li><a href="{_text(source["url"])}" rel="noreferrer">{_text(source["label"])}</a></li>')
        else:
            source_items.append(f'<li>{_text(source["label"])}</li>')
    sources = ""
    if source_items:
        sources = '<section id="sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Sources and context</h2><ul>' + "".join(source_items) + "</ul></section>"
    quiz = ""
    if data.get("quiz"):
        choices = "".join(f"<li>{_text(choice)}</li>" for choice in data["quiz"]["choices"])
        explanation = f'<p>{_text(data["quiz"]["explanation"])}</p>' if data["quiz"]["explanation"] else ""
        quiz = (
            '<section id="reflection" aria-labelledby="reflection-heading" class="reflection">'
            '<h2 id="reflection-heading">Reflection check</h2>'
            f'<p>{_text(data["quiz"]["question"])}</p><ol>{choices}</ol>'
            '<details><summary>Reveal the author-provided answer</summary>'
            f'<p><strong>Answer:</strong> {_text(data["quiz"]["answer"])}</p>{explanation}'
            '</details><p class="caution">This checks recall against an author-provided answer. It is not independent grading or proof of understanding.</p></section>'
        )
    metadata = []
    if data.get("audience"):
        metadata.append(f'<span><strong>Audience:</strong> {_text(data["audience"])}</span>')
    if data.get("scope"):
        metadata.append(f'<span><strong>Scope:</strong> {_text(data["scope"])}</span>')
    metadata_html = "" if not metadata else '<p class="meta">' + " · ".join(metadata) + "</p>"
    diagram = _render_flow(data["diagram"]) if data.get("diagram") else ""
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{_text(data["title"])}</title>
  <style>
    :root {{ color-scheme: light; --ink:#172033; --muted:#56647a; --paper:#fbfcff; --line:#cbd5e1; --blue:#1e3a5f; --blue-soft:#dbeafe; --green:#d1fae5; --amber:#fef3c7; --rose:#fee2e2; }}
    * {{ box-sizing:border-box; }} body {{ margin:0; background:var(--paper); color:var(--ink); font:18px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif; }}
    main {{ max-width:900px; margin:auto; padding:clamp(1.2rem,4vw,4rem) clamp(1rem,4vw,2.5rem) 5rem; }}
    header {{ border-bottom:4px solid var(--blue); padding-bottom:2rem; margin-bottom:2rem; }} .eyebrow {{ color:var(--blue); font-weight:700; letter-spacing:.08em; text-transform:uppercase; font-size:.8rem; }}
    h1,h2 {{ line-height:1.15; color:var(--blue); }} h1 {{ font-size:clamp(2rem,6vw,4.5rem); margin:.2rem 0 .8rem; }} h2 {{ font-size:1.35rem; margin-top:0; }} section {{ margin:2rem 0; }}
    .summary {{ font-size:1.3rem; max-width:44rem; }} .meta,.sidecar {{ color:var(--muted); font-size:.95rem; }} .truth,.recommendation,.reflection {{ border-left:6px solid var(--line); padding:1rem 1.2rem; background:white; }}
    .observed {{ border-color:#047857; background:var(--green); }} .inferred {{ border-color:#b45309; background:var(--amber); }} .unknowns {{ border-color:#b91c1c; background:var(--rose); }} .recommendation {{ border-color:var(--blue); background:var(--blue-soft); }}
    .flow svg {{ display:block; width:100%; height:auto; border:1px solid var(--line); border-radius:.75rem; background:white; }} .flow text {{ font:600 16px system-ui,-apple-system,"Segoe UI",sans-serif; }}
    a {{ color:#1d4ed8; }} details {{ background:white; border:1px solid var(--line); border-radius:.5rem; padding:.7rem 1rem; }} summary {{ cursor:pointer; font-weight:700; }} .caution {{ color:var(--muted); font-size:.9rem; }}
    @media print {{ body {{ background:white; font-size:12pt; }} main {{ max-width:none; padding:0; }} a {{ color:inherit; text-decoration:none; }} }}
  </style>
</head>
<body>
  <main id="report">
    <header>
      <p class="eyebrow">{_text(data["mode"])}</p>
      <h1>{_text(data["title"])}</h1>
      <p class="summary" id="point">{_text(data["summary"])}</p>
      {metadata_html}
    </header>
    {diagram}
    {"".join(sections)}
    {truth}
    {recommendation}
    {quiz}
    {sources}
  </main>
</body>
</html>
'''


class _Inspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: List[str] = []
        self.anchors: List[str] = []
        self.errors: List[str] = []
        self.svg_stack: List[Dict[str, bool]] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        tag = tag.lower()
        attributes = [(name.lower(), value or "") for name, value in attrs]
        if tag in FORBIDDEN_TAGS:
            self.errors.append(f"forbidden tag: <{tag}>")
        if tag == "svg":
            self.svg_stack.append({"title": False, "desc": False})
        elif self.svg_stack and tag in {"title", "desc"}:
            self.svg_stack[-1][tag] = True
        for name, value in attributes:
            if name.startswith("on"):
                self.errors.append(f"event handler attribute: {name}")
            if name == "style" and _contains_css_asset(value):
                self.errors.append("embedded CSS asset found")
            if name == "id":
                self.ids.append(value)
            if name == "ping":
                self.errors.append("link ping is not allowed")
            if name in {"src", "srcset", "imagesrcset", "background", "poster"}:
                self.errors.append("embedded or remote `src` assets are not allowed")
            if name in {"href", "xlink:href"}:
                if value.startswith("#"):
                    self.anchors.append(value[1:])
                elif tag == "a" and (value.startswith("http://") or value.startswith("https://") or _safe_relative(value)):
                    continue
                else:
                    self.errors.append(f"unsafe link target: {value}")
        if tag == "meta" and any(name == "http-equiv" and value.lower() == "refresh" for name, value in attributes):
            self.errors.append("meta refresh is not allowed")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "svg" and self.svg_stack:
            svg = self.svg_stack.pop()
            if not svg["title"] or not svg["desc"]:
                self.errors.append("every SVG needs a title and desc")


def validate_html_document(document: str, allow_private: bool = False) -> List[str]:
    errors: List[str] = []
    if not re.search(r"<!doctype html>", document, re.I):
        errors.append("missing doctype")
    if not re.search(r"<html\b[^>]*\blang=", document, re.I):
        errors.append("missing html language")
    if not re.search(r"<meta\b[^>]*charset=", document, re.I):
        errors.append("missing charset")
    if not re.search(r"<meta\b[^>]*name=[\"']viewport[\"']", document, re.I):
        errors.append("missing viewport")
    if not re.search(r"<title>\s*\S[\s\S]*?</title>", document, re.I):
        errors.append("missing title")
    if not re.search(r"<style>[\s\S]*?</style>", document, re.I):
        errors.append("missing inline style")
    if not re.search(r"<main\b", document, re.I) or not re.search(r"<h1\b", document, re.I):
        errors.append("missing semantic main or h1")
    style_blocks = re.findall(r"<style\b[^>]*>([\s\S]*?)</style>", document, re.I)
    if any(_contains_css_asset(block) for block in style_blocks):
        errors.append("remote or embedded CSS asset found")
    if not allow_private:
        errors.extend(_sensitive_findings(document))
    parser = _Inspector()
    try:
        parser.feed(document)
        parser.close()
    except Exception as exc:
        errors.append(f"HTML parser error: {exc}")
    duplicate_ids = {identifier for identifier in parser.ids if parser.ids.count(identifier) > 1}
    if duplicate_ids:
        errors.append("duplicate ids: " + ", ".join(sorted(duplicate_ids)))
    id_set = set(parser.ids)
    for anchor in parser.anchors:
        if anchor and anchor not in id_set:
            errors.append(f"missing anchor target: #{anchor}")
    errors.extend(parser.errors)
    return list(dict.fromkeys(errors))


def _generate(input_path: Path, output_path: Path, overwrite: bool, allow_private: bool) -> None:
    data = _validate_data(json.loads(input_path.read_text(encoding="utf-8")))
    if not allow_private:
        findings = _sensitive_findings(json.dumps(data, ensure_ascii=False))
        if findings:
            raise ValueError("input rejected: " + "; ".join(findings))
    if output_path.exists() and not overwrite:
        raise ValueError(f"refusing to overwrite existing file: {output_path}; pass --overwrite")
    document = _build_html(data)
    errors = validate_html_document(document, allow_private=allow_private)
    if errors:
        raise ValueError("generated report failed validation: " + "; ".join(errors))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(document, encoding="utf-8")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    generate = subparsers.add_parser("generate", help="generate one standalone HTML report from JSON")
    generate.add_argument("input", type=Path)
    generate.add_argument("output", type=Path)
    generate.add_argument("--overwrite", action="store_true")
    generate.add_argument("--allow-private", action="store_true")
    check = subparsers.add_parser("check", help="validate a standalone HTML report")
    check.add_argument("report", type=Path)
    check.add_argument("--allow-private", action="store_true")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "generate":
            _generate(args.input, args.output, args.overwrite, args.allow_private)
            print(f"Wrote {args.output}")
        else:
            errors = validate_html_document(args.report.read_text(encoding="utf-8"), args.allow_private)
            if errors:
                print("\n".join(f"- {error}" for error in errors), file=sys.stderr)
                return 1
            print(f"OK: {args.report}")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
