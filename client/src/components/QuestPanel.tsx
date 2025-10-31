import React from 'react';
import { Quest } from '../types';

interface QuestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Record<string, Quest>;
}

const QuestPanel: React.FC<QuestPanelProps> = ({ isOpen, onClose, quests }) => {
  if (!isOpen) return null;

  const allQuests = Object.values(quests);

  return (
    <div id="quest-view" className="info-panel">
      <div className="panel-header">
        <h2>Quests</h2>
        <span className="close-button" onClick={onClose}>&times;</span>
      </div>
      {allQuests.length === 0 ? (
        <p>No active quests.</p>
      ) : (
        allQuests.map((quest) => (
          <div key={quest.id} className="quest">
            <h3>
              {quest.is_complete ? (
                <>
                  {quest.title} <span className="quest-complete">(Completed)</span>
                </>
              ) : (
                quest.title
              )}
            </h3>
            <ul className="quest-objectives">
              {quest.objectives?.map((objective, index) => (
                <li
                  key={index}
                  className={objective.completed ? 'completed' : ''}
                >
                  {objective.description}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
};

export default QuestPanel;

