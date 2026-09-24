import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import type { AuthUser, Role, StoredUser } from '../types.js'

/**
 * Users are stored in server/data/users.json (no database). The path is read
 * per call so tests can point each file at its own temporary user store via
 * the USERS_FILE environment variable.
 */
function usersFilePath(): string {
  return process.env.USERS_FILE ?? fileURLToPath(new URL('../../data/users.json', import.meta.url))
}

interface UserFile {
  users: StoredUser[]
}

function loadUsers(): StoredUser[] {
  const raw = readFileSync(usersFilePath(), 'utf-8')
  const parsed = JSON.parse(raw) as UserFile
  return parsed.users
}

function saveUsers(users: StoredUser[]): void {
  writeFileSync(usersFilePath(), `${JSON.stringify({ users }, null, 2)}\n`, 'utf-8')
}

/** User view safe to send to clients — no password hash, explicit deactivated flag. */
export interface UserView extends AuthUser {
  deactivated: boolean
}

export function toUserView(user: StoredUser): UserView {
  return {
    ...sanitizeUser(user),
    deactivated: user.deactivated === true,
  }
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

export function listUsers(): UserView[] {
  return loadUsers().map(toUserView)
}

const ROLES: Role[] = ['super_admin', 'admin', 'executive', 'warehouse_manager']

export interface CreateUserInput {
  email: string
  name: string
  role: Role
  location?: string
  password: string
}

export type CreateUserResult =
  | { ok: true; user: UserView }
  | { ok: false; error: 'INVALID_USER' | 'EMAIL_EXISTS' }

export function createUser(input: CreateUserInput): CreateUserResult {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  const password = input.password
  const location = input.location?.trim()
  if (
    email === '' ||
    !email.includes('@') ||
    name === '' ||
    password === '' ||
    !ROLES.includes(input.role) ||
    (location !== undefined && location === '')
  ) {
    return { ok: false, error: 'INVALID_USER' }
  }

  const users = loadUsers()
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return { ok: false, error: 'EMAIL_EXISTS' }
  }

  const user: StoredUser = {
    id: `usr_${randomUUID()}`,
    email,
    name,
    role: input.role,
    ...(location ? { location } : {}),
    passwordHash: bcrypt.hashSync(password, 10),
  }
  users.push(user)
  saveUsers(users)
  return { ok: true, user: toUserView(user) }
}

export type DeactivateUserResult =
  | { ok: true; user: UserView }
  | { ok: false; error: 'USER_NOT_FOUND' }

/** Soft-disable an account. Users are never deleted — history depends on them. */
export function deactivateUser(id: string): DeactivateUserResult {
  const users = loadUsers()
  const user = users.find((candidate) => candidate.id === id)
  if (!user) {
    return { ok: false, error: 'USER_NOT_FOUND' }
  }
  if (user.deactivated !== true) {
    user.deactivated = true
    saveUsers(users)
  }
  return { ok: true, user: toUserView(user) }
}
