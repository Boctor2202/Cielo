/**
 * A minimal GRIB2 reader for one field of NOAA's GFS on a regular latitude/longitude grid (grid template 3.0)
 * packed with complex packing and spatial differencing (data template 5.3), the encoding of the 1° GFS files.
 * Enough for winds and temperatures aloft; anything else is refused.
 */
export interface GribField {
  ni: number;
  nj: number;
  /** first grid point and increments, degrees; scanning west → east, north → south */
  la1: number;
  lo1: number;
  di: number;
  dj: number;
  values: Float64Array;
}

class Bits {
  private pos = 0;
  constructor(private b: Uint8Array, private start: number) {}
  read(n: number): number {
    let v = 0;
    for (let k = 0; k < n; k++) {
      const p = this.start * 8 + this.pos++;
      v = v * 2 + ((this.b[p >> 3]! >> (7 - (p & 7))) & 1);
    }
    return v;
  }
  /** next whole byte */
  align() {
    this.pos = Math.ceil(this.pos / 8) * 8;
  }
}

const u32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u16 = (b: Uint8Array, i: number) => (b[i]! << 8) + b[i + 1]!;
/** GRIB "sign and magnitude" integers */
const s16 = (b: Uint8Array, i: number) => (b[i]! & 0x80 ? -1 : 1) * (((b[i]! & 0x7f) << 8) + b[i + 1]!);
const s32 = (b: Uint8Array, i: number) => (b[i]! & 0x80 ? -1 : 1) * ((b[i]! & 0x7f) * 2 ** 24 + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!);
const smag = (v: number, bits: number) => (v >= 2 ** (bits - 1) ? -(v - 2 ** (bits - 1)) : v);

export function readGrib2(buf: Uint8Array): GribField {
  if (String.fromCharCode(...buf.subarray(0, 4)) !== "GRIB" || buf[7] !== 2) throw new Error("not GRIB2");
  let i = 16;
  let grid: Omit<GribField, "values"> | null = null;
  let s5 = -1;
  let s7 = -1;
  let n = 0;
  while (i < buf.length - 4) {
    if (buf[i] === 0x37 && buf[i + 1] === 0x37 && buf[i + 2] === 0x37 && buf[i + 3] === 0x37) break;
    const len = u32(buf, i);
    const sec = buf[i + 4];
    if (sec === 3) {
      if (u16(buf, i + 12) !== 0) throw new Error("grid template not supported");
      const ni = u32(buf, i + 30);
      const nj = u32(buf, i + 34);
      const la1 = s32(buf, i + 46) / 1e6;
      const lo1 = s32(buf, i + 50) / 1e6;
      const di = u32(buf, i + 63) / 1e6;
      const dj = u32(buf, i + 67) / 1e6;
      if (buf[i + 71] !== 0) throw new Error("scanning mode not supported");
      grid = { ni, nj, la1, lo1, di, dj };
    } else if (sec === 5) {
      if (u16(buf, i + 9) !== 3) throw new Error("data template not supported");
      n = u32(buf, i + 5);
      s5 = i;
    } else if (sec === 6) {
      if (buf[i + 5] !== 255) throw new Error("bitmap not supported");
    } else if (sec === 7) s7 = i;
    i += len;
  }
  if (!grid || s5 < 0 || s7 < 0) throw new Error("incomplete GRIB2 message");

  const b = buf;
  const o = s5; // octet k of the section is at o + k - 1
  const R = new DataView(b.buffer, b.byteOffset + o + 11, 4).getFloat32(0, false);
  const E = s16(b, o + 15);
  const D = s16(b, o + 17);
  const nbits = b[o + 19]!;
  if (b[o + 22] !== 0) throw new Error("missing values not supported");
  const NG = u32(b, o + 31);
  const widthRef = b[o + 35]!;
  const widthBits = b[o + 36]!;
  const lenRef = u32(b, o + 37);
  const lenInc = b[o + 41]!;
  const lastLen = u32(b, o + 42);
  const lenBits = b[o + 46]!;
  const order = b[o + 47]!;
  const extra = b[o + 48]!;

  const r = new Bits(b, s7 + 5);
  // spatial differencing: first values and the overall minimum
  const first: number[] = [];
  for (let k = 0; k < order; k++) first.push(smag(r.read(extra * 8), extra * 8));
  const minsd = smag(r.read(extra * 8), extra * 8);
  const refs = Array.from({ length: NG }, () => r.read(nbits));
  r.align();
  const widths = Array.from({ length: NG }, () => r.read(widthBits) + widthRef);
  r.align();
  const lens = Array.from({ length: NG }, () => r.read(lenBits) * lenInc + lenRef);
  lens[NG - 1] = lastLen;
  r.align();

  const x = new Float64Array(n);
  let k = 0;
  for (let g = 0; g < NG; g++) {
    for (let m = 0; m < lens[g]! && k < n; m++) x[k++] = refs[g]! + (widths[g] ? r.read(widths[g]!) : 0);
  }
  // undo the differencing
  if (order === 1) {
    x[0] = first[0]!;
    for (let j = 1; j < n; j++) x[j] = x[j]! + minsd + x[j - 1]!;
  } else if (order === 2) {
    x[0] = first[0]!;
    x[1] = first[1]!;
    for (let j = 2; j < n; j++) x[j] = x[j]! + minsd + 2 * x[j - 1]! - x[j - 2]!;
  }
  const f2 = 2 ** E;
  const f10 = 10 ** D;
  for (let j = 0; j < n; j++) x[j] = (R + x[j]! * f2) / f10;
  return { ...grid, values: x };
}

/** The field's value at a point, interpolated between the four grid points around it. */
export function gribAt(f: GribField, lat: number, lon: number): number {
  const x = (((lon - f.lo1) % 360) + 360) % 360 / f.di;
  const y = (f.la1 - lat) / f.dj;
  const i0 = Math.floor(x);
  const j0 = Math.max(0, Math.min(f.nj - 2, Math.floor(y)));
  const i1 = (i0 + 1) % f.ni;
  const fx = x - i0;
  const fy = Math.max(0, Math.min(1, y - j0));
  const v = (i: number, j: number) => f.values[j * f.ni + (i % f.ni)]!;
  return v(i0, j0) * (1 - fx) * (1 - fy) + v(i1, j0) * fx * (1 - fy) + v(i0, j0 + 1) * (1 - fx) * fy + v(i1, j0 + 1) * fx * fy;
}
