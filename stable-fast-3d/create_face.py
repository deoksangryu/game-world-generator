import torch
from diffusers.utils import load_image
from diffusers import FluxControlNetPipeline, FluxControlNetModel

base_model = 'black-forest-labs/FLUX.1-dev'
controlnet_model_union = 'Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0'

controlnet = FluxControlNetModel.from_pretrained(controlnet_model_union, torch_dtype=torch.bfloat16)
pipe = FluxControlNetPipeline.from_pretrained(base_model, controlnet=controlnet, torch_dtype=torch.bfloat16)
pipe.to("mps")

# replace with other conds
control_image = load_image("face_001.png")
width, height = control_image.size

prompt = """
Ultra-realistic portrait of the same person in the control image,
mouth open in a relaxed oval shape forming the Korean vowel ‘아’ (viseme AH),
upper and lower teeth just visible, soft neutral expression in the eyes,
studio key-light from 45°, subtle rim light, shallow depth of field,
high-detail skin texture, 8-k resolution, cinematic color grading
"""

negative_prompt = (
    "closed mouth, lips together, shouting expression, wide-angle warp, "
    "cross-eyes, extra facial features, distorted anatomy, blurry, lowres, watermark, text"
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

image.save("sword_image.png")
