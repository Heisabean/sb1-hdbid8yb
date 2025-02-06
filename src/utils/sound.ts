export const SOUNDS = {
    land: new Audio('/sounds/effects/soft-land.mp3'),        // 부드러운 착지음
    collision: new Audio('/sounds/effects/piece-hit.mp3'),     // 조각 충돌음
    hover: new Audio('/sounds/effects/menu-hover.mp3'),        // 메뉴 호버음
    click: new Audio('/sounds/effects/menu-select.mp3'),       // 메뉴 선택음
    bgm: new Audio('/sounds/music/calm-puzzle.mp3')            // 잔잔한 배경음악
  };
  
  // 볼륨 및 페이드 인/아웃 설정
  Object.values(SOUNDS).forEach(sound => {
    sound.volume = 0.6;  // 기본 볼륨 60%
  });
  SOUNDS.bgm.loop = true;
  SOUNDS.bgm.volume = 0.3;  // BGM은 30% 볼륨  