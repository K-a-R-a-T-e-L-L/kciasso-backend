import { execFileSync, spawn } from 'node:child_process'
import { join } from 'node:path'

function run(command, args) {
    execFileSync(command, args, {
        stdio: 'inherit',
        env: process.env,
    })
}

const prismaBin = join(process.cwd(), 'node_modules', '.bin', 'prisma')

run('node', ['scripts/ensure-document-storage.mjs'])
run('node', ['scripts/bootstrap-db.mjs'])
run(prismaBin, ['migrate', 'deploy'])

if (process.env.RUN_SEED_ON_BOOT === 'true') {
    run(prismaBin, ['db', 'seed'])
}

const app = spawn('node', ['dist/src/main.js'], {
    stdio: 'inherit',
    env: process.env,
})

app.on('exit', code => {
    process.exit(code ?? 0)
})
