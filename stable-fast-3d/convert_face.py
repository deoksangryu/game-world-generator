from diffusers import StableDiffusionXLInstructPix2PixPipeline
import torch, os
from PIL import Image

pipe = StableDiffusionXLInstructPix2PixPipeline.from_pretrained(
        "diffusers/sdxl-instructpix2pix-768",
        torch_dtype=torch.float16
).to("mps")            # Mac Silicon

img   = Image.open("face_001.png")
prompt_pos = ("same identity, mouth wide open, jaw dropped, AH viseme, "
              "upper teeth visible, studio lighting")
prompt_neg = ("closed mouth, round O shape, blurry, watermark")

out = pipe(
    image            = img,
    prompt           = prompt_pos,
    negative_prompt  = prompt_neg,
    num_inference_steps = 25,
    guidance_scale      = 5.0,
    generator           = torch.Generator("cpu").manual_seed(1234)
).images[0]

out.save("face_A_viseme.png")
