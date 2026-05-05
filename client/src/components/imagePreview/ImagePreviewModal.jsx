import React, { useEffect } from "react";
import "./imagePreviewModal.css";

/**
 * Modern, reusable image preview modal with:
 * - Click outside to close
 * - Keyboard (Esc) to close
 * - Fixed, moderate size (not too large)
 * - Smooth animations
 * - Works across ProductList, CartDetails, GroupItem
 */
export default function ImagePreviewModal({
  isOpen,
  imageSrc,
  alt = "Preview",
  onClose,
}) {
  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="image-preview-overlay" onClick={handleOverlayClick}>
      <div className="image-preview-modal">
        <button
          className="image-preview-close"
          onClick={onClose}
          aria-label="Close preview"
          title="Close (or press Escape)"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="image-preview-content">
          <img src={imageSrc} alt={alt} loading="lazy" />
        </div>
      </div>
    </div>
  );
}
