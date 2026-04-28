#!/bin/sh

# Tách dữ liệu từ stdin
# Dùng awk để đọc cho tới separator
CODE_FILE="/sandbox/solution.cpp"
EXE_FILE="/sandbox/solution"
INPUT_FILE="/sandbox/input.txt"

# Đọc stdin và tách
# Cách đơn giản: lưu tạm ra file và split
cat > /sandbox/raw_data.txt
sed -n '/---INPUT---/q;p' /sandbox/raw_data.txt > "$CODE_FILE"
sed -n '/---INPUT---/,$p' /sandbox/raw_data.txt | sed '1d' > "$INPUT_FILE"

# 1. Compile
g++ -O3 "$CODE_FILE" -o "$EXE_FILE" 2>/tmp/compile_errors.log
if [ $? -ne 0 ]; then
    cat /tmp/compile_errors.log >&2
    exit 1
fi

# 2. Run
"$EXE_FILE" < "$INPUT_FILE"
exit $?
