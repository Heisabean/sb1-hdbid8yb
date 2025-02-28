import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { Play, Trophy, Settings, Volume2, VolumeX } from "lucide-react";
import { SOUNDS, initializeSounds, playSound } from "../utils/sound";

/* --- 상수 및 설정 객체 --- */

// 커서 설정 - 사용자가 직접 조정 가능한 설정
const CURSOR_CONFIG = {
  // 커서 크기
  sizes: {
    normal: {
      size: 22, // 기본 크기 (픽셀)
      offset: 11, // 중심점 오프셋 (size/2)
    },
    hover: {
      size: 28, // 호버 시 크기 (픽셀)
      offset: 14, // 중심점 오프셋 (size/2)
    }
  },
  // 커서 속도 설정
  speed: {
    followSpeed: 1.0, // 커서가 마우스를 따라가는 속도 (1.0 = 100%, 값이 클수록 빠름)
    smoothing: 0.0, // 부드러움 정도 (0 = 즉각 반응, 값이 클수록 더 부드러움)
    transitionDuration: 0, // 크기 변화 시 전환 효과 지속 시간 (밀리초)
  }
};

// 글자 상호작용 설정 - 사용자가 직접 조정 가능한 설정
const LETTER_INTERACTION = {
  // 호버링 효과
  hover: {
    enabled: true,
    scaleAmount: 1.2, // 확대 비율 (1.0 = 원본 크기)
    transitionDuration: 300, // 전환 시간 (밀리초)
    transitionTiming: "cubic-bezier(0.34, 1.56, 0.64, 1)", // 전환 타이밍 함수
  },
  // 캐릭터 충돌 효과
  characterPress: {
    enabled: true,
    translateY: 0.5, // 아래로 이동하는 거리 (rem 단위)
    transitionDuration: 300, // 전환 시간 (밀리초)
  }
};

/* --- 메뉴 버튼 설정 --- */
const MENU_BUTTON_CONFIG = {
  // 호버링 효과
  hover: {
    enabled: true,
    scaleAmount: 1.5, // 확대 비율
    transitionDuration: 300, // 전환 시간 (밀리초)
  },
  // 캐릭터 충돌 효과
  characterCollision: {
    enabled: true,
    scaleAmount: 1.5, // 충돌 시 확대 비율
    ringEffect: true, // 링 효과 사용 여부
  },
  // 배경색 설정
  colors: {
    cyan: {
      background: "rgba(6, 182, 212, 0.60)",
      hover: "rgba(6, 182, 212, 0.90)",
      border: "rgba(6, 182, 212, 0.3)",
    },
    purple: {
      background: "rgba(147, 51, 234, 0.60)",
      hover: "rgba(147, 51, 234, 0.90)",
      border: "rgba(147, 51, 234, 0.3)",
    },
    settings: {
      background: "rgba(100, 116, 139, 0.60)",
      hover: "rgba(100, 116, 139, 0.90)",
      border: "rgba(100, 116, 139, 0.3)",
    },
  }
};

/* --- 유틸리티 함수 --- */

// AABB 충돌 감지
function isColliding(rect1: DOMRect, rect2: DOMRect): boolean {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

/* --- 인터페이스 및 타입 정의 --- */

// TitleLetter 컴포넌트 Props
interface TitleLetterProps {
  children: React.ReactNode;
  color: string;
  index: number; // 순차적 애니메이션을 위한 인덱스
}

// DraggableCharacter 컴포넌트 Props
interface DraggableCharacterProps {
  initialPos?: { x: number; y: number };
  onButtonActivate?: (button: string) => void;
}

/* --- 컴포넌트 정의 --- */

// 로딩 화면 컴포넌트
const LoadingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  // 로딩 진행률 상태
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // 진행 상황을 시뮬레이션합니다 (실제로는 리소스 로딩에 연결)
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 - prev) * 0.1;
        return newProgress > 99 ? 100 : newProgress;
      });
    }, 100);
    
    // 로딩 완료 조건
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1500);
    
    return () => {
      clearInterval(interval);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);
  
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
      aria-label="7Drops 로딩 화면"
    >
      <div className="text-center">
        <h1 className="flex space-x-2 font-baloo text-5xl mb-6">
          {['7', 'D', 'R', 'O', 'P', 'S'].map((letter, index) => (
            <span 
              key={index} 
              className={`inline-block text-${['cyan', 'yellow', 'purple', 'green', 'red', 'blue'][index]}-400`}
              style={{
                animation: 'bounce 0.6s ease infinite',
                animationDelay: `${index * 0.1}s`
              }}
            >
              {letter}
            </span>
          ))}
        </h1>
        
        {/* 로딩 진행 표시 */}
        <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mt-4 mb-2">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-white/70">Loading game assets... {Math.floor(progress)}%</p>
      </div>
    </div>
  );
};

// 커스텀 커서 컴포넌트
const CustomCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const [isClicking, setIsClicking] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [cursorText, setCursorText] = useState("");
  const [showText, setShowText] = useState(false);

  // 마우스 위치 상태 (정확한 마우스 위치)
  const mousePosition = useRef({
    x: 0,
    y: 0
  });
  
  // 커서 위치 상태 (부드러운 이동을 위한 값)
  const cursorPosition = useRef({
    x: 0,
    y: 0
  });

  // 매 프레임마다 실행될 애니메이션 함수 - 성능 최적화
  const animateCursor = useCallback((time: number) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animateCursor);
      return;
    }
    
    // 프레임 제한 (약 60fps 목표)
    const deltaTime = time - previousTimeRef.current;
    if (deltaTime < 16) {
      requestRef.current = requestAnimationFrame(animateCursor);
      return;
    }
    
    previousTimeRef.current = time;
    
    // 커서 설정에 따른 속도 계산
    const speed = CURSOR_CONFIG.speed.followSpeed;
    const smoothFactor = CURSOR_CONFIG.speed.smoothing;
    
    // 마우스와 커서 사이의 거리 계산
    const dx = mousePosition.current.x - cursorPosition.current.x;
    const dy = mousePosition.current.y - cursorPosition.current.y;
    
    // 속도 및 부드러움 적용
    if (smoothFactor === 0) {
      // 즉각적인 반응 (smoothing이 0일 때)
      cursorPosition.current.x = mousePosition.current.x;
      cursorPosition.current.y = mousePosition.current.y;
    } else {
      // 부드러운 이동
      cursorPosition.current.x += dx * Math.min(speed * (0.2 / smoothFactor), 1);
      cursorPosition.current.y += dy * Math.min(speed * (0.2 / smoothFactor), 1);
    }
    
    // 커서 위치 업데이트
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${cursorPosition.current.x}px, ${cursorPosition.current.y}px)`;
    }
    
    // 다음 프레임 요청
    requestRef.current = requestAnimationFrame(animateCursor);
  }, []);
  
  // 마우스 위치 업데이트 함수
  const updateMousePosition = useCallback((e: MouseEvent) => {
    mousePosition.current = { x: e.clientX, y: e.clientY };
    
    // 마우스가 인터랙티브 요소 위에 있는지 감지
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || 
                          target.closest('[data-draggable="true"]') || 
                          target.classList.contains('obstacle') ||
                          target.hasAttribute('data-letter') ||
                          target.tagName === 'A';
    
    setIsHovering(!!isInteractive);
    
    // 커서 텍스트 설정 (버튼 라벨 등)
    const buttonElement = target.closest('button');
    if (buttonElement) {
      const label = buttonElement.getAttribute('aria-label') || 
                   buttonElement.textContent?.trim();
      if (label) {
        setCursorText(label);
        setShowText(false);
      }
    } else if (target.closest('[data-draggable="true"]')) {
      setCursorText("Drag");
      setShowText(false);
    } else {
      setShowText(false);
    }
  }, []);
  
  // 마우스 클릭 이벤트 핸들러
  const handleMouseDown = useCallback(() => {
    setIsClicking(true);
    // 햅틱 피드백 (모바일)
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }, []);
  
  const handleMouseUp = useCallback(() => {
    setIsClicking(false);
  }, []);
  
  // 컴포넌트 마운트/언마운트 시 이벤트 리스너 및 애니메이션 설정
  useEffect(() => {
    // 전체 문서에 cursor: none 적용
    const style = document.createElement('style');
    style.textContent = `
      body, a, button, [role="button"] {
        cursor: none !important;
      }
      
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes zoomFadeIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
    
    // 이벤트 리스너 등록
    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    // 애니메이션 시작
    requestRef.current = requestAnimationFrame(animateCursor);
    
    // 클린업 함수
    return () => {
      document.head.removeChild(style);
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [updateMousePosition, handleMouseDown, handleMouseUp, animateCursor]);
  
  return (
    <>
      {/* 메인 커서 (v0.5a 스타일 + v0.5b의 인터랙션) */}
      <div 
        ref={cursorRef}
        className="fixed rounded-full bg-white pointer-events-none z-[10000] will-change-transform"
        style={{
          width: isHovering ? `${CURSOR_CONFIG.sizes.hover.size}px` : `${CURSOR_CONFIG.sizes.normal.size}px`,
          height: isHovering ? `${CURSOR_CONFIG.sizes.hover.size}px` : `${CURSOR_CONFIG.sizes.normal.size}px`,
          left: isHovering ? `-${CURSOR_CONFIG.sizes.hover.offset}px` : `-${CURSOR_CONFIG.sizes.normal.offset}px`,
          top: isHovering ? `-${CURSOR_CONFIG.sizes.hover.offset}px` : `-${CURSOR_CONFIG.sizes.normal.offset}px`,
          transform: `translate(${mousePosition.current.x}px, ${mousePosition.current.y}px) scale(${isClicking ? 0.75 : 1})`,
          mixBlendMode: 'difference',
          transition: CURSOR_CONFIG.speed.transitionDuration === 0 ? 'none' : 
                     `width ${CURSOR_CONFIG.speed.transitionDuration}ms, 
                      height ${CURSOR_CONFIG.speed.transitionDuration}ms, 
                      left ${CURSOR_CONFIG.speed.transitionDuration}ms, 
                      top ${CURSOR_CONFIG.speed.transitionDuration}ms`
        }}
      />
      
      {/* 커서 텍스트 (버튼 이름 등 표시) */}
      {showText && (
        <div 
          className="fixed pointer-events-none z-[10000] text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-md transition-opacity duration-200"
          style={{
            left: mousePosition.current.x + 16,
            top: mousePosition.current.y + 8,
            opacity: showText ? 1 : 0
          }}
        >
          {cursorText}
        </div>
      )}
    </>
  );
};

// Parallax 요소 컴포넌트
const ParallaxElement: React.FC<{
  children: React.ReactNode;
  amount?: number;
  className?: string;
}> = ({ children, amount = 10, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const xPos = (clientX / window.innerWidth - 0.5) * amount;
      const yPos = (clientY / window.innerHeight - 0.5) * amount;
      
      // 성능 최적화: transform 속성 사용
      element.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [amount]);
  
  return (
    <div 
      ref={ref} 
      className={`transition-transform duration-500 will-change-transform ${className}`}
    >
      {children}
    </div>
  );
};

// 타이틀 글자 컴포넌트
const TitleLetter = React.forwardRef<HTMLSpanElement, TitleLetterProps>(
  ({ children, color }, ref) => {
    const [isPressed, setIsPressed] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const innerRef = useRef<HTMLSpanElement>(null);
    const letterRef = (ref as React.RefObject<HTMLSpanElement>) || innerRef;

    const colorClasses = {
      cyan: "text-cyan-400",
      yellow: "text-yellow-400",
      purple: "text-purple-400",
      green: "text-green-400",
      red: "text-red-400",
      blue: "text-blue-400",
    } as const;

    
    // 캐릭터와 충돌하면 isPressed를 true로 설정 (글자 하단 이동 효과)
    useEffect(() => {
      const checkCollision = (charRect: DOMRect) => {
        if (letterRef.current) {
          const letterRect = letterRef.current.getBoundingClientRect();
          const colliding =
            !(
              charRect.right < letterRect.left ||
              charRect.left > letterRect.right ||
              charRect.bottom < letterRect.top ||
              charRect.top > letterRect.bottom
            );
          setIsPressed(colliding);
        }
      };
      const handleCharacterMove = (e: Event) => {
        const customEvent = e as CustomEvent<{ charRect: DOMRect }>;
        if (customEvent.detail.charRect) {
          checkCollision(customEvent.detail.charRect);
        }
      };
      window.addEventListener("characterMove", handleCharacterMove);
      return () =>
        window.removeEventListener("characterMove", handleCharacterMove);
    }, [letterRef]);

    return (
      <span
        ref={letterRef}
        className={`
          obstacle 
          ${colorClasses[color as keyof typeof colorClasses]} 
          transition-all duration-300 
          text-6xl relative leading-none inline-block 
          font-baloo opacity-100 
          ${isPressed ? "transform translate-y-2" : ""}
        `}
        style={{
          transform: isHovered
            ? `scale(1.3) ${isPressed ? "translateY(0.5rem)" : ""}`
            : isPressed
            ? "translateY(0.5rem)"
            : "",
          transition: "transform 0.3s ease",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </span>
    );
  }
);

// 드래그 가능한 캐릭터 컴포넌트
const DraggableCharacter: React.FC<DraggableCharacterProps> = ({
  initialPos,
  onButtonActivate,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(
    initialPos || { x: window.innerWidth - 80, y: 100 }
  );
  const [isSqueezing, setIsSqueezing] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [isGlowing, setIsGlowing] = useState<boolean>(false);

  const posRef = useRef<{ x: number; y: number }>(pos);
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const characterRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const draggingRef = useRef<boolean>(false);
  const lastCollidedButton = useRef<string | null>(null);

  // 눈 움직임 관련 상수
  const EYE_CONSTANTS = {
    LEFT_EYE_X: 0.35,
    RIGHT_EYE_X: 0.65,
    EYE_Y: 0.4,
    LEFT_PUPIL_OFFSET: 0.926524,
    RIGHT_PUPIL_OFFSET: 0.879059,
    MAX_PUPIL_OFFSET: 2,
  };

  // 충돌 물리 파라미터
  const PHYSICS_PARAMS = {
    ground: { bounceFactor: 0.7, friction: 0.95, landingThreshold: 150 },
    obstacle: { bounceFactor: 0.7, friction: 0.98, landingThreshold: 200 },
  };
  const gravity = 2000;
  const bounceFactor = 0.7;

  // 주기적 애니메이션 효과 (제거)
  useEffect(() => {
    // 필요한 초기화만 수행
    return () => {};
  }, []);

  // 버튼과 충돌 시 효과 및 사운드 처리
  const handleCollisionWithButton = useCallback(
    (button: string, isCollidingFlag: boolean) => {
      // 캐릭터-버튼 충돌 효과가 비활성화된 경우 무시
      if (!MENU_BUTTON_CONFIG.characterCollision.enabled) return;
      
      const buttonElement = document.querySelector(
        `[data-menu-item="${button}"]`
      ) as HTMLElement | null;
      
      if (isCollidingFlag) {
        if (!lastCollidedButton.current) {
          SOUNDS.hover.play().catch(console.warn);
          
          // 햅틱 피드백 (모바일)
          if ('vibrate' in navigator) {
            navigator.vibrate(15);
          }
        }
        
        // 스케일 및 링 효과 적용
        if (buttonElement) {
          buttonElement.style.transform = `scale(${MENU_BUTTON_CONFIG.characterCollision.scaleAmount})`;
          
          if (MENU_BUTTON_CONFIG.characterCollision.ringEffect) {
            buttonElement?.classList.add("ring-4", "ring-white/50");
          }
          
          // 메뉴 버튼 내 아이콘 기울임 효과
          const icon = buttonElement?.querySelector("svg") as HTMLElement | null;
          if (icon) {
            icon.style.transform = "rotate(-10deg) scale(1.1)";
            icon.style.transition = "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
          }
        }
        
        if (onButtonActivate) onButtonActivate(button);
      } else {
        // 효과 제거
        if (buttonElement) {
          buttonElement.style.transform = "";
          
          if (MENU_BUTTON_CONFIG.characterCollision.ringEffect) {
            buttonElement?.classList.remove("ring-4", "ring-white/50");
          }
          
          const icon = buttonElement?.querySelector("svg") as HTMLElement | null;
          if (icon) {
            icon.style.transform = "";
          }
        }
      }
    },
    [onButtonActivate]
  );

  // native 이벤트에서 좌표 추출
  const getNativePointerCoords = (e: MouseEvent | TouchEvent): { x: number; y: number; movementX: number } => {
    if (e instanceof TouchEvent) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY, movementX: 0 };
    } else {
      return { x: e.clientX, y: e.clientY, movementX: e.movementX || 0 };
    }
  };

  // 물리 시뮬레이션 - 최적화 버전
  const physicsStep = useCallback((time: number) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      animationFrameRef.current = requestAnimationFrame(physicsStep);
      return;
    }
    
    // 시간 간격 제한 (안정성 향상)
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;
    
    if (!draggingRef.current) velocityRef.current.vy += gravity * dt;
    
    posRef.current.x += velocityRef.current.vx * dt;
    posRef.current.y += velocityRef.current.vy * dt;

    const charElem = characterRef.current;
    if (charElem) {
      const { width: charWidth, height: charHeight } = charElem.getBoundingClientRect();
      
      // 경계 충돌 처리
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
        if (Math.abs(velocityRef.current.vy) > 100)
          SOUNDS.land.play().catch(console.warn);
        posRef.current.y = window.innerHeight - charHeight;
        velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
      }
      
      // 충돌 검사: 최적화를 위해 현재 화면에 보이는 요소만 검사
      const charRect = charElem.getBoundingClientRect();
      const obstacles = document.querySelectorAll(".obstacle");
      
      let didCollide = false; // 이번 프레임에 충돌 발생 여부
      
      obstacles.forEach((obstacle) => {
        const obsElem = obstacle as HTMLElement;
        if (obsElem === charElem) return;
        
        // 화면에 보이는 요소만 충돌 확인 (성능 최적화)
        const obsRect = obsElem.getBoundingClientRect();
        if (
          obsRect.right < 0 ||
          obsRect.left > window.innerWidth ||
          obsRect.bottom < 0 ||
          obsRect.top > window.innerHeight
        ) {
          return;
        }
        
        if (isColliding(charRect, obsRect)) {
          didCollide = true;
          
          // 메뉴 버튼 충돌 처리
          if (obsElem.dataset.menuItem) {
            const buttonName = obsElem.dataset.menuItem;
            if (buttonName && buttonName !== lastCollidedButton.current) {
              handleCollisionWithButton(buttonName, true);
              lastCollidedButton.current = buttonName;
            }
          } else {
            if (lastCollidedButton.current) {
              handleCollisionWithButton(lastCollidedButton.current, false);
              lastCollidedButton.current = null;
            }
          }
          
          // 충돌 효과
          if (Math.abs(velocityRef.current.vy) > 100) {
            SOUNDS.land.play().catch(console.warn);
          }
          
          if (!obsElem.dataset.menuItem && obsElem.tagName === "DIV") {
            obsElem.classList.add("shake-piece", "glow-piece");
            setTimeout(() => obsElem.classList.remove("shake-piece", "glow-piece"), 500);
          }
          
          // 충돌 방향 계산 및 반응
          const overlapLeft = charRect.right - obsRect.left;
          const overlapRight = obsRect.right - charRect.left;
          const overlapTop = charRect.bottom - obsRect.top;
          const overlapBottom = obsRect.bottom - charRect.top;
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          
          const isLetterObstacle = (obsElem.textContent || "").trim().length === 1;
          const params = isLetterObstacle ? PHYSICS_PARAMS.obstacle : PHYSICS_PARAMS.ground;
          
          if (minOverlap === overlapTop) {
            let letterOffsetY = 0;
            if (isLetterObstacle) {
              const computedStyle = window.getComputedStyle(obsElem);
              const transform = computedStyle.transform;
              if (transform && transform !== "none") {
                try {
                  letterOffsetY = new DOMMatrix(transform).m42;
                } catch (e) {
                  if (obsElem.classList.contains("translate-y-2")) letterOffsetY = 8;
                }
              } else if (obsElem.classList.contains("translate-y-2")) {
                letterOffsetY = 8;
              }
            }
            
            if (Math.abs(velocityRef.current.vy) < params.landingThreshold) {
              posRef.current.y = obsRect.top - charHeight + letterOffsetY;
              velocityRef.current.vy = 0;
              velocityRef.current.vx *= params.friction;
              if (Math.abs(velocityRef.current.vx) < (isLetterObstacle ? 2 : 5))
                velocityRef.current.vx = 0;
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
        }
      });
      
      // 이번 프레임에 충돌하지 않았지만 이전에 버튼과 충돌한 경우, 버튼 상태 복원
      if (!didCollide && lastCollidedButton.current) {
        handleCollisionWithButton(lastCollidedButton.current, false);
        lastCollidedButton.current = null;
      }
      
      // 위치 상태 업데이트 (리렌더링)
      setPos({ x: posRef.current.x, y: posRef.current.y });
      
      // 캐릭터 위치 이벤트 발생
      window.dispatchEvent(
        new CustomEvent<{ charRect: DOMRect }>("characterMove", {
          detail: { charRect },
        })
      );
    }
    
    // 애니메이션 계속 필요한지 확인
    if (
      draggingRef.current ||
      Math.abs(velocityRef.current.vx) > 1 ||
      Math.abs(velocityRef.current.vy) > 1
    ) {
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [handleCollisionWithButton]);

  // React 이벤트용 좌표 추출
  const getPointerCoords = (
    e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>
  ): { x: number; y: number; movementX: number } => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY, movementX: 0 };
    } else {
      return {
        x: (e as ReactMouseEvent<HTMLDivElement>).clientX,
        y: (e as ReactMouseEvent<HTMLDivElement>).clientY,
        movementX: (e as ReactMouseEvent<HTMLDivElement>).movementX || 0,
      };
    }
  };

  // 드래그 시작 처리
  const handleDragStart = (
    e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    draggingRef.current = true;
    setIsSqueezing(true);
    
    // 햅틱 피드백 (모바일)
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
    
    // 기존 애니메이션 취소
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 드래그 오프셋 계산
    const { x, y } = getPointerCoords(e);
    const rect = characterRef.current?.getBoundingClientRect();
    if (rect) {
      offsetRef.current = { x: x - rect.left, y: y - rect.top };
    }
  };

  // 드래그 이동 처리
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    
    const { x, y, movementX } = getNativePointerCoords(e);
    
    // 마우스 이동에 따른 회전 효과
    if (e instanceof MouseEvent && movementX) {
      setRotation((prev) => Math.max(-30, Math.min(30, prev + movementX * 0.1)));
    }
    
    // 새 위치 계산 및 적용
    const newX = x - offsetRef.current.x;
    const newY = y - offsetRef.current.y;
    
    posRef.current = { x: newX, y: newY };
    setPos({ x: newX, y: newY });
  }, []);

  // 드래그 종료 처리
  const handleDragEnd = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      setIsSqueezing(false);
      setRotation(0);
      
      // 물리 시뮬레이션 재개
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    }
  }, [physicsStep]);

  // 눈동자 움직임 처리
  const handlePupilMovement = useCallback((e: MouseEvent) => {
    const charRect = characterRef.current?.getBoundingClientRect();
    if (!charRect) return;
    
    // 눈 중심 위치 계산
    const getEyeCenter = (eyeX: number) => ({
      x: charRect.left + charRect.width * eyeX,
      y: charRect.top + charRect.height * EYE_CONSTANTS.EYE_Y,
    });
    
    const leftEyeCenter = getEyeCenter(EYE_CONSTANTS.LEFT_EYE_X);
    const rightEyeCenter = getEyeCenter(EYE_CONSTANTS.RIGHT_EYE_X);
    
    // 눈동자 오프셋 계산
    const calcOffset = (center: { x: number; y: number }) => {
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
    
    // 눈동자 위치 적용
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
  }, []);

  // 키보드 조작 지원
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // 방향키 이동
      if (e.key === "ArrowLeft") {
        posRef.current.x = Math.max(0, posRef.current.x - 20);
        setPos({ ...posRef.current });
      } else if (e.key === "ArrowRight") {
        posRef.current.x = Math.min(window.innerWidth - 48, posRef.current.x + 20);
        setPos({ ...posRef.current });
      } else if (e.key === " " || e.key === "Spacebar") {
        // 스페이스바로 점프
        if (!draggingRef.current) {
          setIsSqueezing(true);
          velocityRef.current.vy = -800;
          velocityRef.current.vx += (Math.random() - 0.5) * 200;
          
          // 햅틱 피드백 (모바일)
          if ('vibrate' in navigator) {
            navigator.vibrate([15, 10, 15]);
          }
          
          SOUNDS.land.play().catch(console.warn);
          
          lastTimeRef.current = performance.now();
          animationFrameRef.current = requestAnimationFrame(physicsStep);
          setTimeout(() => setIsSqueezing(false), 300);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [physicsStep]);

  // 이벤트 리스너 등록
  useEffect(() => {
    window.addEventListener("mousemove", handlePupilMovement);
    window.addEventListener("mousemove", handleDragMove as EventListener);
    window.addEventListener("mouseup", handleDragEnd as EventListener);
    window.addEventListener("touchmove", handleDragMove as EventListener, { passive: false });
    window.addEventListener("touchend", handleDragEnd as EventListener);
    
    return () => {
      window.removeEventListener("mousemove", handlePupilMovement);
      window.removeEventListener("mousemove", handleDragMove as EventListener);
      window.removeEventListener("mouseup", handleDragEnd as EventListener);
      window.removeEventListener("touchmove", handleDragMove as EventListener);
      window.removeEventListener("touchend", handleDragEnd as EventListener);
    };
  }, [handlePupilMovement, handleDragMove, handleDragEnd]);

  // 클릭 시 점프
  const handleClick = () => {
    if (!draggingRef.current) {
      setIsSqueezing(true);
      velocityRef.current.vy = -800;
      velocityRef.current.vx += (Math.random() - 0.5) * 200;
      
      // 햅틱 피드백 (모바일)
      if ('vibrate' in navigator) {
        navigator.vibrate([15, 10, 15]);
      }
      
      SOUNDS.land.play().catch(console.warn);
      
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
      className={`absolute ${!draggingRef.current ? "animate-bounce" : ""}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: "3rem",
        height: "3rem",
        zIndex: 1000,
        transform: `rotate(${rotation}deg)`,
        transition: draggingRef.current ? "none" : "transform 0.3s ease",
      }}
      data-draggable="true"
      aria-label="드래그 가능한 캐릭터"
      tabIndex={0}
      role="button"
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
            @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
            @keyframes glow { 0%, 100% { filter: drop-shadow(0 0 2px #FFD700); } 50% { filter: drop-shadow(0 0 8px #FFD700); } }
            .blink { animation: blink 3s infinite; transform-origin: center; transform-box: fill-box; }
            .animate-bounce { animation: bounce 1s ease-in-out infinite; }
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
          <g transform="matrix(1.37111 0 0 2.052324 0 -0.428863)" className="blink">
            <g transform="translate(-4.334689 0)">
              <circle r="3" fill="#fff" />
              <circle id="leftPupil" r="1.5" transform="translate(0.926524 0)" fill="#333" />
            </g>
            <g transform="translate(4.334688 0)">
              <circle r="3" fill="#fff" />
              <circle id="rightPupil" r="1.5" transform="translate(0.879059 0)" fill="#333" />
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

// 사운드 컨트롤 컴포넌트
const SoundControl: React.FC = () => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  
  const toggleSound = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    // 햅틱 피드백 (모바일)
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
    
    // 모든 오디오 요소에 음소거 적용
    Object.values(SOUNDS).forEach((sound) => {
      sound.muted = newMuted;
    });
    
    // 토글 사운드 재생 (음소거 전환 시에도 들리도록)
    const sound = SOUNDS.hover.cloneNode() as HTMLAudioElement;
    sound.volume = 0.5;
    sound.play().catch(console.warn);
  };
  
  return (
    <button
      onClick={toggleSound}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        fixed bottom-4 right-4 p-3 
        bg-gray-800/50 hover:bg-gray-700/70
        rounded-full 
        transition-all duration-300 
        text-white/70 hover:text-white
        transform
        ${isHovered ? 'scale-110' : 'scale-100'}
        shadow-lg
      `}
      aria-label={isMuted ? "소리 켜기" : "소리 끄기"}
      style={{
        animation: 'fadeInUp 0.5s ease 0.8s both',
      }}
    >
      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
};

// 패턴 프리뷰 컴포넌트
const PatternPreview: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="relative w-full h-full">
        {/* 물고기 모양 패턴 */}
        <ParallaxElement amount={30} className="absolute right-32 top-1/4 opacity-20 transition-opacity duration-500 hover:opacity-40">
          <svg viewBox="0 0 100 60" className="w-16 h-16">
            <path
              d="M10,30 Q30,10 50,30 Q70,50 90,30 Q70,10 50,30 Q30,50 10,30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan-400"
            />
          </svg>
        </ParallaxElement>
        
        {/* 새 모양 패턴 */}
        <ParallaxElement amount={20} className="absolute left-32 bottom-1/4 opacity-20 transition-opacity duration-500 hover:opacity-40">
          <svg viewBox="0 0 100 100" className="w-16 h-16">
            <path
              d="M20,50 L50,20 L80,50 L50,80 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-400"
            />
          </svg>
        </ParallaxElement>
        
        {/* 추가 패턴: 별 모양 */}
        <ParallaxElement amount={15} className="absolute right-1/4 bottom-1/3 opacity-20 transition-opacity duration-500 hover:opacity-40">
          <svg viewBox="0 0 100 100" className="w-12 h-12">
            <path
              d="M50,10 L61,40 L94,40 L67,60 L78,90 L50,70 L22,90 L33,60 L6,40 L39,40 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-yellow-400"
            />
          </svg>
        </ParallaxElement>
      </div>
    </div>
  );
};

// 환경 감지 커스텀 훅
const useEnvironmentDetection = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isEvening, setIsEvening] = useState(false);
  
  useEffect(() => {
    // 다크모드 감지
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);
    
    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
    
    // 모바일 디바이스 감지
    const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mobileMediaQuery.matches);
    
    const handleMobileChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    
    mobileMediaQuery.addEventListener('change', handleMobileChange);
    
    // 시간대 감지 (저녁/밤)
    const currentHour = new Date().getHours();
    setIsEvening(currentHour >= 18 || currentHour < 6);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
      mobileMediaQuery.removeEventListener('change', handleMobileChange);
    };
  }, []);
  
  return { isDarkMode, isMobile, isEvening };
};

/* --- 메인 컴포넌트 --- */
const SevenDropsTitle: React.FC = () => {
  const [hoveredButton, setHoveredButton] = useState<number | null>(null);
  const [characterInitialPos, setCharacterInitialPos] = useState<{ x: number; y: number } | null>(null);
  const [parallaxOffset, setParallaxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const letterSRef = useRef<HTMLSpanElement>(null);
  
  // 환경 감지 훅 사용
  const { isDarkMode, isMobile, isEvening } = useEnvironmentDetection();

  // Tangram 조각 정의
  const tangramPieces: { color: string; style: React.CSSProperties }[] = [
    {
      color: "bg-cyan-500",
      style: {
        width: isMobile ? "3rem" : "4rem",
        height: isMobile ? "3rem" : "4rem",
        clipPath: "polygon(0 0, 100% 0, 50% 100%)",
      },
    },
    {
      color: "bg-yellow-500",
      style: { 
        width: isMobile ? "3rem" : "4rem", 
        height: isMobile ? "3rem" : "4rem", 
        clipPath: "none" 
      },
    },
    {
      color: "bg-purple-500",
      style: {
        width: isMobile ? "2.5rem" : "3rem",
        height: isMobile ? "2.5rem" : "3rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-green-500",
      style: {
        width: isMobile ? "3rem" : "4rem",
        height: isMobile ? "2.5rem" : "3rem",
        clipPath: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)",
      },
    },
    {
      color: "bg-red-500",
      style: {
        width: isMobile ? "4rem" : "5rem",
        height: isMobile ? "4rem" : "5rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-blue-500",
      style: {
        width: isMobile ? "4rem" : "5rem",
        height: isMobile ? "4rem" : "5rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-pink-500",
      style: {
        width: isMobile ? "3rem" : "4rem",
        height: isMobile ? "3rem" : "4rem",
        clipPath: "polygon(0 0, 100% 50%, 0 100%)",
      },
    },
  ];

  // 캐릭터 초기 위치 설정 (S 글자 위치 기준)
  useEffect(() => {
    if (letterSRef.current && !isLoading) {
      const rect = letterSRef.current.getBoundingClientRect();
      setCharacterInitialPos({
        x: rect.left + (rect.width - 48) / 2,
        y: rect.top - 48,
      });
    }
  }, [isLoading, letterSRef.current]);

  // 사운드 초기화 및 BGM 자동 재생
  useEffect(() => {
    initializeSounds();
    
    // 리소스 준비 시간 설정
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // 로딩 완료 후 사용자 상호작용 시 BGM 재생
  useEffect(() => {
    if (!isLoading) {
      const playBgm = () => {
        playSound(SOUNDS.bgm);
        document.removeEventListener("click", playBgm);
      };
      document.addEventListener("click", playBgm, { once: true });
    }
  }, [isLoading]);

  // 폰트 및 애니메이션 CSS 로드
  useEffect(() => {
    // 구글 폰트 로드
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap';
    fontLink.rel = 'stylesheet';
    
    document.head.appendChild(fontLink);
    
    // 애니메이션 및 글꼴 스타일 설정
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .font-baloo {
        font-family: 'Fredoka One', cursive;
      }
      
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes zoomFadeIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      
      .shake-piece {
        animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
      }
      
      .glow-piece {
        animation: glow 0.5s ease-in-out;
      }
      
      @keyframes glow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.5); }
      }
      
      .animate-bounce {
        animation: bounce 1s ease-in-out infinite;
      }
    `;
    document.head.appendChild(styleSheet);
    
    // 언마운트 시 제거
    return () => {
      document.head.removeChild(fontLink);
      document.head.removeChild(styleSheet);
    };
  }, []);
  
  // 로딩 완료 처리
  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  // 버튼 활성화 처리
  const handleButtonActivate = (btn: string) => {
    console.log("Button activated:", btn);
    
    // 햅틱 피드백 (모바일)
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
  };

  // 메뉴 버튼 스타일 계산
  const getButtonStyle = (color: string, isHovered: boolean): React.CSSProperties => {
    const colorConfig = MENU_BUTTON_CONFIG.colors[color as keyof typeof MENU_BUTTON_CONFIG.colors];
    
    const style: React.CSSProperties = {
      backgroundColor: isHovered ? colorConfig.hover : colorConfig.background,
      borderColor: colorConfig.border,
      animation: `fadeInUp 0.5s ease ${0.5}s both`,
    };
    
    // 호버링 효과 적용
    if (MENU_BUTTON_CONFIG.hover.enabled && isHovered) {
      style.transform = `scale(${MENU_BUTTON_CONFIG.hover.scaleAmount})`;
    }
    
    return style;
  };

  // 배경 스타일 (시간대/다크모드에 따라 적용)
  const getBgStyle = () => {
    if (isEvening) {
      return 'bg-gradient-to-b from-gray-900 via-indigo-900 to-gray-900';
    }
    if (isDarkMode) {
      return 'bg-gradient-to-b from-gray-900 to-gray-800';
    }
    return 'bg-gradient-to-b from-gray-800 to-gray-900';
  };

  // 메뉴 버튼 정의
  const menuButtons: {
    icon: React.ComponentType<{ size: number }>;
    text: string;
    color: string;
    onClick: () => void;
    ariaLabel: string;
  }[] = [
    {
      icon: Play,
      text: "게임 시작",
      color: "cyan",
      onClick: () => {
        /* 게임 시작 기능 */
        if ('vibrate' in navigator) {
          navigator.vibrate([15, 30, 15]);
        }
      },
      ariaLabel: "게임 시작 버튼",
    },
    {
      icon: Trophy,
      text: "챌린지",
      color: "purple",
      onClick: () => {
        /* 챌린지 기능 */
        if ('vibrate' in navigator) {
          navigator.vibrate([15, 30, 15]);
        }
      },
      ariaLabel: "챌린지 모드 버튼",
    },
    {
      icon: Settings,
      text: "환경설정",
      color: "settings",
      onClick: () => {
        /* 환경설정 기능 */
        if ('vibrate' in navigator) {
          navigator.vibrate([15, 30, 15]);
        }
      },
      ariaLabel: "환경설정 버튼", 
    },
  ];

  return (
    <>
      {/* 커스텀 커서 */}
      <CustomCursor />
      
      {/* 로딩 화면 */}
      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} />}
      
      {/* Tangram 애니메이션 CSS */}
      <style>{`
      @keyframes rotateAndFade {
        0% { transform: translate(var(--translateX, 0px), var(--translateY, 0px)) rotate(0deg); opacity: 0.2; }
        50% { transform: translate(var(--translateX, 0px), var(--translateY, 0px)) rotate(180deg); opacity: 0.8; }
        100% { transform: translate(var(--translateX, 0px), var(--translateY, 0px)) rotate(360deg); opacity: 0.2; }
      }
      .tangram { animation: rotateAndFade 8s linear infinite !important; }
      .tangram:hover { opacity: 0.9; transition: opacity 0.3s ease; }
    `}</style>
      
      {/* 메인 컨테이너 */}
      <div 
        className={`h-screen w-full ${getBgStyle()} flex flex-col items-center justify-center relative overflow-hidden`}
        aria-label="7Drops 게임 타이틀 화면"
      >
        {/* 패턴 프리뷰 */}
        <PatternPreview />
        
        {/* 떠다니는 Tangram 조각 */}
        {!isLoading && tangramPieces.map((piece, index) => (
          <div
            key={index}
            className={`absolute obstacle tangram ${piece.color} transition-all duration-300 animate-zoomFade`}
            style={{
              ...piece.style,
              left: `${Math.random() * 80 + 10}%`,
              top: `${Math.random() * 80 + 10}%`,
              animationDelay: `${index * -2}s`,
              "--translateX": `${parallaxOffset.x}px`,
              "--translateY": `${parallaxOffset.y}px`,
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.1), rgba(0,0,0,0.1))",
              animation: `rotateAndFade 8s linear infinite, zoomFadeIn 0.5s ease ${index * 0.1 + 0.2}s both`,
            } as React.CSSProperties}
            aria-hidden="true"
          />
        ))}

        {/* 타이틀 */}
        <div className="relative mb-16 animate-zoomFade" style={{ animationDelay: '0.3s' }}>
          <h1 
            className="font-baloo font-bold mb-12 tracking-widest flex items-center justify-center gap-1 relative z-10"
            aria-label="7Drops"
          >
            <TitleLetter color="cyan" index={0} >7</TitleLetter>
            <TitleLetter color="yellow" index={1} >D</TitleLetter>
            <TitleLetter color="purple" index={2} >R</TitleLetter>
            <TitleLetter color="green" index={3} >O</TitleLetter>
            <TitleLetter color="red" index={4} >P</TitleLetter>
            <TitleLetter ref={letterSRef} color="blue" index={5} >S</TitleLetter>
          </h1>
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-lg blur opacity-10" />
        </div>

        {/* 메뉴 버튼 */}
        <div className="flex flex-col gap-4 w-64 relative z-10">
          {!isLoading && menuButtons.map((btn, index) => (
            <button
              key={index}
              data-menu-item={btn.text}
              className={`
                obstacle
                text-white/85
                backdrop-blur-sm
                py-4 px-6 
                rounded-lg 
                flex items-center 
                justify-center 
                gap-2 
                transform 
                shadow-lg 
                border
                focus:outline-none focus:ring-2 focus:ring-white/50
                font-baloo
              `}
              style={{
                ...getButtonStyle(btn.color, hoveredButton === index),
                transition: `transform ${MENU_BUTTON_CONFIG.hover.transitionDuration}ms, background-color ${MENU_BUTTON_CONFIG.hover.transitionDuration}ms`,
              }}
              onMouseEnter={() => {
                setHoveredButton(index);
                setParallaxOffset({ x: 5, y: 5 }); // 더 작은 패럴랙스 효과
                playSound(SOUNDS.hover);
              }}
              onMouseLeave={() => {
                setHoveredButton(null);
                setParallaxOffset({ x: 0, y: 0 });
              }}
              onClick={btn.onClick}
              aria-label={btn.ariaLabel}
              tabIndex={0}
            >
              <btn.icon size={24} />
              <span className="font-semibold">{btn.text}</span>
            </button>
          ))}
        </div>

        {/* 드래그 가능한 캐릭터 */}
        {!isLoading && characterInitialPos && isReady && (
          <DraggableCharacter
            initialPos={characterInitialPos}
            onButtonActivate={handleButtonActivate}
          />
        )}

        {/* 사운드 토글 */}
        {!isLoading && <SoundControl />}
      </div>
    </>
  );
};

export default SevenDropsTitle;