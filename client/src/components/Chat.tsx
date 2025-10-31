import React, { useState, useEffect } from 'react';
import * as state from '../state';
import { send } from '../network';

interface ChatMessage {
  playerId: string;
  message: string;
  displayName: string;
  timestamp: number;
}

interface ChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Chat: React.FC<ChatProps> = ({ isOpen, onToggle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');

  // Expose addMessage function so network.ts can add messages
  useEffect(() => {
    (window as any).addChatMessage = (playerId: string, message: string) => {
      const s = state.getState();
      const entity = s.entities[playerId];
      
      let displayName = playerId;
      if (entity && entity.name) {
        displayName = entity.name;
      } else {
        // guest-xxxx
        displayName = playerId.substring(0, 12);
      }
      
      setMessages(prev => [
        { playerId, message, displayName, timestamp: Date.now() },
        ...prev
      ]);
    };
    
    return () => {
      delete (window as any).addChatMessage;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = inputValue.trim();
    if (message) {
      send({ type: 'send_chat', payload: { message } });
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <>
      <div id="chat-messages" className="chat-messages">
        {messages.map((msg, index) => (
          <div key={`${msg.timestamp}-${index}`}>
            <strong>{msg.displayName}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <input
        type="text"
        id="chat-input"
        placeholder="Say something..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </>
  );
};

export default Chat;

