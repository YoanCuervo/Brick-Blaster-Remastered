"""DIET 1.4x data-file decompressor.

Port of the decoder in deark (modules/diet.c, MIT license, Jason Summers),
limited to data files: 17-byte header (tag at offset 6, compressed stream at 17).
Brick Blaster uses the standard 'dlz' tag and an in-house 'EOS' tag.

Usage: python tools/extract/diet.py <input> <output>
"""
import sys

HEADER_SIZE = 17
TAGS = (b"dlz", b"EOS")


class _Bits:
    """LSB-first bit reader refilled 16 bits at a time from the byte stream.

    The refill happens right after the last bit is consumed, before any
    following raw byte read: the stream interleaves bit words and raw bytes.
    """

    def __init__(self, data: bytes, pos: int):
        self.data = data
        self.pos = pos
        self.buf = 0
        self.n = 0
        self._fill()

    def _fill(self):
        self.buf = self.data[self.pos] | (self.data[self.pos + 1] << 8)
        self.pos += 2
        self.n = 16

    def bit(self) -> int:
        v = self.buf & 1
        self.buf >>= 1
        self.n -= 1
        if self.n == 0:
            self._fill()
        return v

    def byte(self) -> int:
        b = self.data[self.pos]
        self.pos += 1
        return b


def _match_len(r: _Bits) -> int:
    for count in range(1, 5):
        if r.bit():
            return 2 + count
    x1, x2 = r.bit(), r.bit()
    if x1:
        return 7 + x2
    if x2 == 0:
        return 9 + 4 * r.bit() + 2 * r.bit() + r.bit()
    return 17 + r.byte()


def is_diet(data: bytes) -> bool:
    return len(data) > HEADER_SIZE and data[6:9] in TAGS


def decompress(data: bytes) -> bytes:
    if not is_diet(data):
        raise ValueError("not a DIET data file")
    r = _Bits(data, HEADER_SIZE)
    out = bytearray()
    while True:
        if r.bit():
            out.append(r.byte())
            continue
        x2 = r.bit()
        v = r.byte()
        if x2 == 0:
            if r.bit():
                length = 2
                pos = 2303 - (1024 * r.bit() + 512 * r.bit() + 256 * r.bit() + v)
            elif v != 0xFF:
                length = 2
                pos = 0xFF - v
            elif r.bit() == 0:
                break  # stop code
            else:
                raise ValueError("segment refresh code is only valid in EXE files")
        else:
            a1, a2 = r.bit(), r.bit()
            if a2:
                pos = 511 - (256 * a1 + v)
            elif r.bit():
                pos = 1023 - (256 * a1 + v)
            else:
                a4, a5 = r.bit(), r.bit()
                if a5:
                    pos = 2047 - (512 * a1 + 256 * a4 + v)
                else:
                    a6, a7 = r.bit(), r.bit()
                    if a7:
                        pos = 4095 - (1024 * a1 + 512 * a4 + 256 * a6 + v)
                    else:
                        a8 = r.bit()
                        pos = 8191 - (2048 * a1 + 1024 * a4 + 512 * a6 + 256 * a8 + v)
            length = _match_len(r)
        start = len(out) - 1 - pos
        if start < 0:
            raise ValueError("match before start of output")
        for i in range(length):
            out.append(out[start + i])
    return bytes(out)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = open(src, "rb").read()
    out = decompress(data)
    open(dst, "wb").write(out)
    print(f"{src}: {len(data)} -> {len(out)} bytes")


if __name__ == "__main__":
    main()
