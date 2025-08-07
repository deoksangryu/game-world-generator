import torch
from diffusers.utils import load_image
from diffusers import FluxControlNetPipeline, FluxControlNetModel

base_model = 'black-forest-labs/FLUX.1-dev'
controlnet_model_union = 'Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0'

controlnet = FluxControlNetModel.from_pretrained(controlnet_model_union, torch_dtype=torch.bfloat16)
pipe = FluxControlNetPipeline.from_pretrained(base_model, controlnet=controlnet, torch_dtype=torch.bfloat16)
pipe.to("mps")

# replace with other conds
control_image = load_image("s_01.png")
width, height = control_image.size

prompt = (
    """ultra-realistic portrait photo of a young woman, facing camera,
     natural skin texture, cinematic soft key light, glossy catchlights in eyes,
     85 mm lens depth of field,
     8k detail, sharp focus"""
)

negative_prompt = (
    "blurry, low resolution, flat cell shading, harsh outlines, saturated neon, "
    "duplicate facial parts, watermark, text, frame, background gradient, white border"
)



image = pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    control_image=control_image,
    width=width,
    height=height,
    controlnet_conditioning_scale=0.7,
    control_guidance_end=0.8,
    num_inference_steps=30, 
    guidance_scale=3.5,
    generator=torch.Generator(device="mps").manual_seed(42),
).images[0]

image.save("girl_face_01.png")
