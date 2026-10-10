export const suggestEnglishSlug = (name: string): string | undefined => {
  if (/[^\x20-\x7e]/.test(name)) return undefined
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug && slug.length <= 160 ? slug : undefined
}
