import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";

interface SheetProps {
  title: string;
  onClose: () => void;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ title, onClose, rightAction, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3 className="sheet-title">{title}</h3>
          <div className="sheet-actions">
            {rightAction}
            <button type="button" className="icon-circle" onClick={onClose} aria-label="Close">
              <IoClose size={18} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
};
