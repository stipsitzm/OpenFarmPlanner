#!/usr/bin/env python3
"""Run one enrichment invocation with detailed tracing output.

This script reuses the project's existing enrichment service logic and records
step-by-step timings and payload metadata for debugging long-running requests.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import sys
import time
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class TraceState:
    include_full_prompt: bool
    steps: list[dict[str, Any]] = field(default_factory=list)
    prompt: str | None = None
    prompt_sha256: str | None = None
    provider_request: dict[str, Any] | None = None
    provider_response: dict[str, Any] | None = None

    def mark(self, name: str, **extra: Any) -> None:
        self.steps.append(
            {
                "name": name,
                "ts": datetime.now(timezone.utc).isoformat(),
                **extra,
            }
        )


@contextlib.contextmanager
def enrichment_trace_hooks(trace: TraceState):
    """Attach lightweight runtime hooks to capture prompt/request/response details."""
    import farm.services.enrichment as enrichment_module

    original_build_prompt = enrichment_module.OpenAIResponsesProvider._build_prompt
    original_post = enrichment_module.requests.post

    def traced_build_prompt(self, culture, mode):
        started = time.perf_counter()
        prompt = original_build_prompt(self, culture, mode)
        duration_ms = (time.perf_counter() - started) * 1000

        trace.prompt = prompt if trace.include_full_prompt else None
        trace.prompt_sha256 = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
        trace.mark(
            "prompt_built",
            duration_ms=round(duration_ms, 3),
            prompt_len=len(prompt),
            prompt_sha256=trace.prompt_sha256,
        )
        return prompt

    def traced_post(*args, **kwargs):
        request_started_at = datetime.now(timezone.utc).isoformat()
        started = time.perf_counter()
        trace.provider_request = {
            "url": args[0] if args else kwargs.get("url"),
            "timeout": kwargs.get("timeout"),
            "json": kwargs.get("json"),
        }
        trace.mark("provider_request_started", request_started_at=request_started_at)

        response = original_post(*args, **kwargs)

        duration_ms = (time.perf_counter() - started) * 1000
        response_ended_at = datetime.now(timezone.utc).isoformat()
        raw_text = response.text
        try:
            response_json: Any = response.json()
        except Exception:  # noqa: BLE001
            response_json = None

        trace.provider_response = {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "text": raw_text,
            "json": response_json,
            "request_started_at": request_started_at,
            "response_ended_at": response_ended_at,
            "duration_ms": round(duration_ms, 3),
        }
        trace.mark(
            "provider_response_received",
            status_code=response.status_code,
            response_ended_at=response_ended_at,
            duration_ms=round(duration_ms, 3),
        )
        return response

    enrichment_module.OpenAIResponsesProvider._build_prompt = traced_build_prompt
    enrichment_module.requests.post = traced_post
    try:
        yield
    finally:
        enrichment_module.OpenAIResponsesProvider._build_prompt = original_build_prompt
        enrichment_module.requests.post = original_post


def setup_django() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    import django

    django.setup()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Trace one AI enrichment run with detailed timings.")
    parser.add_argument("culture_id", type=int, help="Culture primary key")
    parser.add_argument("mode", choices=["complete", "reresearch"], help="Enrichment mode")
    parser.add_argument("--model", dest="model_override", help="Optional AI_ENRICHMENT_MODEL override")
    parser.add_argument(
        "--include-full-prompt",
        action="store_true",
        help="Include full prompt text in trace JSON (otherwise only sha256 hash is stored)",
    )
    parser.add_argument(
        "--output-dir",
        default="trace_runs",
        help="Output directory relative to backend folder (default: trace_runs)",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    setup_django()

    from django.conf import settings
    from farm.models import Culture
    from farm.services.enrichment import enrich_culture

    trace = TraceState(include_full_prompt=args.include_full_prompt)

    backend_dir = Path(__file__).resolve().parents[1]
    output_dir = (backend_dir / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    run_id = f"trace_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:8]}"
    output_path = output_dir / f"{run_id}.json"

    started_at = datetime.now(timezone.utc)
    trace.mark("run_started", culture_id=args.culture_id, mode=args.mode)

    original_model = getattr(settings, "AI_ENRICHMENT_MODEL", None)
    if args.model_override:
        settings.AI_ENRICHMENT_MODEL = args.model_override
        trace.mark("model_overridden", original_model=original_model, override_model=args.model_override)

    success = False
    result: dict[str, Any] | None = None
    error_info: dict[str, Any] | None = None

    try:
        culture = Culture.all_objects.get(pk=args.culture_id)
        trace.mark("culture_loaded", culture_name=culture.name, variety=culture.variety)

        with enrichment_trace_hooks(trace):
            call_started = time.perf_counter()
            trace.mark("enrich_call_started")
            result = enrich_culture(culture, args.mode)
            call_duration_ms = (time.perf_counter() - call_started) * 1000
            trace.mark("enrich_call_finished", duration_ms=round(call_duration_ms, 3))

        success = True
    except Exception as exc:  # noqa: BLE001
        error_info = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc(),
        }
        trace.mark("run_failed", error_type=error_info["type"], error_message=error_info["message"])
    finally:
        if args.model_override:
            settings.AI_ENRICHMENT_MODEL = original_model

    finished_at = datetime.now(timezone.utc)
    duration_s = (finished_at - started_at).total_seconds()

    payload = {
        "run_id": run_id,
        "culture_id": args.culture_id,
        "mode": args.mode,
        "success": success,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": duration_s,
        "model_used": (result or {}).get("model") if isinstance(result, dict) else (args.model_override or original_model),
        "model_override": args.model_override,
        "prompt_sha256": trace.prompt_sha256,
        "prompt": trace.prompt,
        "provider_request": trace.provider_request,
        "provider_response": trace.provider_response,
        "parsed_structured_output": result,
        "validation": (result or {}).get("validation") if isinstance(result, dict) else None,
        "steps": trace.steps,
        "error": error_info,
    }

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    if success:
        print(
            f"[OK] enrichment trace complete | duration={duration_s:.2f}s | "
            f"model={payload['model_used']} | trace={output_path}"
        )
        return 0

    print(
        f"[FAIL] enrichment trace failed | duration={duration_s:.2f}s | "
        f"model={payload['model_used']} | trace={output_path}",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
