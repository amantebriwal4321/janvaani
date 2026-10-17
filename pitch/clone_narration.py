#!/usr/bin/env python3
"""Speak pitch/narration.txt in Aman Tebriwal's own voice.

Local cloner (no API key): OpenVoice V2 tone-color converter on a MeloTTS
English base (Indian English speaker). A stock TTS voice is never written
to narration.wav.

Drop a real speech recording, at least 6 seconds, then run this file:

    python3 /workspace/pitch/clone_narration.py

Accepted drop-in paths (first match wins):

    /workspace/pitch/voice-sample.wav
    /workspace/pitch/voice-sample.m4a
    /workspace/pitch/voice-sample.mp3
    /workspace/pitch/voice-sample.webm
    /workspace/pitch/voice-sample.ogg
    /workspace/pitch/voice-sample.aac

Or pass a path:

    python3 /workspace/pitch/clone_narration.py /path/to/recording.m4a

The recording is normalized to 16 kHz mono PCM at
/workspace/pitch/voice-sample.wav. The narration is written to
/workspace/pitch/narration.wav only after that sample is accepted.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

VENV_PYTHON = Path("/home/ubuntu/.cache/janvaani-voice/.venv/bin/python")
CACHE = Path("/home/ubuntu/.cache/janvaani-voice")
OPENVOICE_REPO = CACHE / "OpenVoice"
MELO_REPO = CACHE / "MeloTTS"
CONVERTER_DIR = CACHE / "checkpoints_v2" / "converter"
SOURCE_SE = CACHE / "checkpoints_v2" / "base_speakers" / "ses" / "en-india.pth"

PITCH = Path("/workspace/pitch")
SAMPLE_WAV = PITCH / "voice-sample.wav"
NARRATION_TXT = PITCH / "narration.txt"
NARRATION_WAV = PITCH / "narration.wav"

MIN_SECONDS = 6.0
# Indian English base. Tone color still comes only from the reference sample.
BASE_SPEAKER = "EN_INDIA"
PARAGRAPH_PAUSE_SECONDS = 0.5

DROP_IN_NAMES = (
    "voice-sample.wav",
    "voice-sample.m4a",
    "voice-sample.mp3",
    "voice-sample.webm",
    "voice-sample.ogg",
    "voice-sample.aac",
    "voice-sample.flac",
)


def _reexec_into_venv() -> None:
    if not VENV_PYTHON.is_file():
        sys.stderr.write(
            "OpenVoice cloner is not installed.\n"
            f"Expected the virtualenv at {VENV_PYTHON}.\n"
        )
        raise SystemExit(1)
    # Compare prefixes. Do not resolve the venv interpreter symlink: it points
    # at system Python, and resolve().parent would no longer be the venv.
    venv_root = VENV_PYTHON.parent.parent
    if Path(sys.prefix).resolve() == venv_root.resolve():
        return
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])


_reexec_into_venv()

import json
import subprocess
import tempfile

import numpy as np
import soundfile as sf
import torch

sys.path.insert(0, str(OPENVOICE_REPO))
sys.path.insert(0, str(MELO_REPO))


def probe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=sample_rate,channels,codec_name",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        stderr=subprocess.STDOUT,
    )
    data = json.loads(raw)
    streams = data.get("streams") or []
    if not streams:
        raise RuntimeError(f"No audio stream in {path}")
    stream = streams[0]
    duration = data.get("format", {}).get("duration")
    if duration is None:
        duration = stream.get("duration")
    return {
        "sample_rate": int(stream["sample_rate"]),
        "channels": int(stream["channels"]),
        "codec": stream.get("codec_name"),
        "duration": float(duration),
    }


def find_drop_in(explicit: Path | None) -> Path | None:
    if explicit is not None:
        return explicit if explicit.is_file() else None
    for name in DROP_IN_NAMES:
        candidate = PITCH / name
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    return None


def normalize_to_16k_mono(src: Path) -> Path:
    """Write 16 kHz mono PCM16 to voice-sample.wav and return that path."""
    info = probe(src)
    already = (
        src.resolve() == SAMPLE_WAV.resolve()
        and info["sample_rate"] == 16000
        and info["channels"] == 1
        and info["codec"] == "pcm_s16le"
    )
    if already:
        return SAMPLE_WAV
    SAMPLE_WAV.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        suffix=".wav", dir=str(PITCH), delete=False
    ) as handle:
        temporary = Path(handle.name)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(src),
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(temporary),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        os.replace(temporary, SAMPLE_WAV)
    finally:
        if temporary.exists():
            temporary.unlink()
    if src.resolve() != SAMPLE_WAV.resolve() and src.parent == PITCH and src.name.startswith(
        "voice-sample."
    ):
        # Keep a single canonical sample. The original drop-in is the same take.
        if src.exists() and src.resolve() != SAMPLE_WAV.resolve():
            src.unlink()
    return SAMPLE_WAV


def assert_usable_sample(path: Path) -> float:
    info = probe(path)
    audio, sample_rate = sf.read(str(path), always_2d=False)
    samples = np.asarray(audio, dtype=np.float64)
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    duration = samples.shape[0] / float(sample_rate)
    if duration + 1e-3 < MIN_SECONDS:
        raise SystemExit(
            f"Voice sample is {duration:.2f}s. Need at least {MIN_SECONDS:.0f}s of speech "
            f"in {path}."
        )
    rms = float(np.sqrt(np.mean(np.square(samples)))) if samples.size else 0.0
    if rms < 0.005:
        raise SystemExit(
            f"Voice sample at {path} is silent (rms {rms:.5f}). "
            "Drop a real speech recording."
        )
    print(
        f"sample {path} duration {duration:.2f}s "
        f"rate {info['sample_rate']} ch {info['channels']} codec {info['codec']}"
    )
    return duration


def spoken_form(text: str) -> str:
    """Light pronunciation hints. narration.txt itself stays verbatim."""
    replacements = {
        "JanVaani": "Jan Vaani",
        "PM-Kisan": "P M Kisan",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def synthesize(sample_path: Path, text: str, output_path: Path) -> None:
    from openvoice.api import ToneColorConverter
    from melo.api import TTS

    if not CONVERTER_DIR.joinpath("checkpoint.pth").is_file():
        raise SystemExit(f"Missing OpenVoice checkpoint in {CONVERTER_DIR}")
    if not SOURCE_SE.is_file():
        raise SystemExit(f"Missing base-speaker embedding {SOURCE_SE}")

    device = "cpu"
    converter = ToneColorConverter(
        str(CONVERTER_DIR / "config.json"),
        device=device,
        enable_watermark=False,
    )
    converter.load_ckpt(str(CONVERTER_DIR / "checkpoint.pth"))
    target_se = converter.extract_se([str(sample_path)])
    source_se = torch.load(str(SOURCE_SE), map_location=device, weights_only=False)

    tts = TTS(language="EN", device=device)
    speaker_ids = tts.hps.data.spk2id
    if BASE_SPEAKER not in speaker_ids:
        raise SystemExit(
            f"MeloTTS has no {BASE_SPEAKER} speaker. Available: {list(speaker_ids)}"
        )
    speaker_id = speaker_ids[BASE_SPEAKER]

    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    if not paragraphs:
        raise SystemExit(f"No narration text in {NARRATION_TXT}")

    pieces: list[np.ndarray] = []
    rate = int(converter.hps.data.sampling_rate)
    pause = np.zeros(int(rate * PARAGRAPH_PAUSE_SECONDS), dtype=np.float32)

    with tempfile.TemporaryDirectory(prefix="janvaani-clone-") as directory:
        base_wav = Path(directory) / "base.wav"
        for index, paragraph in enumerate(paragraphs, start=1):
            print(f"synthesize paragraph {index}/{len(paragraphs)}")
            tts.tts_to_file(
                spoken_form(paragraph),
                speaker_id,
                str(base_wav),
                speed=1.0,
                quiet=True,
            )
            cloned = converter.convert(
                audio_src_path=str(base_wav),
                src_se=source_se,
                tgt_se=target_se,
                output_path=None,
                tau=0.3,
                message="default",
            )
            pieces.append(np.asarray(cloned, dtype=np.float32))
            if index != len(paragraphs):
                pieces.append(pause)

    audio = np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 0.99:
        audio = audio * (0.99 / peak)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), audio, rate, subtype="PCM_16")


def load_models_check() -> None:
    from openvoice.api import ToneColorConverter
    from melo.api import TTS

    converter = ToneColorConverter(
        str(CONVERTER_DIR / "config.json"),
        device="cpu",
        enable_watermark=False,
    )
    converter.load_ckpt(str(CONVERTER_DIR / "checkpoint.pth"))
    tts = TTS(language="EN", device="cpu")
    print(
        "ready OpenVoice",
        converter.version,
        "sr",
        converter.hps.data.sampling_rate,
        "melo",
        dict(tts.hps.data.spk2id),
    )


def missing_sample_message() -> str:
    return (
        "No user voice sample found.\n"
        "Drop a real speech recording of at least 6 seconds at\n"
        f"  {SAMPLE_WAV}\n"
        "or pass its path to this script. Stock TTS audio will not be used.\n"
        "Then run: python3 /workspace/pitch/clone_narration.py"
    )


def main(argv: list[str]) -> int:
    if argv and argv[0] == "--check":
        load_models_check()
        return 0

    explicit = Path(argv[0]).expanduser() if argv else None
    if explicit is not None and not explicit.is_file():
        sys.stderr.write(f"Recording not found: {explicit}\n")
        return 2

    source = find_drop_in(explicit)
    if source is None:
        sys.stderr.write(missing_sample_message() + "\n")
        return 2

    if not NARRATION_TXT.is_file():
        sys.stderr.write(f"Missing script {NARRATION_TXT}\n")
        return 1

    sample = normalize_to_16k_mono(source)
    assert_usable_sample(sample)
    text = NARRATION_TXT.read_text(encoding="utf-8")
    synthesize(sample, text, NARRATION_WAV)
    info = probe(NARRATION_WAV)
    print(
        f"wrote {NARRATION_WAV} duration {info['duration']:.2f}s "
        f"rate {info['sample_rate']} ch {info['channels']} codec {info['codec']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
