"""Notes parsing and merge helpers for enrichment output."""

from __future__ import annotations

import json
import re
from typing import Any, Callable


def extract_json_objects(text: str) -> list[dict[str, Any]]:
    """Extract JSON objects from free text, best-effort."""
    decoder = json.JSONDecoder()
    idx = 0
    items: list[dict[str, Any]] = []
    while idx < len(text):
        start = text.find('{', idx)
        if start == -1:
            break
        try:
            obj, end = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            idx = start + 1
            continue
        if isinstance(obj, dict):
            items.append(obj)
        idx = start + end
    return items


def note_blocks_to_markdown(note_blocks: object, coerce_text: Callable[[object, str], str]) -> str:
    """Convert provider note blocks to clean markdown (avoid raw JSON artifacts)."""

    def render_blocks(blocks: list[dict[str, Any]]) -> str:
        parts: list[str] = []
        seen: set[tuple[str, str]] = set()
        for block in blocks:
            title = coerce_text(block.get('title', ''), 'note_blocks.title').strip()
            content = coerce_text(block.get('content', ''), 'note_blocks.content').strip()
            key = (title, content)
            if key in seen:
                continue
            seen.add(key)
            if title:
                heading = title if title.startswith('#') else f"## {title}"
                parts.append(heading)
            if content:
                parts.append(content)
        return "\n\n".join(part for part in parts if part).strip()

    def parse_blocks_from_text(text: str) -> list[dict[str, Any]]:
        stripped = text.strip()
        if not stripped:
            return []
        parsed = extract_json_objects(stripped)
        if parsed:
            return parsed

        fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", stripped, re.DOTALL)
        if fenced:
            return extract_json_objects(fenced.group(1).strip())
        return []

    if note_blocks is None:
        return ''
    if isinstance(note_blocks, str):
        blocks = parse_blocks_from_text(note_blocks)
        if not note_blocks.strip():
            return ''
        markdown = render_blocks(blocks)
        return markdown or note_blocks.strip()
    if isinstance(note_blocks, dict):
        return render_blocks([note_blocks])
    if isinstance(note_blocks, list):
        dict_blocks: list[dict[str, Any]] = [item for item in note_blocks if isinstance(item, dict)]
        for item in note_blocks:
            if isinstance(item, str):
                dict_blocks.extend(parse_blocks_from_text(item))
        markdown = render_blocks(dict_blocks)
        if markdown:
            return markdown
        return coerce_text(note_blocks, 'note_blocks')
    return coerce_text(note_blocks, 'note_blocks')


def parse_notes_sections(markdown_text: str) -> tuple[str, dict[str, str], list[tuple[str, str]]]:
    """Parse markdown into intro text, known sections and other sections."""
    known_titles = {
        'quellen': 'Quellen',
        'quelle': 'Quellen',
        'quell': 'Quellen',
    }

    intro_lines: list[str] = []
    known_sections: dict[str, list[str]] = {title: [] for title in known_titles.values()}
    other_sections: list[tuple[str, list[str]]] = []

    current_lines = intro_lines

    for line in markdown_text.splitlines():
        heading = re.match(r"^##+\s+(.*?)\s*$", line.strip())
        if heading:
            raw_title = heading.group(1).strip()
            normalized_title = raw_title.lower()
            canonical_title = known_titles.get(normalized_title)
            if canonical_title:
                current_lines = known_sections[canonical_title]
            else:
                existing = next((item for item in other_sections if item[0] == raw_title), None)
                if existing is None:
                    bucket: list[str] = []
                    other_sections.append((raw_title, bucket))
                    current_lines = bucket
                else:
                    current_lines = existing[1]
            continue
        current_lines.append(line)

    intro = "\n".join(intro_lines).strip()
    known = {title: "\n".join(lines).strip() for title, lines in known_sections.items() if "\n".join(lines).strip()}
    others = [(title, "\n".join(lines).strip()) for title, lines in other_sections if "\n".join(lines).strip()]
    return intro, known, others


def combine_text_blocks(*blocks: str) -> str:
    """Combine markdown blocks while removing exact duplicates."""
    seen: set[str] = set()
    out: list[str] = []
    for block in blocks:
        cleaned = block.strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned)
    return "\n\n".join(out).strip()


def dedupe_section_content(content: str) -> str:
    """Remove repeated paragraphs inside one markdown section."""
    parts = [chunk.strip() for chunk in re.split(r"\n\s*\n", content) if chunk.strip()]
    seen: set[str] = set()
    unique: list[str] = []
    for part in parts:
        if part in seen:
            continue
        seen.add(part)
        unique.append(part)
    return "\n\n".join(unique).strip()


def build_note_appendix(base_notes: object, note_blocks: object, coerce_text: Callable[[object, str], str]) -> str:
    """Integrate generated notes into a clean, sectioned markdown structure."""
    base = coerce_text(base_notes, 'notes')
    addition = note_blocks_to_markdown(note_blocks, coerce_text)
    if not addition and not base:
        return ''
    if not addition:
        addition = ''
    if not base:
        base = ''

    base_intro, base_known, base_other = parse_notes_sections(base)
    add_intro, add_known, add_other = parse_notes_sections(addition)

    merged_parts: list[str] = []
    intro = combine_text_blocks(base_intro, add_intro)
    if intro:
        merged_parts.append(intro)

    other_map: dict[str, str] = {}
    ordered_titles: list[str] = []

    for title, content in add_other:
        cleaned_content = dedupe_section_content(content)
        if not cleaned_content:
            continue
        if title not in other_map:
            ordered_titles.append(title)
            other_map[title] = cleaned_content
            continue
        other_map[title] = dedupe_section_content(combine_text_blocks(cleaned_content, other_map[title]))

    for title, content in base_other:
        cleaned_content = dedupe_section_content(content)
        if not cleaned_content:
            continue
        if title not in other_map:
            ordered_titles.append(title)
            other_map[title] = cleaned_content
            continue
        other_map[title] = dedupe_section_content(combine_text_blocks(other_map[title], cleaned_content))

    for title in ordered_titles:
        content = other_map.get(title, '')
        normalized_content = dedupe_section_content(content)
        if normalized_content:
            merged_parts.append(f"## {title}\n{normalized_content}")

    sources_content = add_known.get('Quellen') or base_known.get('Quellen', '')
    sources_content = dedupe_section_content(sources_content)
    if sources_content:
        merged_parts.append(f"## Quellen\n{sources_content}")

    return "\n\n".join(part.strip() for part in merged_parts if part.strip()).strip()
