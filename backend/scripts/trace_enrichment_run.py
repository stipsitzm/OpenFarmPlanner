#!/usr/bin/env python3
"""Run enrichment traces across GPT-4/5 model variants with detailed output."""

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

DEFAULT_MODELS = [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
]


@dataclass
class TraceState:
    include_full_prompt: bool
    steps: list[dict[str, Any]] = field(default_factory=list)
    prompt: str | None = None
    prompt_sha256: str | None = None
    provider_request: dict[str, Any] | None = None
    provider_response: dict[str, Any] | None = None

    def mark(self, name: str, **extra: Any) -> None:
        self.steps.append({"name": name, "ts": datetime.now(timezone.utc).isoformat(), **extra})


@contextlib.contextmanager
def enrichment_trace_hooks(trace: TraceState):
    """Attach runtime hooks to capture prompt/request/response details."""
    import farm.services.enrichment as enrichment_module

    original_build_prompt = enrichment_module.OpenAIResponsesProvider._build_prompt
    original_post = enrichment_module.requests.post

    def traced_build_prompt(self, culture, mode, **kwargs):
        started = time.perf_counter()
        prompt = original_build_prompt(self, culture, mode, **kwargs)
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
    parser = argparse.ArgumentParser(description="Trace AI enrichment runs across GPT-4/5 models.")
    parser.add_argument("culture_id", type=int, help="Culture primary key")
    parser.add_argument("mode", choices=["complete", "reresearch"], help="Enrichment mode")
    parser.add_argument("--model", dest="single_model", help="Run only one model (legacy compatibility)")
    parser.add_argument(
        "--models",
        help="Comma-separated model list. Defaults to all GPT-4/5 variants.",
    )
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
    parser.add_argument("--timeout", type=float, help="Override AI_ENRICHMENT_TIMEOUT_SECONDS for this run")
    parser.add_argument("--connect-timeout", type=float, help="Override connect timeout seconds")
    parser.add_argument("--read-timeout", type=float, help="Override read timeout seconds")
    parser.add_argument("--endpoint", help="Override OPENAI_RESPONSES_API_URL for this run")
    return parser


def _resolve_models(args: argparse.Namespace) -> list[str]:
    if args.single_model:
        return [args.single_model.strip()]
    if args.models:
        return [m.strip() for m in args.models.split(",") if m.strip()]
    return list(DEFAULT_MODELS)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def main() -> int:
    args = build_parser().parse_args()
    setup_django()

    from django.conf import settings
    from farm.models import Culture
    from farm.services.enrichment import enrich_culture

    backend_dir = Path(__file__).resolve().parents[1]
    output_dir = (backend_dir / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    models = _resolve_models(args)
    if not models:
        print("No models provided.", file=sys.stderr)
        return 2

    culture = Culture.all_objects.get(pk=args.culture_id)
    run_id = f"trace_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:8]}"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    original_model = getattr(settings, "AI_ENRICHMENT_MODEL", None)
    original_timeout = getattr(settings, "AI_ENRICHMENT_TIMEOUT_SECONDS", None)
    original_connect_timeout = getattr(settings, "AI_ENRICHMENT_CONNECT_TIMEOUT_SECONDS", None)
    original_read_timeout = getattr(settings, "AI_ENRICHMENT_READ_TIMEOUT_SECONDS", None)
    original_endpoint = getattr(settings, "OPENAI_RESPONSES_API_URL", None)

    if args.timeout is not None:
        settings.AI_ENRICHMENT_TIMEOUT_SECONDS = args.timeout
    if args.connect_timeout is not None:
        settings.AI_ENRICHMENT_CONNECT_TIMEOUT_SECONDS = args.connect_timeout
    if args.read_timeout is not None:
        settings.AI_ENRICHMENT_READ_TIMEOUT_SECONDS = args.read_timeout
    if args.endpoint:
        settings.OPENAI_RESPONSES_API_URL = args.endpoint

    started_at = datetime.now(timezone.utc)

    summary: list[dict[str, Any]] = []
    failures = 0

    for model in models:
        trace = TraceState(include_full_prompt=args.include_full_prompt)
        trace.mark("run_started", culture_id=args.culture_id, mode=args.mode, model=model)

        success = False
        result: dict[str, Any] | None = None
        error_info: dict[str, Any] | None = None
        run_started = datetime.now(timezone.utc)

        try:
            settings.AI_ENRICHMENT_MODEL = model
            trace.mark("model_overridden", original_model=original_model, override_model=model)
            trace.mark("culture_loaded", culture_name=culture.name, variety=culture.variety)
            trace.mark(
                "request_configuration",
                endpoint=getattr(settings, "OPENAI_RESPONSES_API_URL", None),
                timeout_seconds=getattr(settings, "AI_ENRICHMENT_TIMEOUT_SECONDS", None),
                connect_timeout_seconds=getattr(settings, "AI_ENRICHMENT_CONNECT_TIMEOUT_SECONDS", None),
                read_timeout_seconds=getattr(settings, "AI_ENRICHMENT_READ_TIMEOUT_SECONDS", None),
            )

            with enrichment_trace_hooks(trace):
                call_started = time.perf_counter()
                trace.mark("enrich_call_started")
                result = enrich_culture(culture, args.mode)
                call_duration_ms = (time.perf_counter() - call_started) * 1000
                trace.mark("enrich_call_finished", duration_ms=round(call_duration_ms, 3))

            success = True
        except Exception as exc:  # noqa: BLE001
            failures += 1
            error_info = {
                "type": type(exc).__name__,
                "message": str(exc),
                "traceback": traceback.format_exc(),
            }
            trace.mark("run_failed", error_type=error_info["type"], error_message=error_info["message"])
        finally:
            settings.AI_ENRICHMENT_MODEL = original_model

        finished_at = datetime.now(timezone.utc)
        duration_s = (finished_at - run_started).total_seconds()

        payload = {
            "run_id": run_id,
            "culture_id": args.culture_id,
            "culture_name": culture.name,
            "mode": args.mode,
            "success": success,
            "started_at": run_started.isoformat(),
            "finished_at": finished_at.isoformat(),
            "duration_seconds": duration_s,
            "model_override": model,
            "model_reported_by_service": (result or {}).get("model") if isinstance(result, dict) else None,
            "model_requested": ((trace.provider_request or {}).get("json") or {}).get("model"),
            "model_effective": ((trace.provider_response or {}).get("json") or {}).get("model"),
            "endpoint": getattr(settings, "OPENAI_RESPONSES_API_URL", None),
            "timeout_seconds": getattr(settings, "AI_ENRICHMENT_TIMEOUT_SECONDS", None),
            "connect_timeout_seconds": getattr(settings, "AI_ENRICHMENT_CONNECT_TIMEOUT_SECONDS", None),
            "read_timeout_seconds": getattr(settings, "AI_ENRICHMENT_READ_TIMEOUT_SECONDS", None),
            "prompt_sha256": trace.prompt_sha256,
            "prompt": trace.prompt,
            "provider_request": trace.provider_request,
            "provider_response": trace.provider_response,
            "parsed_structured_output": result,
            "validation": (result or {}).get("validation") if isinstance(result, dict) else None,
            "steps": trace.steps,
            "error": error_info,
        }

        trace_validation_warnings: list[str] = []
        model_requested = payload.get("model_requested")
        model_effective = payload.get("model_effective")
        model_override = payload.get("model_override")
        model_reported = payload.get("model_reported_by_service")

        if model_override and model_requested and model_override != model_requested:
            trace_validation_warnings.append(
                f"model_override ({model_override}) != model_requested ({model_requested})"
            )
        if model_override and model_effective and model_override != model_effective:
            trace_validation_warnings.append(
                f"model_override ({model_override}) != model_effective ({model_effective})"
            )
        if model_requested and model_effective and model_requested != model_effective:
            trace_validation_warnings.append(
                f"model_requested ({model_requested}) != model_effective ({model_effective})"
            )
        if model_reported and model_effective and model_reported != model_effective:
            trace_validation_warnings.append(
                f"model_reported_by_service ({model_reported}) != model_effective ({model_effective})"
            )

        payload["trace_validation"] = {
            "warnings": trace_validation_warnings,
            "has_mismatch": bool(trace_validation_warnings),
        }

        model_file = run_dir / f"{model.replace('.', '_')}.json"
        _write_json(model_file, payload)

        summary.append(
            {
                "model": model,
                "success": success,
                "duration_seconds": duration_s,
                "output_file": str(model_file),
                "error": error_info["message"] if error_info else None,
                "trace_mismatch": payload["trace_validation"]["has_mismatch"],
            }
        )

        status = "OK" if success else "FAIL"
        print(f"[{status}] model_override={model} requested={payload.get('model_requested')} effective={payload.get('model_effective')} duration={duration_s:.2f}s file={model_file}")

    ended_at = datetime.now(timezone.utc)
    aggregate = {
        "run_id": run_id,
        "culture_id": args.culture_id,
        "culture_name": culture.name,
        "mode": args.mode,
        "models": models,
        "started_at": started_at.isoformat(),
        "finished_at": ended_at.isoformat(),
        "duration_seconds": (ended_at - started_at).total_seconds(),
        "results": summary,
    }

    aggregate_file = run_dir / "all_models_summary.json"
    _write_json(aggregate_file, aggregate)

    settings.AI_ENRICHMENT_MODEL = original_model
    settings.AI_ENRICHMENT_TIMEOUT_SECONDS = original_timeout
    settings.AI_ENRICHMENT_CONNECT_TIMEOUT_SECONDS = original_connect_timeout
    settings.AI_ENRICHMENT_READ_TIMEOUT_SECONDS = original_read_timeout
    settings.OPENAI_RESPONSES_API_URL = original_endpoint

    ok_count = len(models) - failures
    print(
        f"[SUMMARY] {ok_count}/{len(models)} successful | run={run_id} | summary={aggregate_file}",
        file=sys.stderr if failures else sys.stdout,
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
