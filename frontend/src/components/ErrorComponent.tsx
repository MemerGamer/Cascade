import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorComponent({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center max-w-md w-full">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-red-400 mb-4">
          Something went wrong
        </h1>
        <p className="text-slate-400 mb-6 text-sm bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono overflow-auto max-h-32">
          {error.message || "An unexpected error occurred"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.invalidate()}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <Link
            to="/"
            className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
