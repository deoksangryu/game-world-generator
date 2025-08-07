# ff_nomura_flux_fixed.py
import torch
from diffusers import FluxPipeline

device = "mps" if torch.backends.mps.is_available() else \
         "cuda" if torch.cuda.is_available() else "cpu"
dtype  = torch.bfloat16 if device != "cpu" else torch.float32

pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=dtype
).to(device)

# ── (선택) 기존 LoRA 해제 ───────────────────────────
if hasattr(pipe, "unfuse_lora"):        # 함수 존재 여부 확인
    try:
        pipe.unfuse_lora()              # 이미 붙은 LoRA가 없어도 오류 없이 넘어감
    except Exception:
        pass

# ── Cine / Realistic LoRA 로드 ─────────────────────
pipe.load_lora_weights(
    "ohcaidek/CineLora_Flux",                 # 원하는 LoRA 레포
    weight_name="cine_nocap_16.safetensors",  # 파일명
    adapter_name="cine",
    backend="diffusers"
)
pipe.fuse_lora(adapter_name="cine", inplace=True)

# ── 노무라풍 프롬프트 ──────────────────────────────
positive_prompt = (
    "jrpg cinematic concept art, beautiful fantasy heroine inspired by final fantasy eight game, "
    "front view, eye-contact, shoulders-up, flowing chestnut hair, "
    "sleek leather-and-steel armor with glowing blue glyphs, "
    "dramatic rim-light, ultra-detailed skin pores, volumetric fog, 4k render"
)
negative_prompt = (
    "anime sketch, cartoon, low poly, doll face, plastic skin, "
    "duplicate eyes, extra limbs, distorted anatomy, lens flare overuse, "
    "blurry, low quality, jpeg artifacts, watermark, text, border"
)

image = pipe(
    prompt              = positive_prompt,
    negative_prompt     = negative_prompt,
    width               = 768,
    height              = 768,
    num_inference_steps = 42,
    guidance_scale      = 7.0,
    generator           = torch.Generator(device).manual_seed(20250524)
).images[0]

image.save("ff_nomura_heroine.png")
print("✅  Saved → ff_nomura_heroine.png")
