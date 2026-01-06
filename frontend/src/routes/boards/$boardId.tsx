import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getBoard,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  addColumn,
  deleteColumn,
  addTag,
  type Board,
  type Task,
  type Tag,
} from "../../lib/api";
import { Loader2, Plus, ArrowLeft, Trash2, Tag as TagIcon } from "lucide-react";
import TaskModal from "../../components/TaskModal";
import { authClient } from "../../auth/authClient";

export const Route = createFileRoute("/boards/$boardId")({
  component: BoardDetail,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  },
});

// Sortable Task Card
function SortableTaskCard({
  task,
  boardTags,
  onClick,
}: {
  task: Task;
  boardTags: Tag[];
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const taskTags = boardTags.filter((t) => task.tags?.includes(t.id));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-sm group hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-900/20 transition-all cursor-grab active:cursor-grabbing"
    >
      <h3 className="font-medium mb-2 text-slate-200">{task.title}</h3>

      {taskTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: tag.color + "30", color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-slate-500 mt-2 pt-2 border-t border-slate-800">
        <span
          className={`px-1.5 py-0.5 rounded ${
            task.priority === "high"
              ? "bg-red-500/20 text-red-400"
              : task.priority === "medium"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-green-500/20 text-green-400"
          }`}
        >
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="font-mono">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// Task Card for Drag Overlay
function TaskCard({ task }: { task: Task }) {
  return (
    <div className="bg-slate-900 border border-cyan-500 p-4 rounded-lg shadow-xl shadow-cyan-900/30">
      <h3 className="font-medium text-slate-200">{task.title}</h3>
    </div>
  );
}

// Droppable Column Container
function DroppableColumn({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 space-y-3 min-h-[200px] rounded-lg transition-colors ${isOver ? "bg-cyan-500/10 ring-2 ring-cyan-500/30" : ""}`}
    >
      {children}
    </div>
  );
}

function BoardDetail() {
  const { boardId } = Route.useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const loadData = useCallback(async () => {
    try {
      const [boardRes, tasksRes] = await Promise.all([
        getBoard(boardId),
        getTasks(boardId),
      ]);
      setBoard(boardRes.board);
      setTasks(tasksRes.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateTask(e: React.FormEvent, columnId: string) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsCreatingTask(true);
    try {
      await createTask({ boardId, columnId, title: newTaskTitle });
      setNewTaskTitle("");
      setTimeout(loadData, 300);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleUpdateTask(updates: Partial<Task>) {
    if (!editingTask) return;
    await updateTask(editingTask._id, updates);
    setTimeout(loadData, 300);
  }

  async function handleDeleteTask() {
    if (!editingTask) return;
    await deleteTask(editingTask._id);
    setTimeout(loadData, 300);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t._id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Find if dropped over a column or task
    const column = board?.columns.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t._id === overId);

    const targetColumnId = column ? column.id : overTask?.columnId;
    if (!targetColumnId) return;

    const movedTask = tasks.find((t) => t._id === activeTaskId);
    if (!movedTask || (movedTask.columnId === targetColumnId && !overTask))
      return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t._id === activeTaskId ? { ...t, columnId: targetColumnId } : t
      )
    );

    try {
      await moveTask(activeTaskId, targetColumnId);
    } catch (err) {
      console.error(err);
      loadData();
    }
  }

  async function handleAddColumn() {
    if (!newColumnName.trim() || !board) return;
    try {
      await addColumn(boardId, { name: newColumnName });
      setNewColumnName("");
      setShowNewColumn(false);
      setTimeout(loadData, 300);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteColumn(colId: string) {
    if (!board || board.columns.length <= 1) return;
    if (
      !confirm("Delete this column? Tasks will be moved to the first column.")
    )
      return;
    try {
      await deleteColumn(boardId, colId);
      setTimeout(loadData, 300);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddTag() {
    if (!newTagName.trim()) return;
    try {
      await addTag(boardId, { name: newTagName });
      setNewTagName("");
      setShowNewTag(false);
      setTimeout(loadData, 300);
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin w-8 h-8 text-cyan-500" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        Board not found
      </div>
    );
  }

  const columns = board.columns.sort((a, b) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-full mx-auto h-full flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center text-slate-400 hover:text-cyan-400 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {board.name}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  {board.visibility === "public" ? "🌐 Public" : "🔒 Private"}
                  {board.joinPin && (
                    <span className="ml-2">
                      • PIN:{" "}
                      <span className="font-mono text-cyan-400">
                        {board.joinPin}
                      </span>
                    </span>
                  )}
                  <span className="ml-2">
                    • ID:{" "}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(board._id);
                        alert("Board ID copied!");
                      }}
                      className="font-mono text-cyan-400 hover:underline hover:text-cyan-300 transition-colors"
                      title="Click to copy"
                    >
                      {board._id}
                    </button>
                  </span>
                  {" • "}
                  {tasks.length} Tasks
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewTag(!showNewTag)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                >
                  <TagIcon className="w-4 h-4" /> Add Tag
                </button>
                <button
                  onClick={() => setShowNewColumn(!showNewColumn)}
                  className="flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Column
                </button>
              </div>
            </div>

            {/* Tags Bar */}
            {board.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {board.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: tag.color + "30",
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* New Tag Form */}
            {showNewTag && (
              <div className="mt-4 flex gap-2 items-center">
                <input
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowNewTag(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Columns */}
          <div className="flex gap-6 overflow-x-auto pb-4 flex-1">
            {columns.map((col) => {
              const columnTasks = tasks
                .filter((t) => t.columnId === col.id)
                .sort((a, b) => a.order - b.order);

              return (
                <div
                  key={col.id}
                  className="w-80 flex-shrink-0 rounded-xl border border-slate-800 p-4 flex flex-col min-h-[500px]"
                  style={{ backgroundColor: col.color + "10" }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold text-slate-300 uppercase tracking-wider text-xs flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      {col.name}
                      <span className="bg-slate-800 text-slate-400 py-0.5 px-2 rounded-full">
                        {columnTasks.length}
                      </span>
                    </h2>
                    {columns.length > 1 && (
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <SortableContext
                    items={columnTasks.map((t) => t._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableColumn id={col.id}>
                      {columnTasks.map((task) => (
                        <SortableTaskCard
                          key={task._id}
                          task={task}
                          boardTags={board.tags}
                          onClick={() => setEditingTask(task)}
                        />
                      ))}
                    </DroppableColumn>
                  </SortableContext>

                  {/* Add Task Form */}
                  <form
                    onSubmit={(e) => handleCreateTask(e, col.id)}
                    className="mt-4 pt-4 border-t border-slate-700/50"
                  >
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-white placeholder-slate-600"
                        placeholder="Add a task..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                      />
                      <button
                        disabled={isCreatingTask || !newTaskTitle.trim()}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {isCreatingTask ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}

            {/* New Column Form */}
            {showNewColumn && (
              <div className="w-80 flex-shrink-0 rounded-xl border border-dashed border-slate-700 p-4 flex flex-col items-center justify-center min-h-[200px]">
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Column name"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddColumn}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium"
                  >
                    Add Column
                  </button>
                  <button
                    onClick={() => setShowNewColumn(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} /> : null}
      </DragOverlay>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          boardTags={board.tags}
          onClose={() => setEditingTask(null)}
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
    </DndContext>
  );
}
