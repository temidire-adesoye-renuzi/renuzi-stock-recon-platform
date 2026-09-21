import 'dotenv/config'

export const TIMEZONE = 'Africa/Lagos'

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '12h'

/** WAT hour (0-23) at which submissions lock for the rest of the day. */
export const CUTOFF_HOUR = Number(process.env.CUTOFF_HOUR ?? 18)

if (JWT_SECRET === 'dev-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('JWT_SECRET is not set — using insecure development default')
}
