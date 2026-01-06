import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center max-w-md w-full">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🤔</span>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
          Page Not Found
        </h1>
        <p className="text-slate-400 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block w-full py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
