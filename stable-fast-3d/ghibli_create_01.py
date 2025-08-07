# ghibli_create_02.py
import os, torch
from diffusers import DiffusionPipeline

# -------------------------------------------------
# 1) 디바이스 자동 선택  (M1/M2 → "mps", NVIDIA → "cuda", 그 외 "cpu")
device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)
dtype = torch.float16  # mps·cuda 공통으로 안전

# -------------------------------------------------
# 2) FLUX 기본 모델 로드  (variant 파라미터 삭제!)
base_model = "black-forest-labs/FLUX.1-dev"
pipe = DiffusionPipeline.from_pretrained(
    base_model,
    torch_dtype=dtype,
    # revision="main"  # 굳이 지정할 필요 없음
).to(device)

# -------------------------------------------------
# 3) Ghibli LoRA 가중치 삽입
lora_repo = "openfree/flux-chatgpt-ghibli-lora"
lora_file = "flux-chatgpt-ghibli-lora.safetensors"  # 레포에 실제 존재하는 파일명

pipe.load_lora_weights(lora_repo, weight_name=lora_file)
pipe.fuse_lora()  # LoRA 레이어를 고정 → VRAM↓, 추론속도↑

# -------------------------------------------------
# 4) 프롬프트
positive_prompt = (
    "studio ghibli style, portrait of a beautiful golden-haired princess, "
    "front view, looking at viewer, shoulders-up framing"
)

negative_prompt = (
    "extra wings, extra limbs, duplicate facial features, multiple eyebrows, "
    "multiple pupils, mutated body, deformed anatomy, poorly drawn face, bad proportions, "
    "stray lines, sketch lines, scribbles, particles, speckles, dust, "
    "blurry, low quality, jpeg artifacts, text, watermark, border, frame"
)

# -------------------------------------------------
# 5) 이미지 생성
image = pipe(
    prompt              = positive_prompt,
    width               = 768,
    height              = 768,
    num_inference_steps = 40,
    guidance_scale      = 7.0,
    generator           = torch.Generator(device).manual_seed(20240524)
).images[0]

image.save("magical_princess_clean.png")
print("✅ Saved → magical_princess_clean.png")
