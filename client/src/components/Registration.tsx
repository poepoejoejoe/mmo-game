import React, { useState, useEffect } from 'react';
import { send } from '../network';
import { registerWindowFunction } from '../api/windowApi';

interface RegistrationProps {
  playerName: string;
}

const Registration: React.FC<RegistrationProps> = ({ playerName }) => {
  const [showRegistration, setShowRegistration] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    // Check if user needs to register (no secretKey in localStorage)
    const needsRegistration = !localStorage.getItem('secretKey');
    setShowRegistration(needsRegistration);
  }, []);

  // Listen for when player name becomes available (after registration)
  useEffect(() => {
    if (playerName) {
      setShowRegistration(false);
    }
  }, [playerName]);

  // Expose function for network.ts to trigger registration prompt
  useEffect(() => {
    const promptForRegistration = () => {
      setShowRegistration(true);
    };
    
    const cleanup = registerWindowFunction('promptForRegistration', promptForRegistration);
    return cleanup;
  }, []);

  const handleRegister = () => {
    const name = nameInput.trim();
    if (name) {
      send({
        type: 'register',
        payload: { name: name }
      });
      setShowRegistration(false);
      setNameInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRegister();
    }
  };

  // Show welcome message if player has a name
  if (playerName) {
    return (
      <div id="welcome-message">
        Welcome, {playerName}!
      </div>
    );
  }

  // Show registration form if needed
  if (showRegistration) {
    return (
      <div id="registration-container" style={{ display: 'flex', marginTop: '10px' }}>
        <input
          type="text"
          id="name-input"
          placeholder="Enter name to save progress"
          maxLength={15}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button id="register-button" onClick={handleRegister}>
          Save
        </button>
      </div>
    );
  }

  return null;
};

export default Registration;

