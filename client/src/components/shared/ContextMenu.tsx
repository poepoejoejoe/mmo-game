import React, { useEffect } from 'react';

export interface ContextMenuOption {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  options: ContextMenuOption[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, options, onClose }) => {
  useEffect(() => {
    const handleClickOutside = () => {
      onClose();
    };
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        display: 'block',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => {
            if (!option.disabled) {
              option.onClick();
              onClose();
            }
          }}
          disabled={option.disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;

