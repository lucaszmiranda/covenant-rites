"""Extrai de um arquivo Guitar Pro 7/8 (.gp) o que a pagina usa: compassos,
secoes, tempo e as notas de cada trilha. Uso:

    python tools/gp2json.py gp/circle-of-the-tyrants.gp data/scores/circle-of-the-tyrants.json
"""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

TICKS = {"Whole": 3840, "Half": 1920, "Quarter": 960, "Eighth": 480,
         "16th": 240, "32nd": 120, "64th": 60}


def text(el, path, default=None):
    found = el.find(path)
    if found is None or found.text is None:
        return default
    return found.text.strip()


def prop(note, name):
    for p in note.iter("Property"):
        if p.get("name") == name:
            return p
    return None


def rhythm_ticks(rh):
    value = text(rh, "NoteValue")
    ticks = TICKS[value]
    dot = rh.find("AugmentationDot")
    if dot is not None:
        ticks = ticks * {1: 1.5, 2: 1.75}[int(dot.get("count"))]
    tup = rh.find("PrimaryTuplet")
    if tup is not None:
        ticks = ticks * int(tup.get("den")) / int(tup.get("num"))
    return {"v": value, "dots": int(dot.get("count")) if dot is not None else 0,
            "tuplet": [int(tup.get("num")), int(tup.get("den"))] if tup is not None else None,
            "ticks": round(ticks)}


def parse_note(n):
    out = {}
    s, f = prop(n, "String"), prop(n, "Fret")
    if s is not None:
        out["s"] = int(text(s, "String"))
    if f is not None:
        out["f"] = int(text(f, "Fret"))
    out["a"] = int(text(n, "InstrumentArticulation", "0"))
    tie = n.find("Tie")
    if tie is not None and tie.get("destination") == "true":
        out["tie"] = True
    if prop(n, "PalmMuted") is not None:
        out["pm"] = True
    if prop(n, "Muted") is not None:
        out["x"] = True
    if prop(n, "HopoOrigin") is not None:
        out["hopo"] = True
    slide = prop(n, "Slide")
    if slide is not None:
        out["slide"] = int(text(slide, "Flags"))
    if n.find("Accent") is not None:
        out["acc"] = True
    return out


def main(src, dst):
    root = ET.fromstring(zipfile.ZipFile(src).read("Content/score.gpif"))

    score = root.find("Score")
    meta = {k.lower(): text(score, k) for k in ("Title", "Artist", "Album", "Tabber")}

    rhythms = {r.get("id"): rhythm_ticks(r) for r in root.find("Rhythms")}
    notes = {n.get("id"): parse_note(n) for n in root.find("Notes")}
    beats = {}
    for b in root.find("Beats"):
        rh = rhythms[b.find("Rhythm").get("ref")]
        ids = text(b, "Notes")
        beat = {"d": rh["ticks"], "v": rh["v"]}
        if rh["dots"]:
            beat["dots"] = rh["dots"]
        if rh["tuplet"]:
            beat["tuplet"] = rh["tuplet"]
        if ids:
            beat["n"] = [notes[i] for i in ids.split()]
        beats[b.get("id")] = beat
    voices = {v.get("id"): text(v, "Beats", "").split() for v in root.find("Voices")}
    bars = {b.get("id"): text(b, "Voices").split() for b in root.find("Bars")}

    tracks = []
    for t in root.find("Tracks"):
        tuning = t.find(".//Property[@name='Tuning']/Pitches")
        pitches = [int(p) for p in tuning.text.split()] if tuning is not None else []
        kind = text(t, "InstrumentSet/Type", "")
        arts = [text(a, "Name", "") for a in t.iter("Articulation")]
        tracks.append({
            "name": text(t, "Name"),
            "kind": "drums" if "drum" in kind.lower() else ("bass" if "bass" in kind.lower() else "guitar"),
            "tuning": pitches if any(pitches) else [],
            "articulations": arts if "drum" in kind.lower() else [],
            "bars": [],
        })

    tempos = {}
    for a in root.find("MasterTrack").iter("Automation"):
        if text(a, "Type") == "Tempo":
            tempos[int(text(a, "Bar"))] = int(float(text(a, "Value").split()[0]))

    master = []
    for i, mb in enumerate(root.find("MasterBars")):
        entry = {"time": text(mb, "Time")}
        sec = mb.find("Section")
        if sec is not None:
            entry["section"] = text(sec, "Text")
        if i in tempos:
            entry["tempo"] = tempos[i]
        master.append(entry)
        for ti, bar_id in enumerate(text(mb, "Bars").split()):
            first_voice = next((v for v in bars[bar_id] if v != "-1"), None)
            beat_list = [beats[b] for b in voices[first_voice]] if first_voice else []
            tracks[ti]["bars"].append(beat_list)

    out = {**meta, "bars": master, "tracks": tracks}
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{dst}: {len(master)} compassos, {len(tracks)} trilhas")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
