"""Raw captures with the pilot's own data swapped for a fictional pilot (name, photo, contact, licence, airline)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
INTER = "/usr/share/fonts/opentype/inter/Inter-{}.otf"
def font(weight, size): return ImageFont.truetype(INTER.format(weight), size)

def erase(im, box, left=None, right=None):
    """Paint the box with the background around it (a left-to-right blend of the colours just outside)."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(im)
    for y in range(y0, y1):
        a = im.getpixel(left if left else (x0 - 3, y))
        b = im.getpixel(right if right else (min(x1 + 3, im.width - 1), y))
        for x in range(x0, x1):
            t = (x - x0) / max(1, x1 - x0 - 1)
            d.point((x, y), tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3)))

def text(im, xy, s, weight, size, color):
    ImageDraw.Draw(im).text(xy, s, font=font(weight, size), fill=color)

def cv(src, dst):
    im = Image.open(src).convert("RGB")
    navy = im.getpixel((420, 150))
    grey = (110, 118, 130)
    # header: name, contact line, photo
    erase(im, (50, 160, 300, 206), left=(45, 180), right=(320, 180))
    text(im, (56, 162), "Thomas Mercier", "Bold", 33, (255, 255, 255))
    erase(im, (50, 238, 360, 258), left=(45, 248), right=(380, 248))
    text(im, (56, 240), "thomas.mercier@email.com   ·   +33 6 00 00 00 00   ·   France", "Regular", 12, (226, 232, 240))
    # photo: a fictional pilot (generated portrait), in the white ring of the original
    d = ImageDraw.Draw(im)
    cx, cy, r = 628, 202, 55
    ring = Image.new("L", (r * 16, r * 16), 0)
    ImageDraw.Draw(ring).ellipse((0, 0, r * 16 - 1, r * 16 - 1), fill=255)
    im.paste((255, 255, 255), (cx - r, cy - r, cx + r, cy + r), ring.resize((r * 2, r * 2), Image.LANCZOS))
    inner = r - 4
    face = Image.open(HERE / "portrait.png").convert("RGB").crop((230, 70, 1030, 870)).resize((inner * 2, inner * 2), Image.LANCZOS)
    mask = Image.new("L", (inner * 8, inner * 8), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, inner * 8 - 1, inner * 8 - 1), fill=255)
    im.paste(face, (cx - inner, cy - inner), mask.resize((inner * 2, inner * 2), Image.LANCZOS))
    # licence numbers and footer
    white = (255, 255, 255)
    for box, xy, s in [
        ((66, 1005, 300, 1021), (68, 1006), "DGAC · FRA.FCL.CA00012345 · no expiry"),
        ((393, 1005, 680, 1021), (395, 1006), "DGAC France · FRA.FCL.CA00012345 · valid until 30 Apr"),
        ((66, 1231, 340, 1247), (68, 1232), "DGAC France · FRA.FCL.CA00012345 · valid until 31 Jan"),
    ]:
        erase(im, box, left=(box[0] - 4, box[1] + 8), right=(box[2] + 4, box[1] + 8))
        text(im, xy, s, "Regular", 11, grey)
    erase(im, (54, 1106, 220, 1122), left=(50, 1114), right=(240, 1114))
    text(im, (56, 1107), "Thomas Mercier — Curriculum vitae", "Regular", 10, (120, 126, 136))
    im.save(dst, quality=95)

def logbook(src, dst):
    im = Image.open(src).convert("RGB")
    for k in range(4):
        y = 746 + 184 * k  # middle of the registration chip of row k
        # registration
        erase(im, (255, y - 12, 340, y + 12), left=(251, y), right=(344, y))
        d = ImageDraw.Draw(im)
        text(im, (260, y - 12), "F-HGDN", "SemiBold", 20, (240, 244, 250))
        # flight number (after "times · ")
        f = y + 42
        erase(im, (414, f - 14, 560, f + 14))
        text(im, (417, f - 14), "GDN214 ·...", "Regular", 22, (150, 160, 175))
    im.save(dst, quality=95)

def dashboard(src, dst):
    im = Image.open(src).convert("RGB")
    erase(im, (203, 222, 290, 255))
    ImageDraw.Draw(im).text((206, 247), "Thomas", font=font("Regular", 27), fill=(150, 163, 182), anchor="ls")
    im.save(dst, quality=95)

def radar(src, dst):
    im = Image.open(src).convert("RGB")
    d = ImageDraw.Draw(im)
    f = font("Medium", 24)
    for (x0, x1), reg in zip([(25, 141), (155, 270), (282, 402), (415, 528), (541, 656)], ["F-HGDN", "F-HGDW", "F-HGDX", "D-IGDN", "D-IGDW"]):
        chip = im.getpixel((x0 + 10, 360))
        d.rectangle((x0 + 9, 361, x1 - 9, 391), fill=chip)
        d.text(((x0 + x1) / 2, 384), reg, font=f, fill=(240, 244, 248), anchor="ms")
    im.save(dst, quality=95)

if __name__ == "__main__":
    kind, src, dst = sys.argv[1:4]
    {"cv": cv, "logbook": logbook, "dashboard": dashboard, "radar": radar}[kind](src, dst)
