"""Run learner code in a short-lived, resource-limited Docker container."""

import os
import subprocess
import tempfile
import uuid
from dataclasses import dataclass
from typing import Optional, Union

from config import settings


MAX_CODE_BYTES = 100_000
MAX_OUTPUT_BYTES = 100_000


@dataclass
class RunResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False


def run_python(code: str, *, timeout: Optional[int] = None) -> RunResult:
    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        return RunResult("", "Code is too large to run.", 1)

    container_name = f"perspective-run-{uuid.uuid4().hex}"
    path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", encoding="utf-8", delete=False) as file:
            file.write(code)
            path = file.name
        os.chmod(path, 0o644)
        command = [
            "docker", "run", "--rm", "--name", container_name,
            "--network", "none", "--memory", "128m", "--cpus", "0.5",
            "--pids-limit", "64", "--read-only", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges", "--user", "65534:65534",
            "--ulimit", "fsize=200:200", "--ulimit", "nofile=64:64",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
            "--mount", f"type=bind,src={path},dst=/tmp/submission.py,readonly",
            settings.code_runner_image, "sh", "-c",
            "python /tmp/submission.py > /tmp/stdout 2> /tmp/stderr; code=$?; head -c 100000 /tmp/stdout; head -c 100000 /tmp/stderr >&2; exit \"$code\"",
        ]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout or settings.code_runner_timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            subprocess.run(["docker", "kill", container_name], capture_output=True, timeout=2, check=False)
            return RunResult(_decode_limited(exc.stdout), "Execution timed out.", 124, True)
        return RunResult(
            _limit_output(result.stdout),
            _limit_output(result.stderr),
            result.returncode,
        )
    except (OSError, subprocess.SubprocessError):
        return RunResult("", "Code runner is unavailable. Start Docker and retry.", 127)
    finally:
        if path and os.path.exists(path):
            os.remove(path)


def _decode_limited(value: Optional[Union[str, bytes]]) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return _limit_output(value)


def _limit_output(value: str) -> str:
    encoded = value.encode("utf-8", errors="replace")
    if len(encoded) <= MAX_OUTPUT_BYTES:
        return value
    return encoded[:MAX_OUTPUT_BYTES].decode("utf-8", errors="ignore") + "\n[output truncated]"
