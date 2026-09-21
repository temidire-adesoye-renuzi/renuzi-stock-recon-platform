export type Role = 'admin' | 'executive' | 'warehouse_manager'

export interface StoredUser {
  id: string
  email: string
  name: string
  role: Role
  location?: string
  passwordHash: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  location?: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
