import React from 'react';
import { send } from '../network';

interface DialogOption {
  text: string;
  action: string;
  context?: string;
}

interface DialogProps {
  isOpen: boolean;
  npcName?: string;
  text: string;
  options: DialogOption[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

const Dialog: React.FC<DialogProps> = ({ isOpen, npcName, text, options, position, onClose }) => {
  if (!isOpen) return null;

  const handleOptionClick = (option: DialogOption) => {
    if (option.action !== 'close_dialog') {
      send({
        type: 'dialog_action',
        payload: { action: option.action, context: option.context }
      });
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format text with newlines
  const formattedText = text.split('\n').map((line, index) => (
    <p key={index}>{line}</p>
  ));

  const dialogStyle: React.CSSProperties = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -110%)',
      }
    : {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <>
      <div id="dialog-overlay" className="active" onClick={handleOverlayClick}></div>
      <div id="dialog-modal" className="dialog-popup active" style={dialogStyle}>
        <div className="modal-header">
          <h2 id="dialog-npc-name">{npcName || 'Confirmation'}</h2>
          <span className="close-button" id="dialog-close-button" onClick={onClose}>
            &times;
          </span>
        </div>
        <div id="dialog-text">{formattedText}</div>
        <div id="dialog-options">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionClick(option)}
              data-action={option.action}
              data-context={option.context}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default Dialog;

