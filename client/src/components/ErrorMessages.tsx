import React, { useState, useEffect } from 'react';
import { registerWindowFunction } from '../api/windowApi';
import './ErrorMessages.css';

interface ErrorMessage {
  id: string;
  text: string;
  createdAt: number;
}

const ErrorMessages: React.FC = () => {
  const [messages, setMessages] = useState<ErrorMessage[]>([]);

  useEffect(() => {
    // Expose function for legacy code to add error messages
    const showErrorMessage = (text: string) => {
      const messageId = `error-${Date.now()}-${Math.random()}`;
      const newMessage: ErrorMessage = {
        id: messageId,
        text,
        createdAt: Date.now(),
      };

      setMessages(prev => [...prev, newMessage]);

      // Remove message after duration (3 seconds)
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }, 4000);
    };

    const cleanup = registerWindowFunction('showErrorMessage', showErrorMessage);
    return cleanup;
  }, []);

  return (
    <div 
      className="error-messages-container"
    >
      {messages.map((message, index) => (
        <div
          key={message.id}
          className="error-message"
          style={{
            zIndex: 1000 + index, // Stack newer messages on top
          }}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
};

export default ErrorMessages;

