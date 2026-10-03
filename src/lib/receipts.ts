// Reading Safaripap's public Nostr receipts.

// Relays only index single-letter tags, so receipts are fetched by their 't'
// tag and matched to a sacco here, from the 'sacco' tag.
export function isForSacco(tags: string[][], saccoId: string): boolean {
  return tags.some(([name, value]) => name === 'sacco' && value === saccoId)
}
