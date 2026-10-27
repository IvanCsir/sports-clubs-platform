import { useState } from 'react';
import { getOpponentBadge, getOpponentInitials } from '../data/opponent-badges';

export default function OpponentBadge({ name, size = 'default' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = getOpponentBadge(name);
  const sizeClass = size === 'small' ? ' opponent-badge-small' : '';

  return (
    <span className={`opponent-badge${sizeClass}`} aria-hidden="true">
      {image && !imageFailed
        ? <img src={image} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
        : <span>{getOpponentInitials(name)}</span>}
    </span>
  );
}
