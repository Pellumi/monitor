/** A Prisma unique-constraint violation, which here means "someone else claimed it". */
export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002');
}

/** A Prisma foreign-key violation — a row referencing something that is gone. */
export function isForeignKeyViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2003');
}
