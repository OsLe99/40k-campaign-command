import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
if (args.length && !(args.length === 2 && args[0] === '--project-id' && /^[a-z0-9]{20}$/.test(args[1]))) {
  throw new Error('Usage: npm run db:types [-- --project-id <20-character-project-ref>]')
}
const target = args.length ? args : ['--local']
const result = spawnSync('npx', ['supabase', 'gen', 'types', 'typescript', '--schema', 'public', ...target], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  process.stderr.write(result.stderr || 'Type generation failed; existing types were preserved.\n')
  process.exitCode = 1
} else {
  writeFileSync('src/types/database.generated.ts', result.stdout, 'utf8')
}
