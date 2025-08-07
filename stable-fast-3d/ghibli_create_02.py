# ghibli_flux_run.py
import torch
from diffusers import FluxPipeline

# 1) 실행 장치 설정 ─ mac(MPS), NVIDIA(CUDA), CPU 자동 인식
device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)
dtype = torch.bfloat16 if device != "cpu" else torch.float32   # FLUX 권장

# 2) FLUX 기본 파이프라인 로드 (FluxPipeline!)
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=dtype
).to(device)

# 3) Ghibli LoRA 삽입  (PEFT 없이 diffusers 백엔드 사용)
pipe.load_lora_weights(
    "openfree/flux-chatgpt-ghibli-lora",
    weight_name="flux-chatgpt-ghibli-lora.safetensors",
    adapter_name="ghibli",
    backend="diffusers"
)
pipe.fuse_lora(adapter_name="ghibli")   # VRAM•속도 최적화

# 4) 프롬프트
positive_prompt = (
    """ghibli style, sexy, facing camera,
    front view portrait, shoulder-up framing, flowing silver-gold hair, 
    ornate feather-patterned shoulder armor, dreamy watercolor wash,
    fine ink outline, soft pastel palette, high-resolution illustration"""
)
negative_prompt = (
    "photorealistic, cg render, 3d, plastic, cell shading, "
    "extra wings, extra limbs, multiple pupils, stray lines, particles, dust, "
    "blurry, low quality, jpeg artifacts, watermark, text, border, frame"
)

# 5) 이미지 생성
image = pipe(
    prompt=positive_prompt,
    negative_prompt=negative_prompt,
    height=768,
    width=768,
    guidance_scale=7.0,          # 텍스트 반영 강도
    num_inference_steps=40,      # 35-50 권장
    generator=torch.Generator(device).manual_seed(20240524)
).images[0]

image.save("magical_princess_color.png")
print("✅  Saved → magical_princess_color.png")
