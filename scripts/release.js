import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'

const type = process.argv[2]
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/release.js <patch|minor|major>')
  process.exit(1)
}

function run(command, message) {
  console.log(`\n>> ${message}`)
  try {
    execSync(command, { stdio: 'inherit', shell: 'bash' })
  } catch {
    console.error(`\nFailed: ${message}`)
    process.exit(1)
  }
}

function runPublish() {
  console.log('\n>> npm publish')
  const child = spawn('npm', ['publish'], { stdio: 'inherit', shell: 'bash' })
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`npm publish exited with code ${code}`))
    })
  })
}

run('npm test', 'run tests')
run(`npm run version:${type}`, `bump ${type} version and build`)

const version = execSync('node -p "require(\'./package.json\').version"', {
  encoding: 'utf8',
}).trim()

run('git add package.json dist/', 'stage version + dist')
run(`git commit -m "chore: release v${version}"`, 'commit release')
run('git push --follow-tags', 'push commit + tag')

try {
  await runPublish()
  console.log(`\nPublished v${version}`)
} catch {
  console.error('\nPublish failed. Commit and tag are pushed; fix and retry npm publish manually.')
  process.exit(1)
}
