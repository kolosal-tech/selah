#!/usr/bin/env python3
"""Synthetise un pad d'ambiance bouclable sans raccord (Selah).

Contrainte de boucle : toute frequence (partiel ou LFO) est arrondie a un
multiple de 1/DUREE Hz, donc chaque oscillateur boucle un nombre entier de
cycles sur la duree — la fin se raccorde exactement au debut, sans clic.
"""
import math
import struct
import sys
import wave

SR = 44100
DUREE = 32.0            # secondes
N = int(SR * DUREE)
PAS = 1.0 / DUREE       # resolution frequentielle bouclable (0.03125 Hz)


def snap(f):
    """Arrondit une frequence au multiple de 1/DUREE le plus proche."""
    return max(PAS, round(f / PAS) * PAS)


# Accord de Re majeur add9, voicing large et aere.
NOTES = [
    (146.83, 1.00),   # D3  fondamentale
    (220.00, 0.62),   # A3  quinte
    (293.66, 0.48),   # D4  octave
    (369.99, 0.34),   # F#4 tierce
    (440.00, 0.22),   # A4
    (587.33, 0.12),   # D5  brillance
    (73.42,  0.55),   # D2  soutien grave
]

# Trois voix legerement desaccordees par note : battements lents (chorus).
DETUNES = (0.9970, 1.0, 1.0031)


def rendu(phase_canal):
    buf = [0.0] * N
    for idx, (freq, gain) in enumerate(NOTES):
        for d_idx, det in enumerate(DETUNES):
            f = snap(freq * det)
            w = 2.0 * math.pi * f / SR
            ph = (idx * 1.7 + d_idx * 2.3 + phase_canal) % (2 * math.pi)
            # Respiration : LFO lent, lui aussi bouclable.
            k_lfo = 1 + (idx % 3)                 # 1..3 cycles sur la boucle
            f_lfo = snap(k_lfo / DUREE)
            w_lfo = 2.0 * math.pi * f_lfo / SR
            ph_lfo = (idx * 0.9 + d_idx * 1.1 + phase_canal) % (2 * math.pi)
            amp = gain / len(DETUNES)
            for n in range(N):
                env = 0.55 + 0.45 * math.sin(w_lfo * n + ph_lfo)
                buf[n] += amp * env * math.sin(w * n + ph)
    return buf


gauche = rendu(0.0)
droite = rendu(1.15)   # decorrelation L/R : largeur stereo sans deriver la boucle

crete = max(max(abs(x) for x in gauche), max(abs(x) for x in droite))
# Pic a -9 dBFS : un fond sonore ne doit jamais dominer la voix des videos.
cible = 10 ** (-9 / 20)
g = cible / crete

sortie = sys.argv[1]
with wave.open(sortie, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    trames = bytearray()
    for n in range(N):
        l = int(max(-1.0, min(1.0, gauche[n] * g)) * 32767)
        r = int(max(-1.0, min(1.0, droite[n] * g)) * 32767)
        trames += struct.pack("<hh", l, r)
    w.writeframes(bytes(trames))

print(f"{sortie} : {DUREE}s, {N} trames, crete avant gain {crete:.3f}")
