#!/usr/bin/env python3
"""Generate game assets using Gemini image generation (Nano Banana Pro)."""

import os
import sys
import time
from google import genai
from google.genai import types
from PIL import Image

API_KEY = os.environ.get("GEMINI_API_KEY") or "AIzaSyCKiYd4fPB-zkXKSTORIomojp5lFXTtA9g"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"


def generate_image(prompt: str, filename: str, aspect_ratio: str = "16:9", size: str = "1K"):
    """Generate a single image and save it."""
    print(f"\n{'='*60}")
    print(f"Generating: {filename}")
    print(f"Aspect: {aspect_ratio} | Size: {size}")
    print(f"Prompt: {prompt[:100]}...")
    print(f"{'='*60}")

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio,
                    image_size=size,
                ),
            ),
        )

        for part in response.parts:
            if part.inline_data:
                # Save as JPEG first (Gemini's native format), then convert to PNG
                img = part.as_image()
                filepath = os.path.join(OUTPUT_DIR, filename)
                # part.as_image() returns a PIL Image, save directly
                temp_path = filepath.replace(".png", ".jpg")
                img.save(temp_path)
                # Convert to PNG
                pil_img = Image.open(temp_path)
                pil_img.save(filepath, "PNG")
                os.remove(temp_path)
                print(f"  Saved: {filepath}")
                return True
            elif part.text:
                print(f"  Text response: {part.text[:200]}")

        print(f"  WARNING: No image returned for {filename}")
        return False

    except Exception as e:
        print(f"  ERROR generating {filename}: {e}")
        return False


# ============================================================
# ASSET DEFINITIONS
# ============================================================

assets = [
    # 1. Hero background - dramatic cinematic aviation scene
    {
        "prompt": (
            "Cinematic wide-angle photograph of a commercial airport runway at dusk, "
            "dramatic orange and deep blue sky with volumetric clouds. A single-engine aircraft "
            "on final approach, landing lights blazing, captured from a low ground-level angle. "
            "Runway edge lights glowing cyan and white stretching into the distance. "
            "Air traffic control tower silhouetted against the sky. "
            "Photorealistic, moody atmosphere, 24mm wide-angle lens, golden hour lighting. "
            "Dark cinematic color grading with cyan and orange tones. No text or UI elements."
        ),
        "filename": "hero-bg.png",
        "aspect_ratio": "16:9",
        "size": "2K",
    },

    # 2. Scenario: Clear Day Landing
    {
        "prompt": (
            "Aerial photograph from cockpit view of a small aircraft approaching a runway "
            "on a perfectly clear sunny day. Blue sky with scattered cumulus clouds, "
            "green countryside below, long concrete runway ahead with white markings visible. "
            "Bright, optimistic lighting. Clean, professional aviation photography style. "
            "Photorealistic, 35mm lens. No text or HUD elements."
        ),
        "filename": "scenario-clear-day.png",
        "aspect_ratio": "16:9",
        "size": "1K",
    },

    # 3. Scenario: Night Approach
    {
        "prompt": (
            "Dramatic cockpit view photograph of a night landing approach. "
            "Dark sky with stars visible, runway approach lights forming a bright corridor "
            "of white and red lights leading to the illuminated runway. "
            "City lights twinkling in the distance. Instrument panel faintly glowing. "
            "Moody, atmospheric, slightly tense feeling. "
            "Photorealistic, cinematic color grading with deep blues and warm runway light glow. "
            "No text or UI overlays."
        ),
        "filename": "scenario-night.png",
        "aspect_ratio": "16:9",
        "size": "1K",
    },

    # 4. Scenario: Crosswind Landing
    {
        "prompt": (
            "Dramatic side-view photograph of a small aircraft crabbing into a strong crosswind "
            "on approach to a runway. Visible wind effects - wind sock fully extended, "
            "trees bending, scattered clouds moving fast. Overcast dramatic sky. "
            "The aircraft is slightly banked, nose pointed off-runway heading. "
            "Tense, challenging atmosphere. Professional aviation photography. "
            "Photorealistic, action shot feel. No text."
        ),
        "filename": "scenario-crosswind.png",
        "aspect_ratio": "16:9",
        "size": "1K",
    },

    # 5. Scenario: Emergency Landing
    {
        "prompt": (
            "Dramatic photograph of a single-engine aircraft with one engine trailing "
            "thin smoke, gliding with no power over countryside toward a distant runway. "
            "Tense, emergency atmosphere. Slightly desaturated colors except for warning red accents. "
            "Dramatic clouds, late afternoon light casting long shadows. "
            "Shot from slightly below the aircraft. Cinematic, intense feeling. "
            "Photorealistic, high contrast. No text or UI elements."
        ),
        "filename": "scenario-emergency.png",
        "aspect_ratio": "16:9",
        "size": "1K",
    },

    # 6. Logo / Title card
    {
        "prompt": (
            'Design a sleek, modern game logo: the word "MAYDAY" in bold, '
            "angular, futuristic sans-serif typography. The letters should have a "
            "metallic silver and cyan color scheme with subtle glowing cyan edges. "
            "Below in smaller text: 'FLIGHT SIMULATOR'. "
            "Dark background (near black). Clean, minimal, high-tech aviation aesthetic. "
            "Slight radar sweep or HUD grid pattern behind the text. "
            "Professional game branding quality. Sharp and crisp."
        ),
        "filename": "logo.png",
        "aspect_ratio": "3:2",
        "size": "1K",
    },

    # 7. ATC / Radio panel background
    {
        "prompt": (
            "Close-up photograph of vintage air traffic control radar screen and radio equipment. "
            "Green phosphor CRT display with radar sweeps and blips. "
            "Analog switches, frequency dials, and microphone. "
            "Moody, dark environment lit only by instrument glow. "
            "Cinematic shallow depth of field, slight film grain. "
            "Dark teal and green color palette. Atmospheric and immersive. "
            "Photorealistic, no text overlays."
        ),
        "filename": "atc-panel-bg.png",
        "aspect_ratio": "4:3",
        "size": "1K",
    },

    # 8. Cockpit dashboard texture
    {
        "prompt": (
            "Top-down close-up of an aircraft instrument panel / cockpit dashboard. "
            "Attitude indicator, altimeter, airspeed indicator, heading indicator, "
            "vertical speed indicator, and throttle quadrant visible. "
            "Backlit instruments glowing softly in a dim cockpit. "
            "Professional, realistic avionics. Dark background with warm instrument lighting. "
            "Photorealistic detail, 50mm macro lens feel. No text overlays."
        ),
        "filename": "cockpit-instruments.png",
        "aspect_ratio": "16:9",
        "size": "1K",
    },
]


def main():
    print(f"Generating {len(assets)} assets using Gemini ({MODEL})...")
    print(f"Output directory: {OUTPUT_DIR}\n")

    results = []
    for i, asset in enumerate(assets):
        print(f"\n[{i+1}/{len(assets)}]")
        success = generate_image(
            prompt=asset["prompt"],
            filename=asset["filename"],
            aspect_ratio=asset["aspect_ratio"],
            size=asset.get("size", "1K"),
        )
        results.append((asset["filename"], success))

        # Small delay to avoid rate limiting
        if i < len(assets) - 1:
            time.sleep(2)

    print(f"\n\n{'='*60}")
    print("GENERATION SUMMARY")
    print(f"{'='*60}")
    for filename, success in results:
        status = "OK" if success else "FAILED"
        print(f"  [{status}] {filename}")

    succeeded = sum(1 for _, s in results if s)
    print(f"\n{succeeded}/{len(results)} images generated successfully.")


if __name__ == "__main__":
    main()
