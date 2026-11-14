/** Last known "can write" state, set by useAccess() and checked by the data layer before any write. */
let allowed = true;
export const setWriteAllowed = (v: boolean) => {
  allowed = v;
};
export const writeAllowed = () => allowed;
export class ReadOnlyError extends Error {
  constructor() {
    super("read_only");
  }
}
