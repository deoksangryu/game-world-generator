# from diffusers import StableDiffusionPipeline
# import torch

# model_id = "nitrosocke/Ghibli-Diffusion"
# pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)
# pipe = pipe.to("mps")

from diffusers import AutoPipelineForText2Image
import torch

pipeline = AutoPipelineForText2Image.from_pretrained('black-forest-labs/FLUX.1-dev', torch_dtype=torch.bfloat16).to('cuda')
pipeline.load_lora_weights('openfree/flux-chatgpt-ghibli-lora', weight_name='flux-chatgpt-ghibli-lora.safetensors')

positive_prompt = (
    "studio ghibli style, portrait of a beautiful golden-haired princess, "
    "front view, looking at viewer, shoulders-up framing, soft watercolor shading, "
    "delicate line work, clean line work, high-resolution illustration, no wings, smooth clear skin"
)

negative_prompt = (
    "extra wings, extra limbs, duplicate facial features, multiple eyebrows, "
    "mutated body, deformed anatomy, poorly drawn face, bad proportions, "
    "blurry, low quality, jpeg artifacts, text, watermark, border, frame, "
    "stray lines, sketch lines, scribbles, particles, speckles, dust, freckles, acne"
)

image = pipeline(prompt=positive_prompt, negative_prompt=negative_prompt).images[0]

image.save("./magical_princess.png")