import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AuthUser, StoredUser } from '../types.js'

const USERS_FILE = fileURLToPath(new URL('../../data/users.json', import.meta.url))

interface UserFile {
  users: StoredUser[]
}

function loadUsers(): StoredUser[] {
  const raw = readFileSync(USERS_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as UserFile
  return parsed.users
}

export function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.location ? { location: user.location } : {}),
  }
}

export function findByEmail(email: string): StoredUser | undefined {
  const normalized = email.trim().toLowerCase()
  return loadUsers().find((user) => user.email.toLowerCase() === normalized)
}

export function findById(id: string): StoredUser | undefined {
  return loadUsers().find((user) => user.id === id)
}

export function listUsers(): AuthUser[] {
  return loadUsers().map(sanitizeUser)
}
