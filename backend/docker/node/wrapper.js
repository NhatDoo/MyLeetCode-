/**
 * Wrapper này nhận dữ liệu từ stdin theo format:
 * [CODE]
 * ---INPUT---
 * [STDIN_FOR_USER_CODE]
 */
const fs = require('fs');

async function main() {
    const data = fs.readFileSync(0, 'utf8');
    const separator = '\n---INPUT---\n';
    const index = data.indexOf(separator);

    let code, input;
    if (index === -1) {
        code = data;
        input = '';
    } else {
        code = data.substring(0, index);
        input = data.substring(index + separator.length);
    }

    // Tự động detect tên hàm do user nhập vào (VD: twoSum)
    const funcMatch = code.match(/function\s+([a-zA-Z0-9_]+)/) || code.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_]+\s*=>)/);
    const funcName = funcMatch ? funcMatch[1] : null;

    if (funcName) {
        code += `\n
        // --- AUTO GENERATED DRIVER CODE ---
        const _fs = require('fs');
        const _input = _fs.readFileSync(0, 'utf-8').trim();
        if (_input) {
            try {
                const _parsed = JSON.parse('[' + _input + ']');
                const _result = ${ funcName } (..._parsed);
                console.log(_result === undefined ? 'null' : JSON.stringify(_result));
            } catch (err) {
                console.error(err);
            }
        }
        `;
    }

    // Rule 4: Ghi code vào file trong /sandbox (vùng tmpfs writable duy nhất)
    fs.writeFileSync('/sandbox/solution.js', code);

    // Mock stdin của user code bằng cách ghi input vào file tạm và redirect
    // Hoặc đơn giản là chạy script và pipe input vào
    const { spawn } = require('child_process');
    const child = spawn('node', ['/sandbox/solution.js'], {
        stdio: ['pipe', 'inherit', 'inherit']
    });

    child.stdin.write(input || '');
    child.stdin.end();

    child.on('exit', (code) => process.exit(code || 0));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
