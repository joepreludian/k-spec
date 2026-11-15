export const randomIdGenerator = { next: () => crypto.randomUUID() };

export function sequentialIdGenerator(prefix = "id") {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
}
