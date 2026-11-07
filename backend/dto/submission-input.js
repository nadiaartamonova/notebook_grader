import { UserError } from '../errors.js';
import { MAX_NOTEBOOK_BYTES } from '../domain/notebooks.js';

/** Validate a transport DTO. Client filesystem paths are never accepted. */
export function validateSubmissionInput(p) {
  // Validate the entire request before touching disk. No client filesystem path is accepted.
  if (
    typeof p.name !== 'string' ||
    p.name.length > 200 ||
    /[\\/\x00-\x1f]/.test(p.name) ||
    !p.name.toLowerCase().endsWith('.ipynb')
  )
    throw new UserError('Выберите файл .ipynb с допустимым именем.');
  if (
    typeof p.base64 !== 'string' ||
    p.base64.length > Math.ceil(MAX_NOTEBOOK_BYTES / 3) * 4 ||
    p.base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64)
  )
    throw new UserError('Файл слишком большой или передан некорректно.');
}
