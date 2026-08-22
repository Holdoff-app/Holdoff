/**
 * Animated Characters System
 * Characters wander around the page randomly
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    characters: [
      { class: 'character--female', speed: 1.2 },
      { class: 'character--male', speed: 1.0 }
    ],
    minPauseTime: 2000,  // Min pause between moves (ms)
    maxPauseTime: 5000,  // Max pause between moves (ms)
    moveDistance: 150,    // Pixels to move in each step
    animationDuration: 3000, // Time to complete each move (ms)
    boundaryPadding: 50   // Keep characters away from edges
  };

  // Create container
  function initCharacters() {
    // Check if we should show characters (not on mobile)
    if (window.innerWidth < 480) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'characters-container';
    document.body.appendChild(container);

    // Create each character
    CONFIG.characters.forEach((config, index) => {
      createCharacter(container, config, index);
    });
  }

  // Create a single character
  function createCharacter(container, config, index) {
    const char = document.createElement('div');
    char.className = `character ${config.class}`;
    char.style.opacity = '0';
    
    // Random starting position
    const startPos = getRandomPosition();
    char.style.left = startPos.x + 'px';
    char.style.top = startPos.y + 'px';
    
    container.appendChild(char);

    // Fade in after a delay
    setTimeout(() => {
      char.style.transition = 'opacity 0.5s ease';
      char.style.opacity = '1';
      
      // Start wandering after fade in
      setTimeout(() => {
        startWandering(char, config.speed);
      }, 500);
    }, index * 1000);

    // Click interaction
    char.addEventListener('click', () => {
      char.style.animation = 'idle-bounce 0.5s ease-in-out';
      setTimeout(() => {
        char.style.animation = '';
      }, 500);
    });
  }

  // Get random position within viewport
  function getRandomPosition() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = CONFIG.boundaryPadding;

    return {
      x: padding + Math.random() * (viewportWidth - padding * 2 - 120),
      y: padding + Math.random() * (viewportHeight - padding * 2 - 180)
    };
  }

  // Start the wandering behavior
  function startWandering(char, speedMultiplier) {
    function wander() {
      // Get current position
      const currentX = parseFloat(char.style.left) || 0;
      const currentY = parseFloat(char.style.top) || 0;

      // Calculate new random position
      const angle = Math.random() * Math.PI * 2;
      const distance = CONFIG.moveDistance * speedMultiplier;
      let newX = currentX + Math.cos(angle) * distance;
      let newY = currentY + Math.sin(angle) * distance;

      // Keep within bounds
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = CONFIG.boundaryPadding;

      newX = Math.max(padding, Math.min(newX, viewportWidth - padding - 120));
      newY = Math.max(padding, Math.min(newY, viewportHeight - padding - 180));

      // Determine facing direction
      const movingLeft = newX < currentX;
      if (movingLeft) {
        char.classList.add('facing-left');
      } else {
        char.classList.remove('facing-left');
      }

      // Add walking animation
      char.classList.add('walking');
      char.classList.remove('idle');

      // Animate to new position
      char.style.transition = `left ${CONFIG.animationDuration}ms ease-in-out, top ${CONFIG.animationDuration}ms ease-in-out`;
      char.style.left = newX + 'px';
      char.style.top = newY + 'px';

      // After movement, pause and then wander again
      setTimeout(() => {
        char.classList.remove('walking');
        char.classList.add('idle');
        
        // Random pause before next move
        const pauseTime = CONFIG.minPauseTime + 
          Math.random() * (CONFIG.maxPauseTime - CONFIG.minPauseTime);
        
        setTimeout(wander, pauseTime);
      }, CONFIG.animationDuration);
    }

    // Start the wander loop
    wander();
  }

  // Handle window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const container = document.querySelector('.characters-container');
      if (window.innerWidth < 480 && container) {
        container.remove();
      } else if (window.innerWidth >= 480 && !container) {
        initCharacters();
      }
    }, 250);
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCharacters);
  } else {
    initCharacters();
  }
})();
