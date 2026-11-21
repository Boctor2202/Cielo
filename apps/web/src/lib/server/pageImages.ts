import sharp from "sharp";

/** The largest image side the model reads at full detail; anything larger is scaled down by the API anyway. */
const MAX_SIDE = 2576;

export type ImageBlock =
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }
  | { type: "text"; text: string };

const jpeg = async (img: ReturnType<typeof sharp>) =>
  (await img.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()).toString("base64");

/**
 * Photos of logbook pages, made readable: turned upright (EXIF), and a two-page spread photographed in landscape
 * split into its left and right halves (slightly overlapping), each sent at the model's full resolution. A
 * spread has some twenty handwritten columns: scaled down whole, each column would be a few dozen pixels wide.
 */
export async function pageImages(images: { data: string; type: string }[]): Promise<ImageBlock[]> {
  const out: ImageBlock[] = [];
  for (const [n, im] of images.entries()) {
    const label = `Photo ${n + 1} of ${images.length}`;
    try {
      const upright = await sharp(Buffer.from(im.data, "base64")).rotate().toBuffer();
      const { width = 0, height = 0 } = await sharp(upright).metadata();
      if (width > height * 1.15 && width > MAX_SIDE) {
        const half = Math.round(width * 0.53);
        out.push({ type: "text", text: `${label}: a page spread, sent as two crops. Left half:` });
        out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await jpeg(sharp(upright).extract({ left: 0, top: 0, width: half, height })) } });
        out.push({ type: "text", text: `${label}, right half (it overlaps the left half a little; the rows at the same height are the same flights):` });
        out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await jpeg(sharp(upright).extract({ left: width - half, top: 0, width: half, height })) } });
      } else {
        out.push({ type: "text", text: `${label}:` });
        out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await jpeg(sharp(upright)) } });
      }
    } catch {
      // not an image sharp can read: sent as it came
      out.push({ type: "text", text: `${label}:` });
      out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: im.data } });
    }
  }
  return out;
}
