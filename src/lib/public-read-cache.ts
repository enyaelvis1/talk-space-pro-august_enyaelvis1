// Only use for anonymous, published data, never user-scoped responses or permissions.
export function createPublicReadCache<T>(ttlMs: number, now = Date.now) {
  let cached: { value: T; expiresAt: number } | undefined;
  let pending: Promise<T> | undefined;
  let generation = 0;

  return {
    peek() {
      return cached?.value;
    },
    clear() {
      generation++;
      cached = undefined;
      pending = undefined;
    },
    get(load: () => Promise<T>): Promise<T> {
      if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value);
      if (pending) return pending;
      const startedGeneration = generation;
      const request = Promise.resolve()
        .then(load)
        .then((value) => {
          // A publish may invalidate this entry while its previous read is in flight.
          if (generation === startedGeneration) cached = { value, expiresAt: now() + ttlMs };
          return value;
        })
        .finally(() => {
          if (pending === request) pending = undefined;
        });
      pending = request;
      return request;
    },
  };
}
