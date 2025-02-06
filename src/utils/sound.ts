// sound.ts
import calmPuzzle from '../assets/sounds/music/calm-puzzle.mp3';
import softLand from '../assets/sounds/effects/soft-land.mp3';
import pieceHit from '../assets/sounds/effects/piece-hit.mp3';
import menuHover from '../assets/sounds/effects/menu-hover.mp3';
import menuSelect from '../assets/sounds/effects/menu-select.mp3';

export const SOUNDS = {
  land: new Audio(softLand),
  collision: new Audio(pieceHit),
  hover: new Audio(menuHover),
  click: new Audio(menuSelect),
  bgm: new Audio(calmPuzzle)
};

// 볼륨 및 기본 설정
Object.values(SOUNDS).forEach(sound => {
  sound.volume = 0.6;  // 기본 볼륨 60%
});

SOUNDS.bgm.loop = true;
SOUNDS.bgm.volume = 0.3;  // BGM은 30% 볼륨

// 사운드 초기화 함수 추가
export const initializeSounds = async () => {
  try {
    await Promise.all(
      Object.values(SOUNDS).map(async (sound) => {
        try {
          // 사운드 로드 확인
          await sound.load();
          // 잠깐 재생했다가 멈추기 (브라우저 정책 대응)
          await sound.play();
          sound.pause();
          sound.currentTime = 0;
        } catch (err) {
          console.warn('Sound initialization error:', err);
        }
      })
    );
    console.log('Sounds initialized successfully');
  } catch (err) {
    console.error('Failed to initialize sounds:', err);
  }
};

// 사운드 재생 헬퍼 함수
export const playSound = (sound: HTMLAudioElement) => {
  sound.currentTime = 0; // 재생 위치 초기화
  return sound.play().catch(err => {
    console.warn('Sound play failed:', err);
  });
};