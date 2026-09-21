import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import type { StoredUser } from '../types.js'

const DATA_FILE = fileURLToPath(new URL('../../data/users.json', import.meta.url))

const SEED_USERS: Array<Omit<StoredUser, 'passwordHash'>> = [
  { id: 'usr_admin', email: 'admin@renuzi', name: 'Renuzi Admin', role: 'admin' },
  {
    id: 'usr_ketu',
    email: 'ketu@renuzi',
    name: 'Ketu Manager',
    role: 'warehouse_manager',
    location: 'Ketu',
  },
  {
    id: 'usr_lekki',
    email: 'lekki@renuzi',
    name: 'Lekki Manager',
    role: 'warehouse_manager',
    location: 'Lekki',
  },
]

const PASSWORDS: Record<string, string> = {
  usr_admin: 'Admin@2026',
  usr_ketu: 'Ketu@2026',
  usr_lekki: 'Lekki@2026',
}

interface UserFile {
  users: StoredUser[]
}

function loadExisting(): StoredUser[] {
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as UserFile
    return Array.isArray(parsed.users) ? parsed.users : []
  } catch {
    return []
  }
}

const existing = loadExisting()
const kept = existing.filter(
  (user) => !SEED_USERS.some((seed) => seed.email.toLowerCase() === user.email.toLowerCase())
)

const seeded: StoredUser[] = SEED_USERS.map((seed) => ({
  ...seed,
  passwordHash: bcrypt.hashSync(PASSWORDS[seed.id], 10),
}))

const users = [...seeded, ...kept].sort((a, b) => a.email.localeCompare(b.email))

mkdirSync(dirname(DATA_FILE), { recursive: true })
writeFileSync(DATA_FILE, `${JSON.stringify({ users }, null, 2)}\n`, 'utf-8')

console.log(`Seeded ${seeded.length} users (${kept.length} existing kept) -> ${DATA_FILE}`)
users.forEach((user) =>
  console.log(`  ${user.email} [${user.role}${user.location ? ` @ ${user.location}` : ''}]`)
)
