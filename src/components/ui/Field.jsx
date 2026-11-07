import { TextControl } from './TextControl.jsx';
import React from 'react';
export function Field({ label, ...props }) {
  return (
    <label>
      {label}
      <TextControl {...props} />
    </label>
  );
}
