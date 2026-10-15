import { useState, useEffect } from 'react';

export interface TiltState {
  gamma: number; // left to right (-90 to 90)
  beta: number;  // front to back (-180 to 180)
  enabled: boolean;
  supported: boolean;
}

export function useDeviceTilt() {
  const [tilt, setTilt] = useState<TiltState>({
    gamma: 0,
    beta: 0,
    enabled: false,
    supported: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasOrientation = 'DeviceOrientationEvent' in window;
    setTilt(prev => ({ ...prev, supported: hasOrientation }));

    if (!hasOrientation) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // Clamp to moderate tilt range for UI effect
        const g = Math.max(-25, Math.min(25, e.gamma));
        const b = Math.max(-25, Math.min(25, e.beta - 45)); // assume holding phone at ~45 deg
        setTilt(prev => ({
          ...prev,
          gamma: g,
          beta: b,
          supported: true,
        }));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const toggleTilt = () => {
    setTilt(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  return { tilt, toggleTilt };
}
