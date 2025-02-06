#!/bin/bash

# src 루트 디렉토리 생성
mkdir -p src

# assets 폴더 및 하위 디렉토리 생성
mkdir -p src/assets/{sounds/{effects,music},images,patterns,animations}

# components 폴더 및 하위 디렉토리 생성
mkdir -p src/components/{game,common,effects}

# core 폴더 및 하위 디렉토리 생성
mkdir -p src/core/{physics,patterns}

# config 폴더 생성
mkdir -p src/config

# hooks 폴더 생성
mkdir -p src/hooks

# store 폴더 생성
mkdir -p src/store

# services 폴더 생성
mkdir -p src/services

# types 폴더 생성
mkdir -p src/types

# utils 폴더 생성
mkdir -p src/utils

# ----------------------------
# 파일 생성 (빈 파일로 생성)

# assets: (이미 폴더들만 생성하면 됨)

# components/game
touch src/components/game/Board.tsx \
      src/components/game/Block.tsx \
      src/components/game/NextBlock.tsx \
      src/components/game/PatternGuide.tsx \
      src/components/game/ScoreBoard.tsx \
      src/components/game/GameContainer.tsx \
      src/components/game/Tutorial.tsx \
      src/components/game/Achievements.tsx

# components/common
touch src/components/common/Button.tsx \
      src/components/common/Modal.tsx \
      src/components/common/Icons.tsx

# components/effects
touch src/components/effects/ParticleEffect.tsx \
      src/components/effects/Animation.tsx

# core/physics
touch src/core/physics/engine.ts \
      src/core/physics/collision.ts

# core/patterns
touch src/core/patterns/matcher.ts \
      src/core/patterns/templates.ts

# config
touch src/config/constants.ts \
      src/config/themes.ts \
      src/config/gameConfig.ts \
      src/config/physics.ts \
      src/config/patterns.ts

# hooks
touch src/hooks/useGameLoop.ts \
      src/hooks/usePatternDetect.ts \
      src/hooks/useBlockControl.ts \
      src/hooks/useScore.ts \
      src/hooks/usePhysics.ts \
      src/hooks/usePatternMatch.ts \
      src/hooks/useAudio.ts \
      src/hooks/useAnimation.ts \
      src/hooks/useTutorial.ts

# store
touch src/store/gameState.ts \
      src/store/userSettings.ts \
      src/store/patternCollection.ts \
      src/store/achievements.ts

# services
touch src/services/storage.ts \
      src/services/analytics.ts \
      src/services/api.ts \
      src/services/leaderboard.ts \
      src/services/error.ts \
      src/services/metrics.ts

# types
touch src/types/Block.ts \
      src/types/Pattern.ts \
      src/types/Game.ts \
      src/types/Physics.ts \
      src/types/Achievement.ts \
      src/types/User.ts

# utils
touch src/utils/patterns.ts \
      src/utils/collision.ts \
      src/utils/scoring.ts \
      src/utils/sound.ts \
      src/utils/animations.ts \
      src/utils/constants.ts \
      src/utils/localStorage.ts \
      src/utils/validation.ts

echo "프로젝트 기본 디렉토리와 파일 생성 완료!"
