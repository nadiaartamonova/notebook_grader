import React from 'react';
import { Icon } from './Icon.jsx';
// Только знак приложения, без надписи. Название остаётся в заголовке окна и для экранного диктора.
export function Brand({ large = false }) {
  return (
    <div className={`brand ${large ? 'brand-large' : ''}`} role="img" aria-label="Практикум">
      <span className="brandmark">
        <Icon name="book" />
      </span>
    </div>
  );
}
