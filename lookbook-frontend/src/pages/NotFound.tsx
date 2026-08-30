import { BookX } from "lucide-react";
import EmptyState from "../components/ui/EmptyState";

const NotFound = () => {
  return (
    <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center">
      <div className="w-full">
        <EmptyState
          icon={BookX}
          title="404 — Page Not Found"
          description="The page you're looking for has been misplaced, much like a library book."
          actionLabel="Back to Home"
          actionTo="/"
        />
      </div>
    </section>
  );
};

export default NotFound;
