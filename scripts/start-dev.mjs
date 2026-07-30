import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

const tscPath = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
const runtimeArgs = process.argv.slice(2)
let appProcess
let shuttingDown = false

function stopApp() {
    if (!appProcess) return
    appProcess.kill()
    appProcess = undefined
}

function startApp() {
    stopApp()
    appProcess = spawn(process.execPath, [...runtimeArgs, 'dist/main.js'], {
        stdio: 'inherit',
        env: process.env,
    })
    appProcess.on('exit', code => {
        appProcess = undefined
        if (!shuttingDown && code && code !== 0) process.exitCode = code
    })
}

const compiler = spawn(process.execPath, [tscPath, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
})

for (const stream of [compiler.stdout, compiler.stderr]) {
    stream.pipe(process.stdout)
    const lines = createInterface({ input: stream })
    lines.on('line', line => {
        if (line.includes('Found 0 errors. Watching for file changes.')) startApp()
    })
}

compiler.on('exit', code => {
    if (!shuttingDown && code && code !== 0) process.exitCode = code
    stopApp()
})

function shutdown(signal) {
    if (shuttingDown) return
    shuttingDown = true
    stopApp()
    compiler.kill(signal)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
