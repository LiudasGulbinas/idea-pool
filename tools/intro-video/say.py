import sys, wave
from piper import PiperVoice
from piper.config import SynthesisConfig
voice = PiperVoice.load(sys.argv[1], config_path=sys.argv[2])
with wave.open(sys.argv[4], "wb") as w:
    voice.synthesize_wav(sys.argv[3], w, syn_config=SynthesisConfig(length_scale=float(sys.argv[5]) if len(sys.argv) > 5 else 1.0))
