import os
import io
import tempfile
import shutil
import uuid
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import torch
from PIL import Image
import rembg
from contextlib import nullcontext

from sf3d.system import SF3D
from sf3d.utils import get_device, remove_background, resize_foreground

app = FastAPI(title="Stable Fast 3D API")

# Global variables
model = None
rembg_session = None
device = get_device()
output_dir = "output/"
os.makedirs(output_dir, exist_ok=True)

# Create a directory for temporary uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    global model, rembg_session, device
    
    print("Device used:", device)
    
    # Load model
    model = SF3D.from_pretrained(
        "stabilityai/stable-fast-3d",
        config_name="config.yaml",
        weight_name="model.safetensors",
    )
    model.to(device)
    model.eval()
    
    # Initialize rembg session
    rembg_session = rembg.new_session()
    
    print("Model loaded successfully")

@app.get("/", response_class=HTMLResponse)
async def get_home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Stable Fast 3D Server</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            h1 {
                color: #333;
            }
            form {
                background-color: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 10px;
                font-weight: bold;
            }
            input, select {
                margin-bottom: 15px;
                padding: 8px;
            }
            button {
                background-color: #4CAF50;
                color: white;
                padding: 10px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: #45a049;
            }
        </style>
    </head>
    <body>
        <h1>Stable Fast 3D Server</h1>
        <form action="/process/" method="post" enctype="multipart/form-data">
            <label for="image">Upload Image:</label>
            <input type="file" name="image" accept="image/*" required><br>
            
            <label for="foreground_ratio">Foreground Ratio:</label>
            <input type="number" name="foreground_ratio" min="0.1" max="1.0" step="0.05" value="0.85"><br>
            
            <label for="texture_resolution">Texture Resolution:</label>
            <input type="number" name="texture_resolution" min="256" max="2048" step="256" value="1024"><br>
            
            <label for="remesh_option">Remesh Option:</label>
            <select name="remesh_option">
                <option value="none">None</option>
                <option value="triangle">Triangle</option>
                <option value="quad">Quad</option>
            </select><br>
            
            <label for="target_vertex_count">Target Vertex Count:</label>
            <input type="number" name="target_vertex_count" value="-1"><br>
            
            <button type="submit">Generate 3D Model</button>
        </form>
    </body>
    </html>
    """

@app.post("/process/")
async def process_image(
    image: UploadFile = File(...),
    foreground_ratio: float = Form(0.85),
    texture_resolution: int = Form(1024),
    remesh_option: str = Form("none"),
    target_vertex_count: int = Form(-1)
):
    if not image.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="Only PNG, JPG, and JPEG files are supported")
    
    # Create a unique directory for this request
    job_id = str(uuid.uuid4())
    job_output_dir = os.path.join(output_dir, job_id)
    os.makedirs(job_output_dir, exist_ok=True)
    
    # Save uploaded file to a temporary location
    content = await image.read()
    img = Image.open(io.BytesIO(content)).convert("RGBA")
    
    # Remove background and resize
    img = remove_background(img, rembg_session)
    img = resize_foreground(img, foreground_ratio)
    
    # Save processed input image
    img.save(os.path.join(job_output_dir, "input.png"))
    
    try:
        # Process with the model
        with torch.no_grad():
            with torch.autocast(device_type=device, dtype=torch.bfloat16) if "cuda" in device else nullcontext():
                mesh, _ = model.run_image(
                    [img],
                    bake_resolution=texture_resolution,
                    remesh=remesh_option,
                    vertex_count=target_vertex_count,
                )
        
        if torch.cuda.is_available():
            print("Peak Memory:", torch.cuda.max_memory_allocated() / 1024 / 1024, "MB")
        elif torch.backends.mps.is_available():
            print("Peak Memory:", torch.mps.driver_allocated_memory() / 1024 / 1024, "MB")

        # Save the mesh
        out_mesh_path = os.path.join(job_output_dir, "mesh.glb")
        mesh[0].export(out_mesh_path, include_normals=True)
        
        # Return the mesh file
        return FileResponse(
            out_mesh_path, 
            filename=f"mesh-{job_id}.glb",
            media_type="model/gltf-binary"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("run_server:app", host="0.0.0.0", port=8000, reload=True) 