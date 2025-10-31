import React from 'react';

interface PanelHeaderProps {
  title: string;
  onClose: () => void;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ title, onClose }) => {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <span className="close-button" onClick={onClose}>&times;</span>
    </div>
  );
};

export default PanelHeader;

