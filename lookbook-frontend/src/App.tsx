import Navbar from "./components/common/Navbar";
import Footer from "./components/common/Footer";
import AppRoutes from "./routes/AppRoutes";
import ChatAssistant from "./components/common/ChatAssistant";
import RouteTracker from "./components/common/RouteTracker";

function App() {
  return (
    <>
      <RouteTracker />
      <Navbar />
      <AppRoutes />
      <Footer />
      {/* AI Chat Assistant (§3.3) — globally mounted, only visible when logged in */}
      <ChatAssistant />
    </>
  );
}

export default App;
