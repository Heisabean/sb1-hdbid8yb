import React, { useState, useRef, useEffect } from 'react';
import { Play, Trophy, LogOut } from 'lucide-react';

/**
 * A simple AABB collision test.
 */
function isColliding(rect1, rect2) {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

/**
 * DraggableCharacter
 *
 * - Starts at an initial position.
 * - Can be dragged, then when released falls under gravity.
 * - Bounces off screen boundaries and any element marked with the "obstacle" class.
 * - When landing gently (low vertical velocity) on an obstacle, it “sticks” naturally,
 *   with friction applied to prevent unwanted sliding.
 * - Clicking (when not dragging) applies an upward jump impulse.
 */
const DraggableCharacter = ({ initialPos }) => {
  const [pos, setPos] = useState(
    initialPos || { x: window.innerWidth - 80, y: 100 }
  );
  const posRef = useRef(pos);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const characterRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const draggingRef = useRef(false);
  const simulationRunningRef = useRef(false);

  // Physical parameters
  const gravity = 2000; // pixels per second²
  const bounceFactor = 0.7; // bounce damping
  const friction = 0.95; // friction factor when resting

  // Start the physics simulation loop.
  const startSimulation = () => {
    if (!simulationRunningRef.current) {
      simulationRunningRef.current = true;
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    }
  };

  // Stop the simulation loop.
  const stopSimulation = () => {
    simulationRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const physicsStep = (time) => {
    const dt = (time - lastTimeRef.current) / 1000; // seconds elapsed
    lastTimeRef.current = time;

    // Apply gravity only when not dragging.
    if (!draggingRef.current) {
      velocityRef.current.vy += gravity * dt;
    }
    // Update position.
    posRef.current.x += velocityRef.current.vx * dt;
    posRef.current.y += velocityRef.current.vy * dt;

    const charElem = characterRef.current;
    if (charElem) {
      const charRect = charElem.getBoundingClientRect();
      const charWidth = charRect.width;
      const charHeight = charRect.height;

      // ─── SCREEN BOUNDARIES ─────────────────────────
      if (posRef.current.x < 0) {
        posRef.current.x = 0;
        velocityRef.current.vx = -velocityRef.current.vx * bounceFactor;
      }
      if (posRef.current.x + charWidth > window.innerWidth) {
        posRef.current.x = window.innerWidth - charWidth;
        velocityRef.current.vx = -velocityRef.current.vx * bounceFactor;
      }
      if (posRef.current.y < 0) {
        posRef.current.y = 0;
        velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
      }
      if (posRef.current.y + charHeight > window.innerHeight) {
        posRef.current.y = window.innerHeight - charHeight;
        velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
      }

      // ─── OBSTACLE COLLISIONS ───────────────────────
      // Check collisions with every element marked as an "obstacle"
      const obstacles = document.querySelectorAll('.obstacle');
      obstacles.forEach((obstacle) => {
        if (obstacle === charElem) return;
        const obsRect = obstacle.getBoundingClientRect();
        if (isColliding(charRect, obsRect)) {
          // Compute overlap distances.
          const overlapLeft = charRect.right - obsRect.left;
          const overlapRight = obsRect.right - charRect.left;
          const overlapTop = charRect.bottom - obsRect.top;
          const overlapBottom = obsRect.bottom - charRect.top;
          const minOverlap = Math.min(
            overlapLeft,
            overlapRight,
            overlapTop,
            overlapBottom
          );

          if (minOverlap === overlapTop) {
            // Collision from above (landing on an obstacle).
            // If falling slowly, "snap" onto the obstacle.
            if (Math.abs(velocityRef.current.vy) < 150) {
              posRef.current.y = obsRect.top - charHeight;
              velocityRef.current.vy = 0;
              // Apply friction so the character doesn't slide horizontally.
              velocityRef.current.vx *= friction;
              if (Math.abs(velocityRef.current.vx) < 5) {
                velocityRef.current.vx = 0;
              }
            } else {
              // Otherwise, bounce naturally.
              posRef.current.y -= minOverlap;
              velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
            }
          } else if (minOverlap === overlapBottom) {
            // Collision from below.
            posRef.current.y += minOverlap;
            velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
          } else if (minOverlap === overlapLeft) {
            // Collision from the left.
            posRef.current.x -= minOverlap;
            if (Math.abs(velocityRef.current.vx) < 150) {
              velocityRef.current.vx = 0;
            } else {
              velocityRef.current.vx = -velocityRef.current.vx * bounceFactor;
            }
          } else if (minOverlap === overlapRight) {
            // Collision from the right.
            posRef.current.x += minOverlap;
            if (Math.abs(velocityRef.current.vx) < 150) {
              velocityRef.current.vx = 0;
            } else {
              velocityRef.current.vx = -velocityRef.current.vx * bounceFactor;
            }
          }
        }
      });
    }

    // Update state to reflect the new position.
    setPos({ x: posRef.current.x, y: posRef.current.y });

    // If the character is moving significantly (or is being dragged), continue the simulation.
    if (
      draggingRef.current ||
      Math.abs(velocityRef.current.vx) > 1 ||
      Math.abs(velocityRef.current.vy) > 1
    ) {
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    } else {
      stopSimulation();
    }
  };

  // ─── DRAG & TOUCH HANDLERS ─────────────────────────
  const handleMouseDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    stopSimulation();
    const rect = characterRef.current.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMove = (e) => {
    if (!draggingRef.current) return;
    posRef.current.x = e.clientX - offsetRef.current.x;
    posRef.current.y = e.clientY - offsetRef.current.y;
    setPos({ x: posRef.current.x, y: posRef.current.y });
  };

  const handleMouseUp = () => {
    if (draggingRef.current) {
      draggingRef.current = false;
      startSimulation();
    }
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    stopSimulation();
    const touch = e.touches[0];
    const rect = characterRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const handleTouchMove = (e) => {
    if (!draggingRef.current) return;
    const touch = e.touches[0];
    posRef.current.x = touch.clientX - offsetRef.current.x;
    posRef.current.y = touch.clientY - offsetRef.current.y;
    setPos({ x: posRef.current.x, y: posRef.current.y });
  };

  const handleTouchEnd = () => {
    if (draggingRef.current) {
      draggingRef.current = false;
      startSimulation();
    }
  };

  // ─── JUMP ON CLICK ─────────────────────────────────
  // If the character is clicked (and not dragged) it receives an upward impulse.
  const handleClick = () => {
    if (!draggingRef.current) {
      velocityRef.current.vy = -800;
      velocityRef.current.vx += (Math.random() - 0.5) * 200;
      startSimulation();
    }
  };

  // Register global mouse/touch events.
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div
      ref={characterRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      className="absolute w-12 h-12 cursor-grab"
      style={{ left: pos.x, top: pos.y, zIndex: 1000 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        className="w-full h-full"
      >
        <defs>
          <linearGradient
            id="character-gradient"
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="1"
            spreadMethod="pad"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="#010022" />
          </linearGradient>
        </defs>
        <g transform="translate(20 20)">
          <rect
            width="30"
            height="30"
            rx="4"
            ry="4"
            transform="translate(-15 -15)"
            fill="#FFD700"
          />
          <path d="M0,-15v30" stroke="#FFE666" strokeWidth="1" opacity="0.5" />
          <path d="M-15,0h30" stroke="#FFE666" strokeWidth="1" opacity="0.5" />
          <g transform="matrix(1.37111 0 0 2.052324 0 -0.428863)">
            <g transform="translate(-4.334689 0)">
              <circle r="3" fill="#fff" />
              <circle r="1.5" transform="translate(0.926524 0)" fill="#333" />
            </g>
            <g transform="translate(4.334688 0)">
              <circle r="3" fill="#fff" />
              <circle r="1.5" transform="translate(0.879059 0)" fill="#333" />
            </g>
          </g>
          <circle
            r="2.5"
            transform="matrix(1 0 0 0.884546 -8 7.75)"
            opacity="0.6"
            fill="#FFB6C1"
          />
          <circle
            r="2.5"
            transform="matrix(1 0 0 0.884546 8 7.75)"
            opacity="0.6"
            fill="#FFB6C1"
          />
          <path
            d="M-4,7q4,3,8,0"
            fill="none"
            stroke="#333"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};

/**
 * TetrisTitle
 *
 * Renders the background tetriminoes, the “TETRIS” title, and menu buttons.
 * All these elements have the "obstacle" class so that our character will bounce off them.
 * The letter "S" gets a ref so we can compute its position and start the character right on top of it.
 */
const TetrisTitle = () => {
  const [hoveredButton, setHoveredButton] = useState(null);
  const [characterInitialPos, setCharacterInitialPos] = useState(null);
  const letterSRef = useRef(null);

  const tetriminoes = [
    { color: 'bg-cyan-500', shape: 'h-6 w-24' },
    { color: 'bg-yellow-500', shape: 'h-12 w-12' },
    { color: 'bg-purple-500', shape: 'h-6 w-16' },
    { color: 'bg-green-500', shape: 'h-12 w-16' },
    { color: 'bg-red-500', shape: 'h-8 w-8' },
    { color: 'bg-blue-500', shape: 'h-16 w-8' },
  ];

  // When the letter S is rendered, compute its position to start the character on top of it.
  useEffect(() => {
    if (letterSRef.current) {
      const rect = letterSRef.current.getBoundingClientRect();
      const charWidth = 48;
      const charHeight = 48;
      setCharacterInitialPos({
        x: rect.left + (rect.width - charWidth) / 2,
        y: rect.top - charHeight,
      });
    }
  }, [letterSRef]);

  return (
    <div className="h-screen w-full bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Floating tetrimino obstacles */}
      {tetriminoes.map((tetrimino, index) => (
        <div
          key={index}
          className={`absolute obstacle ${tetrimino.color} ${tetrimino.shape} opacity-20 transition-all duration-3000 ease-in-out animate-pulse`}
          style={{
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 80 + 10}%`,
            transform: `rotate(${Math.random() * 360}deg)`,
            animationDelay: `${index * 0.5}s`,
          }}
        />
      ))}

      {/* Title */}
      <div className="relative mb-16">
        <h1 className="text-7xl font-bold mb-12 tracking-widest relative">
          <span className="obstacle text-cyan-400 hover:text-cyan-300 transition-colors duration-300">
            T
          </span>
          <span className="obstacle text-yellow-400 hover:text-yellow-300 transition-colors duration-300">
            E
          </span>
          <span className="obstacle text-purple-400 hover:text-purple-300 transition-colors duration-300">
            T
          </span>
          <span className="obstacle text-green-400 hover:text-green-300 transition-colors duration-300">
            R
          </span>
          <span className="obstacle text-red-400 hover:text-red-300 transition-colors duration-300">
            I
          </span>
          <span
            ref={letterSRef}
            className="obstacle text-blue-400 hover:text-blue-300 transition-colors duration-300"
          >
            S
          </span>
        </h1>
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20" />
      </div>

      {/* Menu Buttons */}
      <div className="flex flex-col gap-4 w-64 relative z-10">
        {[
          { icon: Play, text: '게임 시작', color: 'cyan' },
          { icon: Trophy, text: '리더보드', color: 'purple' },
          { icon: LogOut, text: '나가기', color: 'red' },
        ].map((button, index) => (
          <button
            key={index}
            className={`obstacle bg-${button.color}-500 hover:bg-${
              button.color
            }-600 
                        text-white py-4 px-6 rounded-lg 
                        flex items-center justify-center gap-2 
                        transform transition-all duration-300
                        ${
                          hoveredButton === index
                            ? 'scale-105 -translate-y-1'
                            : ''
                        }
                        shadow-lg hover:shadow-${button.color}-500/50`}
            onMouseEnter={() => setHoveredButton(index)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button.icon size={24} />
            <span className="font-semibold">{button.text}</span>
          </button>
        ))}
      </div>

      {/* Draggable character placed on top of letter S initially */}
      {characterInitialPos && (
        <DraggableCharacter initialPos={characterInitialPos} />
      )}
    </div>
  );
};

export default TetrisTitle;
