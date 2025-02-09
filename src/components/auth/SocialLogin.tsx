import React from "react";

interface SocialLoginProps {
  // 로그인 성공 시 호출할 콜백 (타이틀 화면 등에서 모달 닫기 등 처리)
  onSuccess?: () => void;
}

const SocialLogin: React.FC<SocialLoginProps> = ({ onSuccess }) => {
  const handleLogin = () => {
    console.log("Social login clicked");
    // 실제 구현 시 소셜 로그인 API 호출 및 성공 처리 후 onSuccess 실행
    if (onSuccess) onSuccess();
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 text-white">소셜 로그인 스텁 컴포넌트</p>
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Login with Social Account
      </button>
    </div>
  );
};

export default SocialLogin;
