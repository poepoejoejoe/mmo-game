import React from 'react';
import { send } from '../network';
import PanelHeader from './shared/PanelHeader';

interface RunesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  runes: string[];
  activeRune: string;
}

const RunesPanel: React.FC<RunesPanelProps> = ({ isOpen, onClose, runes, activeRune }) => {
  if (!isOpen) return null;

  const handleRuneClick = (runeId: string) => {
    const newRune = runeId === activeRune ? '' : runeId;
    send({ type: 'set_rune', payload: { rune: newRune } });
  };

  const getRuneIcon = (runeId: string): string => {
    if (runeId === 'chop_trees') {
      return 'assets/chop-trees-rune-icon.png';
    } else if (runeId === 'mine_ore') {
      return 'assets/mine-ore-rune-icon.png';
    }
    // TODO: Map other runeId to icons
    return '';
  };

  return (
    <div id="runes-view" className="info-panel">
      <PanelHeader title="Runes" onClose={onClose} />
      {runes.length === 0 ? (
        <p>No runes unlocked.</p>
      ) : (
        runes.map((runeId) => (
          <button
            key={runeId}
            className={`rune-button ${runeId === activeRune ? 'selected' : ''}`}
            onClick={() => handleRuneClick(runeId)}
          >
            <img src={getRuneIcon(runeId)} alt={`${runeId} rune`} />
          </button>
        ))
      )}
    </div>
  );
};

export default RunesPanel;

