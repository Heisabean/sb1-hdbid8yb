import { useState, useEffect } from "react";

// 간단한 스텁: 현재 로그인 상태를 관리합니다.
// 실제 구현 시에는 인증 API 호출 등으로 교체하면 됩니다.
export const useAuth = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // 테스트용: 초기에는 로그인되지 않은 상태로 둡니다.
    // 나중에 실제 인증 로직에 따라 user 객체를 설정하세요.
    setUser(null);
  }, []);

  return { user };
};
