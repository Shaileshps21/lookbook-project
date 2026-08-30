import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { FacebookIcon, InstagramIcon, TwitterIcon } from "./SocialIcons";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setJoined(true);
    setEmail("");
  };

  return (
    <footer className="relative overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_35%)] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <BookOpen className="text-amber-500" size={26} />
              <h2 className="text-3xl font-bold text-white">LookBook</h2>
            </div>

            <p className="mt-5 text-slate-300 max-w-sm leading-8">
              Discover, Rent, Buy and Sell books through a modern platform built for
              passionate readers, students and lifelong learners.
            </p>

            <div className="mt-8">
              <p className="text-sm font-medium text-slate-200 mb-3">Join our reader community</p>

              <form onSubmit={handleJoin} className="flex max-w-sm">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-l-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 outline-none"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-r-xl transition"
                >
                  Join
                </button>
              </form>
              {joined && <p className="text-amber-400 text-sm mt-2">Thanks for joining! 🎉</p>}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-5">Explore</h3>
            <ul className="space-y-3">
              <li><Link to="/categories" className="text-slate-400 hover:text-amber-400 transition">Browse Books</Link></li>
              <li><Link to="/categories" className="text-slate-400 hover:text-amber-400 transition">Categories</Link></li>
              <li><Link to="/plans" className="text-slate-400 hover:text-amber-400 transition">Membership Plans</Link></li>
              <li><Link to="/rent" className="text-slate-400 hover:text-amber-400 transition">Rent A Book</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-5">Resources</h3>
            <ul className="space-y-3">
              <li><span className="text-slate-400 hover:text-amber-400 transition cursor-pointer">About Us</span></li>
              <li><span className="text-slate-400 hover:text-amber-400 transition cursor-pointer">Contact Us</span></li>
              <li><span className="text-slate-400 hover:text-amber-400 transition cursor-pointer">Help & FAQ</span></li>
              <li><span className="text-slate-400 hover:text-amber-400 transition cursor-pointer">Privacy Policy</span></li>
              <li><Link to="/developers" className="text-slate-400 hover:text-amber-400 transition">Public API</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-5">Account</h3>
            <ul className="space-y-3">
              <li><Link to="/login" className="text-slate-400 hover:text-amber-400 transition">Login</Link></li>
              <li><Link to="/register" className="text-slate-400 hover:text-amber-400 transition">Register</Link></li>
              <li><Link to="/sell" className="text-slate-400 hover:text-amber-400 transition">Sell Books</Link></li>
              <li><Link to="/profile" className="text-slate-400 hover:text-amber-400 transition">Rental History</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-5">
            <p className="text-slate-400 text-center">© 2026 LookBook. All Rights Reserved.</p>

            <div className="flex gap-5">
              <a href="#" className="text-slate-400 hover:text-amber-400 transition"><InstagramIcon size={22} /></a>
              <a href="#" className="text-slate-400 hover:text-amber-400 transition"><FacebookIcon size={22} /></a>
              <a href="#" className="text-slate-400 hover:text-amber-400 transition"><TwitterIcon size={22} /></a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
