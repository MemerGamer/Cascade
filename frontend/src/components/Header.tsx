import { Link } from "@tanstack/react-router";
import { authClient } from "../auth/authClient";

export default function Header() {
  const { data: session } = authClient.useSession();

  return (
    <header className="p-4 flex items-center justify-between bg-slate-900 text-white border-b border-slate-800">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
        >
          Cascade
        </Link>
      </div>

      {session && (
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{session.user.email}</span>
          <button
            onClick={() => authClient.signOut()}
            className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
