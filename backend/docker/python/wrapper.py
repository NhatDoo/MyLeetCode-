import sys
import os
import subprocess

def main():
    # Đọc toàn bộ từ stdin
    data = sys.stdin.read()
    separator = '\n---INPUT---\n'
    if separator in data:
        code, input_data = data.split(separator, 1)
    else:
        code = data
        input_data = ""

    # Rule 4: Ghi vào /sandbox (tmpfs)
    with open('/sandbox/solution.py', 'w') as f:
        f.write(code)

    # Chạy process con với input_data
    process = subprocess.Popen(
        ['python3', '/sandbox/solution.py'],
        stdin=subprocess.PIPE,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True
    )
    process.communicate(input=input_data)
    sys.exit(process.returncode)

if __name__ == "__main__":
    main()
