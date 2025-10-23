import os
import json
import argparse
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image, ImageFilter
from io import BytesIO
from rembg import remove

def process_background_removal(input_image):
    """
    Removes the background from a PIL Image object using rembg.
    """
    print("Transparency requested. Removing background...")
    try:
        output_image = remove(input_image)
        return output_image
    except Exception as e:
        print(f"An error occurred during background removal: {e}")
        return input_image

def generate_image(prompt_file, theme_file):
    """
    Generates an image based on a prompt file and a theme file using the Gemini API.
    """
    load_dotenv()

    try:
        # The genai.Client() will automatically use the GEMINI_API_KEY from the .env file
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
    asset_type = prompt_data.get("asset_type")

    # Build a more detailed prompt
    style_modifiers = theme_data.get("style_modifiers", {})
    global_modifiers = style_modifiers.get("global", "")
    asset_specific_modifiers = style_modifiers.get(asset_type, "")
    
    final_prompt = f"{base_prompt}, {style_suffix}. {global_modifiers}. {asset_specific_modifiers}."

    size_hint = prompt_data.get("size_hint")
    if size_hint == "small":
        final_prompt += " The asset needs to be extremely clear and readable when viewed at a very small size, as an icon."
    elif size_hint == "medium":
        final_prompt += " The asset should have a good level of detail, suitable for a medium-sized sprite or tile."
    
    is_transparent = prompt_data.get("transparent", False)
    if is_transparent:
        # Ask for a solid, unnatural background color for easy removal
        final_prompt = f"{final_prompt} The image should have a solid, pure green background that can be easily removed."

    negative_prompt = theme_data.get("negative_prompt", "")
    if negative_prompt:
        final_prompt = f"{final_prompt} --no {negative_prompt}"

    print(f"Generating image with prompt: \"{final_prompt.strip()}\"")
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-image-preview',
            contents=[final_prompt.strip()],
        )

        image = None
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    image_data = part.inline_data.data
                    image = Image.open(BytesIO(image_data))
                    break
        
        if image:
            if is_transparent:
                image = process_background_removal(image)

            output_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'assets')
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                
            output_format = prompt_data.get("output_format", "png")
            if is_transparent:
                output_format = "png"
            
            file_name = f'{prompt_data["asset_name"]}.{output_format}'
            output_path = os.path.join(output_dir, file_name)

            if output_format == "png":
                if image.mode != "RGBA":
                     image = image.convert("RGBA")
                image.save(output_path, "PNG")
            else:
                if image.mode == 'RGBA':
                    image = image.convert('RGB')
                image.save(output_path)
            
            print(f"Image successfully generated and saved to {output_path}")
        else:
            print("Image generation failed: No image data found in the response.")
            print("Full response:", response)

    except Exception as e:
        print(f"An error occurred during image generation: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate game assets using AI.")
    parser.add_argument("path", type=str, help="Path to a single JSON prompt file or a directory of prompt files.")
    parser.add_argument("--theme", type=str, default="asset-generation/themes/vibrant.json", help="Path to the JSON theme file.")
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