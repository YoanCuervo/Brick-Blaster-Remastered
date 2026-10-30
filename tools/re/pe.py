"""Minimal PE32 reader for blaster.exe: sections and address conversions."""
import struct
from pathlib import Path

EXE = Path(__file__).resolve().parents[2] / "original" / "blaster.exe"


class PE:
    def __init__(self, path: Path = EXE):
        self.data = path.read_bytes()
        pe = struct.unpack_from("<I", self.data, 0x3C)[0]
        nsec = struct.unpack_from("<H", self.data, pe + 6)[0]
        opt_size = struct.unpack_from("<H", self.data, pe + 20)[0]
        opt = pe + 24
        self.entry, = struct.unpack_from("<I", self.data, opt + 16)
        self.image_base, = struct.unpack_from("<I", self.data, opt + 28)
        self.sections = []
        for i in range(nsec):
            off = opt + opt_size + i * 40
            name = self.data[off:off + 8].rstrip(b"\0").decode()
            vsize, va, rsize, raw = struct.unpack_from("<IIII", self.data, off + 8)
            self.sections.append((name, self.image_base + va, vsize, raw, rsize))

    def section(self, name):
        return next(s for s in self.sections if s[0] == name)

    def va_to_off(self, va):
        for _, start, vsize, raw, rsize in self.sections:
            if start <= va < start + max(vsize, rsize):
                return raw + (va - start)
        return None

    def off_to_va(self, off):
        for _, start, vsize, raw, rsize in self.sections:
            if raw <= off < raw + rsize:
                return start + (off - raw)
        return None

    def code(self):
        _, va, vsize, raw, rsize = self.section("AUTO")
        return va, self.data[raw:raw + rsize]


if __name__ == "__main__":
    pe = PE()
    print(f"image_base=0x{pe.image_base:X} entry=0x{pe.image_base + pe.entry:X}")
    for s in pe.sections:
        print(f"{s[0]:8} va=0x{s[1]:X} vsize=0x{s[2]:X} raw=0x{s[3]:X} rsize=0x{s[4]:X}")
