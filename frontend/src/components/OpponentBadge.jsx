import { useState } from 'react';
import { getOpponentBadge, getOpponentInitials } from '../data/opponent-badges';

// Las iniciales quedan debajo del escudo: se ven mientras la imagen carga o si no existe.
export default function OpponentBadge({ name, size = 'default' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const image = getOpponentBadge(name);
  const sizeClass = size === 'small' ? ' opponent-badge-small' : '';

  return (
    <span className={`opponent-badge${sizeClass}`} aria-hidden="true">
      <span>{getOpponentInitials(name)}</span>
      {image && !imageFailed && (
        <img
          src={image}
          alt=""
          className={imageLoaded ? 'loaded' : ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      )}
    </span>
  );
}
