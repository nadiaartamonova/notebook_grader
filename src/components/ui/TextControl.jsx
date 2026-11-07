import React, { useId, useState } from 'react';
import { pastedOverflow } from '../../utils/text-limit.js';

// Сохраняем обычное поведение maxLength, но объясняем ограничение до усечения вставки браузером.
export function TextControl({
  as: Element = 'input',
  maxLength,
  value,
  defaultValue,
  onChange,
  onPaste,
  ...props
}) {
  const [length, setLength] = useState(String(value ?? defaultValue ?? '').length);
  const [overflow, setOverflow] = useState(0);
  const id = useId();
  const limited = Number.isInteger(maxLength);
  const description = [
    props['aria-describedby'],
    limited ? id : null,
    overflow ? `${id}-warning` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <Element
        {...props}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-describedby={description || undefined}
        onChange={(event) => {
          setLength(event.target.value.length);
          onChange?.(event);
        }}
        onPaste={(event) => {
          if (limited) {
            const input = event.currentTarget;
            setOverflow(
              pastedOverflow(
                input.value,
                input.selectionStart ?? input.value.length,
                input.selectionEnd ?? input.value.length,
                event.clipboardData.getData('text'),
                maxLength,
              ),
            );
          }
          onPaste?.(event);
        }}
      />
      {limited && (
        <small id={id} className="character-count">
          {value === undefined ? length : String(value).length} / {maxLength} символов
        </small>
      )}
      {overflow > 0 && (
        <small id={`${id}-warning`} className="text-limit-warning" role="alert">
          Вставленный текст не поместился: превышение на {overflow} символов. Лимит поля —{' '}
          {maxLength}. Проверьте сохранённый текст.
        </small>
      )}
    </>
  );
}
