/* ----------------------------------- */
export function sanitizeNext(input: unknown): string {
    const raw = String(input ?? '').trim()
    if (raw.length === 0) return '/'
    if (!raw.startsWith('/')) return '/'
    if (raw.startsWith('//')) return '/'   /* network-path ref → reject */
    if (raw.includes('\\') || /[\u0000-\u001F]/.test(raw)) return '/'
    return raw
}