import os
import json
import argparse
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from rembg import remove

def process_background_removal(input_image):
    """
    Removes the background from a PIL Image object using rembg.
    
    Args:
        input_image (PIL.Image.Image): The input image (e.g., with a solid black background).
        
    Returns:
        PIL.Image.Image: The image with the background removed (as RGBA).
    """
    print("Transparency requested. Removing black background...")
    try:
        # rembg's remove() function directly accepts a PIL Image object
        # It returns an RGBA image
        output_image = remove(input_image)
        return output_image
    except Exception as e:
        print(f"An error occurred during background removal: {e}")
        # Return the original image if processing fails
        return input_image

def generate_image(prompt_file, theme_file):
    """
    Generates an image based on a prompt file and a theme file using the Gemini API.
    """
    load_dotenv()

    # The genai.Client() will automatically use the GEMINI_API_KEY from the .env file
    try:
        client = genai.Client()
    except Exception as e:
        print("Could not initialize the client. Make sure your GEMINI_API_KEY is set in the .env file.")
        print(f"Error: {e}")
        return

    with open(prompt_file, 'r') as f:
        prompt_data = json.load(f)
        
    with open(theme_file, 'r') as f:
        theme_data = json.load(f)

    # Combine the prompts
    base_prompt = prompt_data.get("llm_prompt", "")
    style_suffix = theme_data.get("base_prompt_suffix", "")
    
    final_prompt = f"{base_prompt} {style_suffix}"
    
    # not using right now
    # asset_type = prompt_data.get("asset_type")
    # if asset_type in ["sprite", "icon"]:
    #     sprite_suffix = theme_data.get("sprite_icon_prompt_suffix", "")
    #     final_prompt = f"{final_prompt} {sprite_suffix}"

    # --- MODIFIED: Check for transparency flag ---
    # Store the flag to use for post-processing
    is_transparent = prompt_data.get("transparent", False)
    if is_transparent:
        # New strategy: ask for a solid black background for rembg
        final_prompt = f"{final_prompt} the image should have a solid black background."
    # --- END MODIFICATION ---

    print(f"Generating image with prompt: \"{final_prompt.strip()}\"")
    
    generation_params = {
        "model": "gemini-2.5-flash-image", # Updated to a valid model
        "contents": [final_prompt.strip()],
    }
    
    if "aspect_ratio" in prompt_data:
        generation_params["config"] = types.GenerateContentConfig(
            image_config=types.ImageConfig(
                aspect_ratio=prompt_data["aspect_ratio"],
            )
        )

    try:
        response = client.models.generate_content(**generation_params)

        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            image_part = None
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    image_part = part
                    break
            
            if image_part:
                image = Image.open(BytesIO(image_part.inline_data.data))
                
                # The resize and transparency logic has been disabled as per the new strategy.
                # The values are kept in the prompt files for potential future use.

                # # Check for and apply resizing
                # if "resize" in prompt_data:
                #     resize_dims = (prompt_data["resize"]["width"], prompt_data["resize"]["height"])
                #     print(f"Resizing image to {resize_dims}...")
                #     image = image.resize(resize_dims, Image.Resampling.LANCZOS)
                
                # --- NEW: Post-process for transparency ---
                if is_transparent:
                    image = process_background_removal(image)
                # --- END NEW LOGIC ---

                output_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'assets')
                if not os.path.exists(output_dir):
                    os.makedirs(output_dir)
                    
                # --- MODIFIED: Determine output format ---
                output_format = prompt_data["output_format"]
                if is_transparent:
                    output_format = "png"  # Force PNG for transparency
                
                file_name = f'{prompt_data["asset_name"]}.{output_format}'
                output_path = os.path.join(output_dir, file_name)

                # --- MODIFIED: Save image with correct mode ---
                if output_format == "png":
                    # Ensure RGBA mode if we are saving as PNG
                    # (rembg already returns RGBA, but this is a good safeguard)
                    if image.mode != "RGBA":
                         image = image.convert("RGBA")
                    image.save(output_path, "PNG")
                else:
                    # For other formats like JPG, convert to RGB
                    if image.mode == 'RGBA':
                        image = image.convert('RGB')
                    image.save(output_path) # Let PIL handle format based on extension
                # --- END MODIFICATION ---
                
                print(f"Image successfully generated and saved to {output_path}")
            else:
                print("Image generation failed: No image data found in the response.")
        else:
            print("Image generation failed: The response did not contain valid candidate data.")
            print("Full response:", response)

    except Exception as e:
        print(f"An error occurred during image generation: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate game assets using AI.")
    parser.add_argument("path", type=str, help="Path to a single JSON prompt file or a directory of prompt files.")
    parser.add_argument("--theme", type=str, default="asset-generation/themes/default.json", help="Path to the JSON theme file.")
    args = parser.parse_args()

    if os.path.isdir(args.path):
        print(f"Generating all assets from directory: {args.path}")
        for filename in sorted(os.listdir(args.path)):
            if filename.endswith(".json"):
                prompt_file_path = os.path.join(args.path, filename)
                print(f"\n--- Processing: {prompt_file_path} ---")
                generate_image(prompt_file_path, args.theme)
    elif os.path.isfile(args.path):
        generate_image(args.path, args.theme)
    else:
        print(f"Error: The path '{args.path}' is not a valid file or directory.")