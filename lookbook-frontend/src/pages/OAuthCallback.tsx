import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { refreshSession } from "../services/authService";
import { useAuth } from "../hooks/useAuth";
import Loader from "../components/common/Loader";

// Google/GitHub redirect the browser back here after the backend has already
// set the httpOnly refresh cookie. All this page does is call the normal
// silent-refresh flow to pick up an access token and the signed-in user.
const OAuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    refreshSession()
      .then((user) => {
        setUser(user);
        const destination = !user
          ? "/login"
          : user.preferences?.onboardingCompleted
            ? "/profile"
            : "/onboarding";
        navigate(destination, { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="bg-[#F5F2EA] min-h-[80vh]">
      <Loader fullScreen label="Signing you in..." />
    </section>
  );
};

export default OAuthCallback;
