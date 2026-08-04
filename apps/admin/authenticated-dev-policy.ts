function normalizedHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
}

export function shouldForwardAccessAssertion(
  requestHost: string | undefined,
  protectedHostname: string
): boolean {
  return Boolean(
    requestHost && normalizedHostname(requestHost) === normalizedHostname(protectedHostname)
  )
}
