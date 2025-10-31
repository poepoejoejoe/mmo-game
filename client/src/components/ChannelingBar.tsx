import React, { useState, useEffect, useRef } from 'react';
import { registerWindowFunction } from '../api/windowApi';

const ChannelingBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  // Expose functions for legacy code
  useEffect(() => {
    const showChannelingBar = (durationMs: number) => {
      // Clear any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }

      // Reset progress and show container
      setProgress(0);
      setDuration(durationMs);
      setIsVisible(true);

      // Trigger animation after a small delay to ensure transition plays
      animationTimeoutRef.current = setTimeout(() => {
        setProgress(100);
      }, 10);

      // Hide the bar after the duration
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, durationMs);
    };

    const hideChannelingBar = () => {
      // Clear any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }

      setIsVisible(false);
      setProgress(0);
    };

    const cleanupShow = registerWindowFunction('showChannelingBar', showChannelingBar);
    const cleanupHide = registerWindowFunction('hideChannelingBar', hideChannelingBar);

    return () => {
      cleanupShow();
      cleanupHide();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div id="channeling-container" style={{ display: 'block' }}>
      <div 
        id="channeling-bar" 
        style={{
          width: `${progress}%`,
          transition: duration > 0 ? `width ${duration}ms linear` : 'none'
        }}
      />
    </div>
  );
};

export default ChannelingBar;

