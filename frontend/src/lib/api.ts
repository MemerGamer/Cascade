import { API_URLS } from "./config";

// Types
export interface Column {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Member {
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface Board {
  _id: string;
  name: string;
  description?: string;
  ownerId: string;
  visibility: "public" | "private";
  joinPin?: string;
  members: Member[];
  columns: Column[];
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  _id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  tags: string[];
  priority: "low" | "medium" | "high";
  dueDate?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ============ BOARD ENDPOINTS ============

export async function getBoards(
  ownerId: string
): Promise<{ success: boolean; boards: Board[] }> {
  const res = await fetch(
    `${API_URLS.BOARD_QUERY}/api/boards?ownerId=${ownerId}`
  );
  if (!res.ok) throw new Error("Failed to fetch boards");
  return res.json();
}

export async function getPublicBoards(): Promise<{
  success: boolean;
  boards: Board[];
}> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/boards/public`);
  if (!res.ok) throw new Error("Failed to fetch public boards");
  return res.json();
}

export async function getBoard(
  id: string
): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(`${API_URLS.BOARD_QUERY}/api/boards/${id}`);
  if (!res.ok) throw new Error("Failed to fetch board");
  return res.json();
}

export async function createBoard(data: {
  name: string;
  description?: string;
  ownerId: string;
  visibility?: "public" | "private";
}): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create board");
  return res.json();
}

export async function updateBoard(
  id: string,
  data: { name?: string; description?: string }
): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/boards/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update board");
  return res.json();
}

export async function deleteBoard(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/boards/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete board");
  return res.json();
}

export async function joinBoard(
  id: string,
  userId: string,
  pin?: string
): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/boards/${id}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, pin }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to join board");
  }
  return res.json();
}

// ============ COLUMN ENDPOINTS ============

export async function addColumn(
  boardId: string,
  data: { name: string; color?: string }
): Promise<{ success: boolean; column: Column; board: Board }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/boards/${boardId}/columns`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error("Failed to add column");
  return res.json();
}

export async function updateColumn(
  boardId: string,
  colId: string,
  data: { name?: string; color?: string; order?: number }
): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/boards/${boardId}/columns/${colId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error("Failed to update column");
  return res.json();
}

export async function deleteColumn(
  boardId: string,
  colId: string
): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/boards/${boardId}/columns/${colId}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok) throw new Error("Failed to delete column");
  return res.json();
}

// ============ TAG ENDPOINTS ============

export async function addTag(
  boardId: string,
  data: { name: string; color?: string }
): Promise<{ success: boolean; tag: Tag; board: Board }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/boards/${boardId}/tags`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error("Failed to add tag");
  return res.json();
}

export async function deleteTag(
  boardId: string,
  tagId: string
): Promise<{ success: boolean; board: Board }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/boards/${boardId}/tags/${tagId}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok) throw new Error("Failed to delete tag");
  return res.json();
}

// ============ TASK ENDPOINTS ============

export async function getTasks(
  boardId: string
): Promise<{ success: boolean; tasks: Task[] }> {
  const res = await fetch(
    `${API_URLS.BOARD_QUERY}/api/boards/${boardId}/tasks`
  );
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function createTask(data: {
  boardId: string;
  columnId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  tags?: string[];
  priority?: "low" | "medium" | "high";
  dueDate?: string;
}): Promise<{ success: boolean; task: Task }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string;
    columnId?: string;
    assignedTo?: string | null;
    tags?: string[];
    priority?: "low" | "medium" | "high";
    dueDate?: string | null;
    order?: number;
  }
): Promise<{ success: boolean; task: Task }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URLS.BOARD_COMMAND}/api/tasks/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete task");
  return res.json();
}

export async function moveTask(
  taskId: string,
  columnId: string,
  order?: number
): Promise<{ success: boolean; task: Task }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/tasks/${taskId}/move`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, order }),
    }
  );
  if (!res.ok) throw new Error("Failed to move task");
  return res.json();
}

export async function reorderTask(
  taskId: string,
  columnId: string,
  order: number
): Promise<{ success: boolean; task: Task }> {
  const res = await fetch(
    `${API_URLS.BOARD_COMMAND}/api/tasks/${taskId}/reorder`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, order }),
    }
  );
  if (!res.ok) throw new Error("Failed to reorder task");
  return res.json();
}
