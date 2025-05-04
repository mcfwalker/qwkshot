/**
 * Utility for playing sounds in the app
 */

// Cache audio elements to prevent re-creating them every time
const audioCache: Record<string, HTMLAudioElement> = {};

/**
 * Play a sound effect from the public/sounds directory
 * @param sound The sound file name inside the public/sounds folder (with extension)
 * @param volume Volume level between 0 and 1 (default: 0.7)
 * @returns Promise that resolves when the sound has played
 */
export function playSound(sound: string, volume = 0.7): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Check if audio is already cached
      if (!audioCache[sound]) {
        // Create a new audio element
        const audio = new Audio(`/sounds/${sound}`);
        audioCache[sound] = audio;
      }
      
      const audioElement = audioCache[sound];
      
      // Reset in case it was previously played
      audioElement.currentTime = 0;
      audioElement.volume = volume;
      
      // Play the audio
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio is playing
            audioElement.onended = () => resolve();
          })
          .catch(err => {
            // Auto-play may be prevented
            console.warn(`Sound playback failed: ${err.message}`);
            resolve(); // Resolve anyway to not block UI
          });
      } else {
        // Browser doesn't support promises with audio
        audioElement.onended = () => resolve();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
      resolve(); // Resolve anyway to not block UI
    }
  });
}

// Sound constants for common sounds
export const Sounds = {
  CAMERA_SHUTTER: 'camera_shutter.mp3',
  // Add more sounds here as needed
}; 