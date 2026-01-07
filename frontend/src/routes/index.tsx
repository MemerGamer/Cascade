import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "../auth/authClient";
import { useState, useEffect } from "react";
import {
  getBoards,
  getPublicBoards,
  createBoard,
  deleteBoard,
  joinBoard,
  type Board,
} from "../lib/api";
import {
  Plus,
  Layout,
  Loader2,
  Trash2,
  Globe,
  Lock,
  Users,
  Key,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: App });

function App() {
  const { data: session, isPending } = authClient.useSession();
  const [boards, setBoards] = useState<Board[]>([]);
  const [publicBoards, setPublicBoards] = useState<Board[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinBoardId, setJoinBoardId] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [showJoinPrivateModal, setShowJoinPrivateModal] = useState(false);
  const [privateJoinBoardId, setPrivateJoinBoardId] = useState("");
  const [privateJoinPin, setPrivateJoinPin] = useState("");
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");

  useEffect(() => {
    if (session?.user?.id) {
      loadBoards();
      loadPublicBoards();
    }
  }, [session]);

  async function loadBoards() {
    if (!session?.user?.id) return;
    try {
      const res = await getBoards(session.user.id);
      setBoards(res.boards);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadPublicBoards() {
    try {
      const res = await getPublicBoards();
      setPublicBoards(res.boards);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteBoard(e: React.MouseEvent, boardId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this board?")) return;
    try {
      await deleteBoard(boardId);
      setBoards(boards.filter((b) => b._id !== boardId));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleJoinBoard(boardId: string, isPrivate: boolean) {
    if (!session?.user?.id) return;

    if (isPrivate) {
      setJoinBoardId(boardId);
      setShowJoinModal(true);
      return;
    }

    try {
      await joinBoard(boardId, session.user.id);
      loadBoards();
      loadPublicBoards();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleJoinWithPin() {
    if (!session?.user?.id || !joinBoardId) return;
    try {
      await joinBoard(joinBoardId, session.user.id, joinPin);
      setShowJoinModal(false);
      setJoinPin("");
      setJoinBoardId("");
      loadBoards();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleJoinPrivateBoard() {
    if (
      !session?.user?.id ||
      !privateJoinBoardId.trim() ||
      !privateJoinPin.trim()
    )
      return;
    try {
      await joinBoard(privateJoinBoardId, session.user.id, privateJoinPin);
      setShowJoinPrivateModal(false);
      setPrivateJoinBoardId("");
      setPrivateJoinPin("");
      loadBoards();
      alert("Successfully joined board!");
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin w-8 h-8 text-cyan-500" />
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  const myBoards = boards.filter((b) =>
    b.members?.some((m) => m.userId === session.user.id)
  );
  const joinablePublicBoards = publicBoards.filter(
    (b) => !b.members?.some((m) => m.userId === session.user.id)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
              Dashboard
            </h1>
            <p className="text-slate-400">Manage your projects and tasks</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinPrivateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium transition-colors"
            >
              <Key className="w-4 h-4" /> Join Private Board
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" /> New Board
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("my")}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === "my"
                ? "text-cyan-400 border-b-2 border-cyan-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            My Boards ({myBoards.length})
          </button>
          <button
            onClick={() => setActiveTab("public")}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === "public"
                ? "text-cyan-400 border-b-2 border-cyan-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Public Boards ({joinablePublicBoards.length})
          </button>
        </div>

        {activeTab === "my" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {myBoards.map((board) => (
              <Link
                to="/boards/$boardId"
                params={{ boardId: board._id }}
                key={board._id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 hover:shadow-xl hover:shadow-cyan-900/10 transition-all group block relative"
              >
                <button
                  title="Delete Board"
                  onClick={(e) => handleDeleteBoard(e, board._id)}
                  className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-cyan-500/10 group-hover:text-cyan-400 transition-colors">
                    <Layout className="w-5 h-5" />
                  </div>
                  {board.visibility === "public" ? (
                    <Globe className="w-4 h-4 text-green-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-100 group-hover:text-white">
                  {board.name}
                </h3>
                <p className="text-sm text-slate-500 mb-2">
                  {board.members?.length || 0} member
                  {board.members?.length !== 1 ? "s" : ""}
                </p>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
                  Created {new Date(board.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {joinablePublicBoards.map((board) => (
              <div
                key={board._id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    <Layout className="w-5 h-5" />
                  </div>
                  <Globe className="w-4 h-4 text-green-400" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-100">
                  {board.name}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  <Users className="w-4 h-4 inline mr-1" />
                  {board.members?.length || 0} member
                  {board.members?.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => handleJoinBoard(board._id, false)}
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
                >
                  Join Board
                </button>
              </div>
            ))}
            {joinablePublicBoards.length === 0 && (
              <p className="text-slate-500 col-span-full text-center py-12">
                No public boards available to join
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create Board Modal */}
      {showCreateModal && session && (
        <CreateBoardModal
          userId={session.user.id}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            setTimeout(loadBoards, 500);
          }}
        />
      )}

      {/* Join with PIN Modal (for pub boards clicked from list) */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5" /> Enter PIN
            </h2>
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-cyan-500"
              value={joinPin}
              onChange={(e) =>
                setJoinPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinPin("");
                }}
                className="flex-1 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinWithPin}
                disabled={joinPin.length !== 6}
                className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Private Board Modal */}
      {showJoinPrivateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Key className="w-5 h-5" /> Join Private Board
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                  Board ID
                </label>
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                  value={privateJoinBoardId}
                  onChange={(e) => setPrivateJoinBoardId(e.target.value)}
                  placeholder="67890abcdef12345"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                  6-Digit PIN
                </label>
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-cyan-500"
                  value={privateJoinPin}
                  onChange={(e) =>
                    setPrivateJoinPin(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowJoinPrivateModal(false);
                  setPrivateJoinBoardId("");
                  setPrivateJoinPin("");
                }}
                className="flex-1 py-3 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinPrivateBoard}
                disabled={
                  !privateJoinBoardId.trim() || privateJoinPin.length !== 6
                }
                className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                Join Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateBoardModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      await createBoard({ name, ownerId: userId, visibility });
      onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-white mb-6">
          Create New Board
        </h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
              Board Name
            </label>
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`flex-1 p-4 rounded-lg border transition-all ${
                  visibility === "private"
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <Lock
                  className={`w-5 h-5 mb-2 ${visibility === "private" ? "text-cyan-400" : "text-slate-400"}`}
                />
                <div className="font-medium text-white">Private</div>
                <div className="text-xs text-slate-500 mt-1">
                  Join with 6-digit PIN
                </div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`flex-1 p-4 rounded-lg border transition-all ${
                  visibility === "public"
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <Globe
                  className={`w-5 h-5 mb-2 ${visibility === "public" ? "text-cyan-400" : "text-slate-400"}`}
                />
                <div className="font-medium text-white">Public</div>
                <div className="text-xs text-slate-500 mt-1">
                  Anyone can join
                </div>
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex-1 py-3 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Create Board"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Cascade
          </h1>
          <p className="text-slate-400">Microservices-based Task Management</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0],
        });
      } else {
        await authClient.signIn.email({
          email,
          password,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubSignIn() {
    try {
      await authClient.signIn.social({
        provider: "github",
      });
    } catch (err) {
      console.error(err);
      alert("Error: " + (err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Email
        </label>
        <input
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          type="email"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Password
        </label>
        <input
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
          required
        />
      </div>

      <button
        className="mt-2 w-full bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white p-3 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : isSignUp ? (
          "Create Account"
        ) : (
          "Sign In"
        )}
      </button>

      <div className="relative flex items-center gap-2 py-2">
        <div className="flex-1 border-t border-slate-800"></div>
        <span className="text-xs text-slate-500 uppercase">Or</span>
        <div className="flex-1 border-t border-slate-800"></div>
      </div>

      <button
        type="button"
        onClick={handleGitHubSignIn}
        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white p-3 rounded-lg font-medium transition-all active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-github-icon lucide-github"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
        Continue with GitHub
      </button>

      <button
        type="button"
        className="text-slate-400 hover:text-cyan-400 text-sm transition-colors"
        onClick={() => setIsSignUp(!isSignUp)}
      >
        {isSignUp
          ? "Already have an account? Sign In"
          : "Don't have an account? Sign Up"}
      </button>
    </form>
  );
}
