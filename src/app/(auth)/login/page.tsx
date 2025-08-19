import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-black">
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0"
      >
        <source src="/video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay to slightly darken video */}
      <div className="fixed inset-0 bg-black/50 z-0"></div>

      {/* Glass-effect login box */}
      <div className="relative z-10 w-full max-w-sm p-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl shadow-lg">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
