import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Play, Trophy, LogOut, Volume2, VolumeX } from "lucide-react";
// SOUNDS 관련 import 수정
import { SOUNDS, initializeSounds, playSound } from "../utils/sound";

/**
 * 단순 AABB 충돌 테스트 함수
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
 * DraggableCharacter 컴포넌트
 *
 * - 초기 위치에서 시작하며 드래그 후 중력의 영향을 받습니다.
 * - 화면 경계 및 .obstacle 요소(메뉴 버튼, 배경 Tangram 조각, 타이틀 글자)와 충돌 시 튕깁니다.
 * - 버튼과의 충돌 시 효과음 재생 및 버튼 효과(커짐)를 적용하고, 충돌이 끝나면 원래대로 복구합니다.
 * - 충돌 시 일정 속도 이상이면 착지 효과음이 재생됩니다.
 * - 클릭 시 위로 점프하는 힘이 가해집니다.
 */
const DraggableCharacter = ({ initialPos, onButtonActivate }) => {
  const [pos, setPos] = useState(
    initialPos || { x: window.innerWidth - 80, y: 100 }
  );
  const [isSqueezing, setIsSqueezing] = useState(false);
  const [rotation, setRotation] = useState(0);

  const posRef = useRef(pos);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const characterRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const draggingRef = useRef(false);
  const lastCollidedButton = useRef(null);

  // 눈 관련 상수
  const EYE_CONSTANTS = {
    LEFT_EYE_X: 0.35,
    RIGHT_EYE_X: 0.65,
    EYE_Y: 0.4,
    LEFT_PUPIL_OFFSET: 0.926524,
    RIGHT_PUPIL_OFFSET: 0.879059,
    MAX_PUPIL_OFFSET: 2,
  };

  // 충돌 시 물리 파라미터
  const PHYSICS_PARAMS = {
    ground: { bounceFactor: 0.7, friction: 0.95, landingThreshold: 150 },
    obstacle: { bounceFactor: 0.7, friction: 0.98, landingThreshold: 200 },
  };

  const gravity = 2000; // px/s²
  const bounceFactor = 0.7;

  /**
   * 버튼 충돌 시 효과 적용/제거 핸들러
   */
  const handleCollisionWithButton = useCallback((button, isCollidingFlag) => {
    const buttonElement = document.querySelector(
      `[data-menu-item="${button}"]`
    );
    if (isCollidingFlag) {
      // 버튼과 충돌 중이면 hover 효과 적용 및 효과음 재생
      SOUNDS.hover.play().catch((err) => console.warn(err));
      buttonElement?.classList.add("scale-110", "ring-4", "ring-white/50");
      if (onButtonActivate) onButtonActivate(button);
    } else {
      buttonElement?.classList.remove("scale-110", "ring-4", "ring-white/50");
    }
  }, [onButtonActivate]);

  /**
   * Tangram 조각 충돌 시 흔들림 및 빛나는 효과 적용
   */
  const handlePieceCollision = useCallback((piece) => {
    piece.classList.add("shake-piece", "glow-piece");
    setTimeout(() => {
      piece.classList.remove("shake-piece", "glow-piece");
    }, 500);
  }, []);

  /**
   * 물리 시뮬레이션 – 중력 적용, 위치 업데이트, 충돌 처리
   */
  const physicsStep = (time) => {
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    if (!draggingRef.current) {
      velocityRef.current.vy += gravity * dt;
    }
    posRef.current.x += velocityRef.current.vx * dt;
    posRef.current.y += velocityRef.current.vy * dt;

    const charElem = characterRef.current;
    if (charElem) {
      const { width: charWidth, height: charHeight } =
        charElem.getBoundingClientRect();

      // 화면 경계 충돌 처리
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

      // 모든 .obstacle 요소와 충돌 검사
      const obstacles = document.querySelectorAll(".obstacle");
      obstacles.forEach((obstacle) => {
        if (obstacle === charElem) return;
        const obsRect = obstacle.getBoundingClientRect();
        const charRect = charElem.getBoundingClientRect();

        if (isColliding(charRect, obsRect)) {
          // 버튼과 충돌한 경우
          if (obstacle.dataset.menuItem) {
            handleCollisionWithButton(obstacle.dataset.menuItem, true);
            lastCollidedButton.current = obstacle.dataset.menuItem;
          } else {
            // 이전에 충돌했던 버튼이 있었다면 효과 제거
            if (lastCollidedButton.current) {
              handleCollisionWithButton(lastCollidedButton.current, false);
              lastCollidedButton.current = null;
            }
          }

          // 일정 속도 이상이면 착지 효과음 재생
          if (Math.abs(velocityRef.current.vy) > 100) {
            SOUNDS.land.play().catch((err) => console.warn(err));
          }

          // 버튼이 아닌 경우(예, 글자나 탱그램 조각)도 흔들림 효과 적용
          if (!obstacle.dataset.menuItem) {
            if (obstacle.tagName === "DIV") {
              handlePieceCollision(obstacle);
            }
          }

          // 기본 충돌 처리: 최소 오버랩에 따라 위치 및 속도 보정
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
          const isLetterObstacle =
            obstacle.textContent.trim().length === 1;
          const params = isLetterObstacle
            ? PHYSICS_PARAMS.obstacle
            : PHYSICS_PARAMS.ground;

          if (minOverlap === overlapTop) {
            if (Math.abs(velocityRef.current.vy) < params.landingThreshold) {
              posRef.current.y = obsRect.top - charHeight;
              velocityRef.current.vy = 0;
              velocityRef.current.vx *= params.friction;
              if (
                Math.abs(velocityRef.current.vx) <
                (isLetterObstacle ? 2 : 5)
              ) {
                velocityRef.current.vx = 0;
              }
            } else {
              posRef.current.y -= minOverlap;
              velocityRef.current.vy = -velocityRef.current.vy * params.bounceFactor;
            }
          } else if (minOverlap === overlapBottom) {
            posRef.current.y += minOverlap;
            velocityRef.current.vy = -velocityRef.current.vy * params.bounceFactor;
          } else if (minOverlap === overlapLeft) {
            posRef.current.x -= minOverlap;
            velocityRef.current.vx =
              Math.abs(velocityRef.current.vx) < params.landingThreshold
                ? 0
                : -velocityRef.current.vx * params.bounceFactor;
          } else if (minOverlap === overlapRight) {
            posRef.current.x += minOverlap;
            velocityRef.current.vx =
              Math.abs(velocityRef.current.vx) < params.landingThreshold
                ? 0
                : -velocityRef.current.vx * params.bounceFactor;
          }
        } else {
          // 충돌이 끝났다면, 이전에 적용된 버튼 효과 제거
          if (lastCollidedButton.current) {
            handleCollisionWithButton(lastCollidedButton.current, false);
            lastCollidedButton.current = null;
          }
        }
      });
    }

    setPos({ x: posRef.current.x, y: posRef.current.y });

    // 캐릭터의 위치가 바뀔 때마다 커스텀 이벤트 발행 (TitleLetter에서 충돌 여부 확인)
    if (characterRef.current) {
      const charRect = characterRef.current.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("characterMove", { detail: { charRect } })
      );
    }

    if (
      draggingRef.current ||
      Math.abs(velocityRef.current.vx) > 1 ||
      Math.abs(velocityRef.current.vy) > 1
    ) {
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    } else {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  /**
   * 포인터 좌표 추출 (마우스/터치 공통)
   */
  const getPointerCoords = (e) => {
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY, movementX: 0 };
    }
    return { x: e.clientX, y: e.clientY, movementX: e.movementX || 0 };
  };

  /**
   * 드래그 시작 핸들러
   */
  const handleDragStart = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    setIsSqueezing(true);
    cancelAnimationFrame(animationFrameRef.current);
    const { x, y } = getPointerCoords(e);
    const rect = characterRef.current.getBoundingClientRect();
    offsetRef.current = { x: x - rect.left, y: y - rect.top };
  };

  /**
   * 드래그 이동 핸들러
   */
  const handleDragMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const { x, y, movementX } = getPointerCoords(e);
    if (movementX) {
      setRotation((prev) =>
        Math.max(-30, Math.min(30, prev + movementX * 0.1))
      );
    }
    const newX = x - offsetRef.current.x;
    const newY = y - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    setPos({ x: newX, y: newY });
  }, []);

  /**
   * 드래그 종료 핸들러
   */
  const handleDragEnd = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      setIsSqueezing(false);
      setRotation(0);
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    }
  }, []);

  /**
   * 동공 이동: 마우스 포인터 방향으로 이동
   */
  const handlePupilMovement = useCallback(
    (e) => {
      const charRect = characterRef.current?.getBoundingClientRect();
      if (!charRect) return;
      const getEyeCenter = (eyeX) => ({
        x: charRect.left + charRect.width * eyeX,
        y: charRect.top + charRect.height * EYE_CONSTANTS.EYE_Y,
      });
      const leftEyeCenter = getEyeCenter(EYE_CONSTANTS.LEFT_EYE_X);
      const rightEyeCenter = getEyeCenter(EYE_CONSTANTS.RIGHT_EYE_X);
      const calcOffset = (center) => {
        const dx = e.clientX - center.x;
        const dy = e.clientY - center.y;
        const angle = Math.atan2(dy, dx);
        return {
          x: Math.cos(angle) * EYE_CONSTANTS.MAX_PUPIL_OFFSET,
          y: Math.sin(angle) * EYE_CONSTANTS.MAX_PUPIL_OFFSET,
        };
      };
      const leftOffset = calcOffset(leftEyeCenter);
      const rightOffset = calcOffset(rightEyeCenter);
      if (characterRef.current) {
        const leftPupil = characterRef.current.querySelector("#leftPupil");
        const rightPupil = characterRef.current.querySelector("#rightPupil");
        if (leftPupil && rightPupil) {
          leftPupil.setAttribute(
            "transform",
            `translate(${EYE_CONSTANTS.LEFT_PUPIL_OFFSET + leftOffset.x} ${leftOffset.y})`
          );
          rightPupil.setAttribute(
            "transform",
            `translate(${EYE_CONSTANTS.RIGHT_PUPIL_OFFSET + rightOffset.x} ${rightOffset.y})`
          );
        }
      }
    },
    [EYE_CONSTANTS]
  );

  useEffect(() => {
    window.addEventListener("mousemove", handlePupilMovement);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handlePupilMovement);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [handlePupilMovement, handleDragMove, handleDragEnd]);

  /**
   * 클릭 시 위로 점프하는 핸들러
   */
  const handleClick = () => {
    if (!draggingRef.current) {
      setIsSqueezing(true);
      velocityRef.current.vy = -800;
      velocityRef.current.vx += (Math.random() - 0.5) * 200;
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(physicsStep);
      setTimeout(() => setIsSqueezing(false), 300);
    }
  };

  return (
    <div
      ref={characterRef}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      onClick={handleClick}
      className={`absolute cursor-grab ${!draggingRef.current ? "bounce" : ""}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: "3rem",
        height: "3rem",
        zIndex: 1000,
        transform: `rotate(${rotation}deg)`,
        transition: draggingRef.current ? "none" : "transform 0.3s ease",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        className="w-full h-full"
        style={{ overflow: "visible" }}
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
          <style>{`
            @keyframes blink {
              0%, 90%, 100% { transform: scaleY(1); }
              95% { transform: scaleY(0.1); }
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
            .blink {
              animation: blink 3s infinite;
              transform-origin: center;
              transform-box: fill-box;
            }
            .bounce {
              animation: bounce 1s ease-in-out infinite;
            }
          `}</style>
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
          {/* 눈 */}
          <g
            transform="matrix(1.37111 0 0 2.052324 0 -0.428863)"
            className="blink"
          >
            <g transform="translate(-4.334689 0)">
              <circle r="3" fill="#fff" />
              <circle
                id="leftPupil"
                r="1.5"
                transform="translate(0.926524 0)"
                fill="#333"
              />
            </g>
            <g transform="translate(4.334688 0)">
              <circle r="3" fill="#fff" />
              <circle
                id="rightPupil"
                r="1.5"
                transform="translate(0.879059 0)"
                fill="#333"
              />
            </g>
          </g>
          {/* 볼 */}
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
          {/* 입 */}
          {isSqueezing ? (
            <circle cx="0" cy="7" r="3" fill="#dd595b" />
          ) : (
            <path
              d="M-4,7q4,3,8,0"
              fill="none"
              stroke="#333"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
    </div>
  );
};

/**
 * TitleLetter 컴포넌트
 *
 * - 타이틀 글자를 렌더링하며, 캐릭터와 충돌 시 글자가 살짝 내려갑니다.
 * - 캐릭터의 위치가 변경될 때마다 "characterMove" 이벤트를 구독하여 충돌 여부를 판단합니다.
 */
const TitleLetter = ({ children, color }) => {
  const [isPressed, setIsPressed] = useState(false);
  const letterRef = useRef(null);

  useEffect(() => {
    const checkCollision = (charRect) => {
      if (letterRef.current) {
        const letterRect = letterRef.current.getBoundingClientRect();
        const colliding = !(
          charRect.right < letterRect.left ||
          charRect.left > letterRect.right ||
          charRect.bottom < letterRect.top ||
          charRect.top > letterRect.bottom
        );
        setIsPressed(colliding);
      }
    };

    const handleCharacterMove = (e) => {
      if (e.detail.charRect) {
        checkCollision(e.detail.charRect);
      }
    };

    window.addEventListener("characterMove", handleCharacterMove);
    return () =>
      window.removeEventListener("characterMove", handleCharacterMove);
  }, []);

  return (
    <span
      ref={letterRef}
      className={`obstacle text-${color}-400 transition-all duration-300 text-6xl relative leading-none inline-block ${
        isPressed ? "transform translate-y-1" : ""
      }`}
    >
      {children}
    </span>
  );
};

/**
 * SoundControl 컴포넌트
 *
 * - 우측 하단에 사운드 on/off 토글 버튼을 제공합니다.
 */
const SoundControl = () => {
  const [isMuted, setIsMuted] = useState(false);

  const toggleSound = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    // 모든 SOUNDS 객체의 muted 값을 토글합니다.
    Object.values(SOUNDS).forEach((sound) => {
      sound.muted = newMuted;
    });
  };

  return (
    <button
      onClick={toggleSound}
      className="fixed bottom-4 right-4 p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-full transition-all duration-300 text-white/70 hover:text-white"
    >
      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
};

/**
 * SevenDropsTitle 컴포넌트
 *
 * - 배경의 Tangram 조각, “7DROPS” 타이틀, 메뉴 버튼을 렌더링합니다.
 * - 모든 요소에 .obstacle 클래스를 부여하여 캐릭터와의 충돌을 유도합니다.
 * - 버튼 위에 커서가 있을 때 parallax offset을 적용합니다.
 * - 타이틀 글자는 TitleLetter를 통해 캐릭터와 충돌 시 내려갑니다.
 */
const SevenDropsTitle = () => {
  const [hoveredButton, setHoveredButton] = useState(null);
  const [characterInitialPos, setCharacterInitialPos] = useState(null);
  // 버튼 위에 있을 때 적용할 parallax offset 상태
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });
  const letterSRef = useRef(null);

  // Tangram 조각 정보 (7개로 확장)
  const tangramPieces = [
    {
      color: "bg-cyan-500",
      style: {
        width: "4rem",
        height: "4rem",
        clipPath: "polygon(0 0, 100% 0, 50% 100%)",
      },
    },
    {
      color: "bg-yellow-500",
      style: { width: "4rem", height: "4rem", clipPath: "none" },
    },
    {
      color: "bg-purple-500",
      style: {
        width: "3rem",
        height: "3rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-green-500",
      style: {
        width: "4rem",
        height: "3rem",
        clipPath: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)",
      },
    },
    {
      color: "bg-red-500",
      style: {
        width: "5rem",
        height: "5rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-blue-500",
      style: {
        width: "5rem",
        height: "5rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-pink-500", // 새로운 조각 추가
      style: {
        width: "4rem",
        height: "4rem",
        clipPath: "polygon(0 0, 100% 50%, 0 100%)",
      },
    },
  ];

  // 글자 S 렌더링 후 캐릭터 초기 위치 설정
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
  }, []);

  // 컴포넌트 마운트 시 사운드 초기화
  useEffect(() => {
    initializeSounds();
  }, []);

  // BGM 자동 재생 처리
  useEffect(() => {
    const playBgm = () => {
      playSound(SOUNDS.bgm);
      document.removeEventListener("click", playBgm);
    };
    document.addEventListener("click", playBgm, { once: true });
  }, []);

  // DraggableCharacter에 전달할 버튼 활성화 핸들러 (추가 액션: 콘솔 출력)
  const handleButtonActivate = (btn) => {
    console.log("Button activated:", btn);
  };

  return (
    <div className="h-screen w-full bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 떠다니는 Tangram 조각 (버튼 위에 커서가 있을 때 parallax offset 적용) */}
      {tangramPieces.map((piece, index) => (
        <div
          key={index}
          className={`
            absolute obstacle opacity-20 transition-all duration-3000 ease-in-out
            hover:opacity-30 hover:scale-110 animate-float ${piece.color}
          `}
          style={{
            ...piece.style,
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 80 + 10}%`,
            animationDelay: `${index * -2}s`,
            transform: `translate(${parallaxOffset.x}px, ${parallaxOffset.y}px) rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}

      {/* 타이틀 */}
      <div className="relative mb-16">
        <h1 className="font-bold mb-12 tracking-widest flex items-center justify-center gap-1">
          <TitleLetter color="cyan">7</TitleLetter>
          <TitleLetter color="yellow">D</TitleLetter>
          <TitleLetter color="purple">R</TitleLetter>
          <TitleLetter color="green">O</TitleLetter>
          <TitleLetter color="red">P</TitleLetter>
          <TitleLetter color="blue" ref={letterSRef}>
            S
          </TitleLetter>
        </h1>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-1g blur opacity-10" />
      </div>

      {/* 메뉴 버튼 */}
      <div className="flex flex-col gap-4 w-64 relative z-10">
        {[
          { icon: Play, text: "게임 시작", color: "cyan" },
          { icon: Trophy, text: "리더보드", color: "purple" },
          { icon: LogOut, text: "나가기", color: "red" },
        ].map((btn, index) => (
          <button
            key={index}
            data-menu-item={btn.text}
            className={`obstacle bg-${btn.color}-500 hover:bg-${btn.color}-600 
                        text-white py-4 px-6 rounded-lg flex items-center justify-center gap-2 
                        transform transition-all duration-300
                        ${hoveredButton === index ? "scale-105 -translate-y-1" : ""}
                        shadow-lg hover:shadow-${btn.color}-500/50`}
            onMouseEnter={() => {
              setHoveredButton(index);
              // 버튼 위에 있을 때 parallax offset 적용 (예시)
              setParallaxOffset({ x: 10, y: 10 });
            }}
            onMouseLeave={() => {
              setHoveredButton(null);
              setParallaxOffset({ x: 0, y: 0 });
            }}
          >
            <btn.icon size={24} />
            <span className="font-semibold">{btn.text}</span>
          </button>
        ))}
      </div>

      {/* 드래그 가능한 캐릭터 */}
      {characterInitialPos && (
        <DraggableCharacter
          initialPos={characterInitialPos}
          onButtonActivate={handleButtonActivate}
        />
      )}

      {/* 우측 하단 사운드 on/off 토글 */}
      <SoundControl />
    </div>
  );
};

export default SevenDropsTitle;
