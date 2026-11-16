#!/usr/bin/env python3
"""Regenerate the original demo narration and its matching cue timestamps."""
import json
from pathlib import Path
import subprocess
import tempfile
import wave

root = Path(__file__).resolve().parents[1] / "demo" / "story"
story = json.loads((root / "script.json").read_text())
with tempfile.TemporaryDirectory() as directory:
    temporary = Path(directory)
    for episode in story["episodes"]:
        frames = []
        position = 0
        chapters = []
        for index, passage in enumerate(episode["passages"]):
            part = temporary / f"part-{index}.wav"
            subprocess.run([
                "espeak-ng", "-v", "en-gb", "-s", "148", "-p", "38",
                "-w", str(part), "--stdin",
            ], input=passage["text"], text=True, check=True)
            with wave.open(str(part)) as audio:
                parameters = audio.getparams()
                chunk = audio.readframes(audio.getnframes())
            frame_width = parameters.nchannels * parameters.sampwidth
            silence = b"\0" * round(parameters.framerate * 0.7) * frame_width
            passage["start"] = round(position / parameters.framerate, 6)
            frames.extend([chunk, silence])
            position += (len(chunk) + len(silence)) // frame_width
            passage["end"] = round(position / parameters.framerate, 6)
            chapters.append({"startTime": passage["start"], "title": passage["title"]})
        merged = temporary / "episode.wav"
        with wave.open(str(merged), "wb") as output:
            output.setparams(parameters)
            output.writeframes(b"".join(frames))
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(merged),
            "-codec:a", "libmp3lame", "-b:a", "64k",
            str(root / "assets" / f"{episode['id']}.mp3"),
        ], check=True)
        episode["duration"] = round(position / parameters.framerate, 6)
        (root / "assets" / f"{episode['id']}.chapters.json").write_text(
            json.dumps({"version": "1.2.0", "chapters": chapters}, indent=2) + "\n"
        )
(root / "story.json").write_text(json.dumps(story, indent=2) + "\n")
