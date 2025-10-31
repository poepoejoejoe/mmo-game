import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface QuantityModalProps {
  isOpen: boolean;
  title: string;
  maxQuantity: number;
  onSubmit: (quantity: number) => void;
  onCancel: () => void;
}

const QuantityModal: React.FC<QuantityModalProps> = ({ isOpen, title, maxQuantity, onSubmit, onCancel }) => {
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    if (!isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const qty = Math.min(Math.max(1, quantity), maxQuantity);
    onSubmit(qty);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="modal-overlay" onClick={onCancel}></div>
      <div className="modal active">
        <div className="modal-content">
          <h3>{title}</h3>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={maxQuantity}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                setQuantity(Math.min(Math.max(1, val), maxQuantity));
              }
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="modal-actions">
            <button onClick={handleSubmit}>OK</button>
            <button onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default QuantityModal;

