import torch, cv2, json, numpy as np
from PIL import Image, ImageDraw, ImageOps
from diffusers import (
    StableDiffusionControlNetPipeline,
    ControlNetModel,
    AutoencoderKL,
)
from diffusers.utils import load_image

device = "mps"                           # GPU(MPS)·CUDA·CPU 자동 변경 가능
DTYPE  = torch.float16                   # 또는 bfloat16

def make_openpose_control(save_path="pose.png",
                          joints=None,
                          bones=None,
                          res=1024):
    """ joints: {id:[x,y]}, bones:[[id,id] ...]   (0~1 정규화 좌표) """
    if joints is None:
        # 전신 정면 – 13본 기본 템플릿
        joints = {
            0:[.5,.08],  1:[.5,.20],  8:[.5,.52],  # head, neck, pelvis
            2:[.32,.20], 3:[.25,.35], 4:[.20,.5],  # L arm
            5:[.68,.20], 6:[.75,.35], 7:[.80,.5],  # R arm
            9:[.39,.70],10:[.36,.93],             # L leg
           11:[.61,.70],12:[.64,.93],             # R leg
        }
        bones = [
            [0,1],[1,8],                 # spine
            [1,2],[2,3],[3,4],           # L arm
            [1,5],[5,6],[6,7],           # R arm
            [8,9],[9,10],                # L leg
            [8,11],[11,12],              # R leg
        ]
    img = np.zeros((res,res,3), np.uint8)
    GREEN, BLUE = (0,255,0), (255,0,0)
    
    # draw bones
    for a,b in bones:
        ax,ay = int(joints[a][0]*res), int(joints[a][1]*res)
        bx,by = int(joints[b][0]*res), int(joints[b][1]*res)
        cv2.line(img,(ax,ay),(bx,by), BLUE, 6)
    # draw joints
    for _,(x,y) in joints.items():
        cv2.circle(img,(int(x*res),int(y*res)), 12, GREEN, -1)
    
    cv2.imwrite(save_path, img)
    print("openpose control saved ➜", save_path)
    return joints, bones

joints, bones = make_openpose_control("pose.png")

import torch
from diffusers.utils import load_image
from diffusers import FluxControlNetPipeline, FluxControlNetModel

base_model = 'black-forest-labs/FLUX.1-dev'
controlnet_model_union = 'Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0'

controlnet = FluxControlNetModel.from_pretrained(controlnet_model_union, torch_dtype=torch.bfloat16)
pipe = FluxControlNetPipeline.from_pretrained(base_model, controlnet=controlnet, torch_dtype=torch.bfloat16)
pipe.to("mps")

# replace with other conds
control_image = load_image("pose.png")
width, height = control_image.size


positive = (
    "full body concept art of a medieval npc villager, neutral pose, "
    "movie concept, 8k, sharp focus, highly detailed texture, "
    "front view, transparent background"
)
negative = "text, watermark, blurry, duplicate limbs, bad anatomy"

sprite = pipe(
    prompt=positive,
    negative_prompt=negative,
    control_image=control_image,
    width=width,
    height=height,
    controlnet_conditioning_scale=0.7,
    control_guidance_end=0.8,
    num_inference_steps=30, 
    guidance_scale=3.5,
    generator=torch.Generator(device="mps").manual_seed(42),
).images[0]

sprite.save("npc_sprite.png")
print("sprite saved ➜ npc_sprite.png")

def sprite_to_binary_mask(sprite_path="npc_sprite.png",
                          mask_path="npc_mask.png",
                          bg_is_dark=True):
    img  = Image.open(sprite_path).convert("RGB")      # RGBA ❌
    gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)

    # 배경이 검정(0)이라면 THRESH_BINARY, 흰색이면 _INV
    thresh_type = cv2.THRESH_BINARY if bg_is_dark else cv2.THRESH_BINARY_INV
    _, bw = cv2.threshold(gray, 20, 255, thresh_type | cv2.THRESH_OTSU)

    Image.fromarray(bw).convert("1").save(mask_path)
    print("binary mask saved →", mask_path)

sprite_to_binary_mask()

def make_rig_mask(mask_path="npc_mask.png",
                  out_path="rig_mask.png",
                  joints=joints,
                  bones=bones,
                  joint_r=10, bone_w=6):
    base = Image.open(mask_path).convert("L")
    w,h  = base.size
    R = base                     # 실루엣 그대로 R
    G = Image.new("L",(w,h),0)
    B = Image.new("L",(w,h),0)
    
    draw_g = ImageDraw.Draw(G)
    draw_b = ImageDraw.Draw(B)
    
    # bones in B-channel
    for a,b in bones:
        ax,ay = int(joints[a][0]*w), int(joints[a][1]*h)
        bx,by = int(joints[b][0]*w), int(joints[b][1]*h)
        draw_b.line([ax,ay,bx,by], fill=255, width=bone_w)
    # joints in G-channel
    for _,(x,y) in joints.items():
        draw_g.ellipse([
            x*w-joint_r, y*h-joint_r,
            x*w+joint_r, y*h+joint_r
        ], fill=255)
    
    Image.merge("RGB",(R,G,B)).save(out_path)
    print("rig mask saved ➜", out_path)

make_rig_mask()
