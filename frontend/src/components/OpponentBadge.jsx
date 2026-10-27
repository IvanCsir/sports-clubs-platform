import { useState } from 'react';
import { getOpponentBadge, getOpponentInitials } from '../data/opponent-badges';

export default function OpponentBadge({ name, size = 'default', imageUrl = '' }) {
  const [failedImages, setFailedImages] = useState({});
  const fallbackImage = getOpponentBadge(name);
  const image = imageUrl && !failedImages[imageUrl] ? imageUrl : fallbackImage;
  const sizeClass = size === 'small' ? ' opponent-badge-small' : '';

  return (
    <span className={`opponent-badge${sizeClass}`} aria-hidden="true">
      {image && !failedImages[image]
        ? <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailedImages(current => ({ ...current, [image]: true }))} />
        : <span>{getOpponentInitials(name)}</span>}
    </span>
  );
}
