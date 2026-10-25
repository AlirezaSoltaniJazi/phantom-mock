import { describe, expect, it } from 'vitest';
import { createZip, crc32 } from '@/shared/zip';

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

function readU32(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
  );
}

function readU16(bytes: Uint8Array, at: number): number {
  return bytes[at]! | (bytes[at + 1]! << 8);
}

function findEocd(zip: Uint8Array): number {
  for (let i = zip.length - 22; i >= 0; i--) {
    if (readU32(zip, i) === EOCD_SIG) return i;
  }
  throw new Error('no end-of-central-directory record');
}

describe('crc32', () => {
  it('matches the known checksum for a well-known input', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('createZip', () => {
  const now = new Date('2026-09-21T10:30:00Z');

  it('writes a local header, central directory and EOCD for each file', () => {
    const zip = createZip(
      [
        { name: 'a.md', content: '# hello' },
        { name: 'b.md', content: '# world' },
      ],
      now
    );
    expect(readU32(zip, 0)).toBe(LOCAL_SIG);

    const eocd = findEocd(zip);
    expect(readU16(zip, eocd + 8)).toBe(2); // entries on this disk
    expect(readU16(zip, eocd + 10)).toBe(2); // total entries

    const centralOffset = readU32(zip, eocd + 16);
    expect(readU32(zip, centralOffset)).toBe(CENTRAL_SIG);
    expect(readU32(zip, eocd + 12)).toBe(eocd - centralOffset); // central dir size
  });

  it('stores content uncompressed with a matching crc and size', () => {
    const content = '# hello';
    const data = new TextEncoder().encode(content);
    const zip = createZip([{ name: 'a.md', content }], now);

    expect(readU16(zip, 8)).toBe(0); // method 0 = stored
    expect(readU32(zip, 14)).toBe(crc32(data));
    expect(readU32(zip, 18)).toBe(data.length); // compressed size
    expect(readU32(zip, 22)).toBe(data.length); // uncompressed size

    const nameLen = readU16(zip, 26);
    const start = 30 + nameLen;
    expect(new TextDecoder().decode(zip.slice(start, start + data.length))).toBe(content);
  });

  it('encodes names as UTF-8 and flags them as such', () => {
    const zip = createZip([{ name: 'héllo-✓.md', content: 'x' }], now);
    expect(readU16(zip, 6) & 0x0800).toBe(0x0800);
    const nameLen = readU16(zip, 26);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe('héllo-✓.md');
  });

  it('de-duplicates repeated file names so no entry is silently lost', () => {
    const zip = createZip(
      [
        { name: 'same.md', content: 'one' },
        { name: 'same.md', content: 'two' },
        { name: 'same.md', content: 'three' },
      ],
      now
    );
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('same.md');
    expect(text).toContain('same-2.md');
    expect(text).toContain('same-3.md');
    expect(readU16(zip, findEocd(zip) + 10)).toBe(3);
  });

  it('produces a valid empty archive', () => {
    const zip = createZip([], now);
    expect(zip).toHaveLength(22);
    expect(readU32(zip, 0)).toBe(EOCD_SIG);
    expect(readU16(zip, 10)).toBe(0);
  });

  it('clamps pre-1980 timestamps into the DOS date range', () => {
    const zip = createZip([{ name: 'a.md', content: 'x' }], new Date('1970-01-01T00:00:00Z'));
    // Year bits (>> 9) are relative to 1980; a negative year would corrupt them.
    expect(readU16(zip, 12) >> 9).toBe(0);
  });
});
