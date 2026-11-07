export function pastedOverflow(value, start, end, inserted, maxLength) {
  return Math.max(0, value.length - (end - start) + inserted.length - maxLength);
}
