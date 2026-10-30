import json, sys
from piper.phoneme_ids import DEFAULT_PHONEME_ID_MAP
cfg = {
    "audio": {"sample_rate": 22050, "quality": "medium"},
    "espeak": {"voice": "en-us"},
    "language": {"code": "en_US"},
    "inference": {"noise_scale": 0.667, "length_scale": 1, "noise_w": 0.8},
    "phoneme_type": "espeak",
    "phoneme_id_map": DEFAULT_PHONEME_ID_MAP,
    "num_symbols": 256,
    "num_speakers": 1,
    "speaker_id_map": {},
    "piper_version": "1.0.0",
}
json.dump(cfg, open(sys.argv[1], "w"))
