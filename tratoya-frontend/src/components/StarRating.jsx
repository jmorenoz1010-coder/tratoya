import { useState } from "react";

export default function StarRating({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${active >= n ? "on" : ""}`}
          onMouseEnter={() => !disabled && setHover(n)}
          onFocus={() => !disabled && setHover(n)}
          onClick={() => !disabled && onChange?.(n)}
          disabled={disabled}
          aria-label={`${n} estrellas`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
