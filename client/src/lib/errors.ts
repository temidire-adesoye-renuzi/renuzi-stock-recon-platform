import { ApiError } from './apiTypes'

const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired — please sign in again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_AND_PASSWORD_REQUIRED: 'Enter both your work email and password.',
  FORBIDDEN: 'You do not have access to this action.',
  LOCATION_FORBIDDEN: 'You can only work with your own warehouse location.',
  LOCATION_REQUIRED: 'A warehouse location is required.',
  LOCKED_FOR_AUDIT: 'Locked for Executive Audit — daily edits close at 6:00 PM WAT.',
  MISSING_FILES: 'Upload both the LeverEdge and Xero exports before submitting.',
  UNPARSABLE_FILE: 'One of the files could not be parsed.',
  SKU_MAPPING_EXISTS: 'A mapping with that LeverEdge code already exists.',
  SKU_MAPPING_NOT_FOUND: 'That mapping no longer exists.',
  INVALID_SKU_MAPPING: 'The mapping is missing a LeverEdge SKU code.',
  CSV_FILE_REQUIRED: 'Choose a CSV file to import.',
  IMPORT_FAILED: 'The CSV import failed.',
  NETWORK_ERROR: 'Cannot reach the Renuzi API — is the server running?',
  NOT_AVAILABLE_LIVE: 'This feature is only available in mock mode.',
  UNKNOWN_ERROR: 'Something went wrong — please try again.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const base = MESSAGES[error.code] ?? error.code.replace(/_/g, ' ').toLowerCase()
    return error.code === 'UNPARSABLE_FILE' && error.message
      ? `${base} ${error.message}`
      : base
  }
  if (error instanceof Error && error.message !== '') return error.message
  return MESSAGES.UNKNOWN_ERROR
}

export function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code
}
