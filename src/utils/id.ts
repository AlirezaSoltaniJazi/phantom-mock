export function newId(prefix: 'rule' | 'grp'): string {
  const cryptoLike = globalThis.crypto;
  const suffix =
    cryptoLike && typeof cryptoLike.randomUUID === 'function'
      ? cryptoLike.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${suffix}`;
}

export function hashStringToInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
