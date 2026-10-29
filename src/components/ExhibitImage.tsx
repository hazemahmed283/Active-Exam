import { useState } from 'react';
import type { QuestionImage } from '../types';

/** Original exhibit from the PDF. Keeps aspect ratio, opens full size on click, reports load errors. */
export default function ExhibitImage({ image, label }: { image: QuestionImage; label: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(false);

  if (failed) {
    return (
      <div className="exhibit exhibit-error" role="alert">
        <p>
          <strong>{label} could not be loaded.</strong> The file <code>{image.src}</code> is missing or unreadable.
        </p>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <figure className="exhibit">
      <button
        type="button"
        className="exhibit-button"
        onClick={() => setZoom(true)}
        aria-label={`${label}. Open at full size`}
      >
        <img
          key={attempt}
          src={`${image.src}${attempt ? `?retry=${attempt}` : ''}`}
          alt={image.alt}
          width={image.width}
          height={image.height}
          style={{ maxWidth: `min(100%, ${image.width}px)`, height: 'auto', aspectRatio: `${image.width} / ${image.height}` }}
          onError={() => setFailed(true)}
        />
      </button>
      <figcaption>{label} · click to enlarge</figcaption>
      {zoom && (
        <div className="scrim scrim-image" onClick={() => setZoom(false)} role="dialog" aria-modal="true" aria-label={label}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-small lightbox-close" autoFocus onClick={() => setZoom(false)}>
              Close
            </button>
            <img src={image.src} alt={image.alt} />
          </div>
        </div>
      )}
    </figure>
  );
}
