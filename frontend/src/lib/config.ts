export const API_URLS = {
  AUTH: import.meta.env.VITE_AUTH_URL || "http://localhost:3001",
  BOARD_COMMAND:
    import.meta.env.VITE_BOARD_COMMAND_URL || "http://localhost:3002",
  BOARD_QUERY: import.meta.env.VITE_BOARD_QUERY_URL || "http://localhost:3003",
};
