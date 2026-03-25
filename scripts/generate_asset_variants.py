from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
VARIANTS = ASSETS / "variants"

PRIMARY = "#71BF44"
PRIMARY_DARK = "#2F6D21"
LIGHT_BG = "#F3F4F6"
WHITE = "#FFFFFF"
BLACK = "#000000"

FILES = [
    "icon.png",
    "favicon.png",
    "splash-icon.png",
    "android-icon-background.png",
    "android-icon-foreground.png",
    "android-icon-monochrome.png",
]


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_minimal_icon(size: int, bg: str, fg: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)

    pad = int(size * 0.13)
    rounded_rect(d, [pad, pad, size - pad, size - pad], int(size * 0.20), fill=fg)

    # Centered check mark (minimal variant, no letter)
    p1 = (int(size * 0.38), int(size * 0.54))
    p2 = (int(size * 0.48), int(size * 0.64))
    p3 = (int(size * 0.66), int(size * 0.45))
    d.line([p1, p2], fill=WHITE, width=max(8, int(size * 0.035)))
    d.line([p2, p3], fill=WHITE, width=max(8, int(size * 0.035)))

    return img


def make_corporate_icon(size: int, bg: str, primary: str, dark: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)

    pad = int(size * 0.12)
    rounded_rect(d, [pad, pad, size - pad, size - pad], int(size * 0.22), fill=primary)

    inner = int(size * 0.08)
    rounded_rect(
        d,
        [pad + inner, pad + inner, size - pad - inner, size - pad - inner],
        int(size * 0.15),
        outline=WHITE,
        width=max(6, int(size * 0.014)),
    )

    # Small dark dot + white check to look more corporate
    cx, cy = int(size * 0.68), int(size * 0.68)
    r = int(size * 0.08)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dark)
    d.line(
        [(int(size * 0.64), int(size * 0.68)), (int(size * 0.68), int(size * 0.72))],
        fill=WHITE,
        width=max(6, int(size * 0.018)),
    )
    d.line(
        [(int(size * 0.68), int(size * 0.72)), (int(size * 0.75), int(size * 0.64))],
        fill=WHITE,
        width=max(6, int(size * 0.018)),
    )

    return img


def make_android_background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), "#EAF4E5")
    d = ImageDraw.Draw(img)
    step = int(size * 0.10)
    dot = int(size * 0.006)
    for y in range(step, size, step):
        for x in range(step, size, step):
            d.ellipse([x - dot, y - dot, x + dot, y + dot], fill="#C8E2BD")
    return img


def save_set(base: Path, style: str):
    base.mkdir(parents=True, exist_ok=True)

    if style == "minimal":
        icon = make_minimal_icon(1024, LIGHT_BG, PRIMARY)
        splash = make_minimal_icon(1024, WHITE, PRIMARY)
        favicon = make_minimal_icon(256, LIGHT_BG, PRIMARY_DARK)
        fg = make_minimal_icon(1024, (0, 0, 0, 0), PRIMARY)
        mono = make_minimal_icon(1024, (0, 0, 0, 0), BLACK)
    else:
        icon = make_corporate_icon(1024, LIGHT_BG, PRIMARY, PRIMARY_DARK)
        splash = make_corporate_icon(1024, WHITE, PRIMARY, PRIMARY_DARK)
        favicon = make_corporate_icon(256, LIGHT_BG, PRIMARY_DARK, BLACK)
        fg = make_corporate_icon(1024, (0, 0, 0, 0), PRIMARY, PRIMARY_DARK)
        mono = make_corporate_icon(1024, (0, 0, 0, 0), BLACK, BLACK)

    bg = make_android_background(1024)

    icon.save(base / "icon.png", format="PNG")
    splash.save(base / "splash-icon.png", format="PNG")
    favicon.save(base / "favicon.png", format="PNG")
    bg.save(base / "android-icon-background.png", format="PNG")
    fg.save(base / "android-icon-foreground.png", format="PNG")
    mono.save(base / "android-icon-monochrome.png", format="PNG")


def copy_variant_to_active(variant_dir: Path):
    for name in FILES:
        source = variant_dir / name
        target = ASSETS / name
        target.write_bytes(source.read_bytes())


def main():
    minimal_dir = VARIANTS / "minimal"
    corporate_dir = VARIANTS / "corporate"

    save_set(minimal_dir, "minimal")
    save_set(corporate_dir, "corporate")

    # Activate the cleaner minimal style by default.
    copy_variant_to_active(minimal_dir)

    print("Generated variants:")
    print("-", minimal_dir)
    print("-", corporate_dir)
    print("Activated:", minimal_dir)


if __name__ == "__main__":
    main()
