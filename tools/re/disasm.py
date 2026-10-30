"""Linear disassembly of the AUTO code section, with simple search helpers.

Usage:
  python tools/re/disasm.py dump > out.asm
  python tools/re/disasm.py range 0x401000 0x401100
  python tools/re/disasm.py grep "<regex>" [context]
"""
import re
import sys

from capstone import CS_ARCH_X86, CS_MODE_32, Cs

from pe import PE


def disassemble():
    va, code = PE().code()
    md = Cs(CS_ARCH_X86, CS_MODE_32)
    md.skipdata = True
    return [(i.address, f"{i.mnemonic} {i.op_str}".strip()) for i in md.disasm(code, va)]


def fmt(ins):
    return f"{ins[0]:08X}  {ins[1]}"


def main():
    cmd = sys.argv[1]
    insns = disassemble()
    if cmd == "dump":
        for ins in insns:
            print(fmt(ins))
    elif cmd == "range":
        lo, hi = int(sys.argv[2], 16), int(sys.argv[3], 16)
        for ins in insns:
            if lo <= ins[0] < hi:
                print(fmt(ins))
    elif cmd == "grep":
        pat = re.compile(sys.argv[2])
        ctx = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        for n, ins in enumerate(insns):
            if pat.search(ins[1]):
                for j in range(max(0, n - ctx), min(len(insns), n + ctx + 1)):
                    print(("> " if j == n else "  ") + fmt(insns[j]))
                if ctx:
                    print("--")


if __name__ == "__main__":
    main()
