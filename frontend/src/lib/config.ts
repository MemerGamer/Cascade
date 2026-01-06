const getApiUrl = (port: number, serviceName: string) => {
  // Browser / Client Side
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost") {
      return ""; // Use relative path (Ingress)
    }
    return `http://localhost:${port}`; // Local development
  }

  // Server Side (SSR)
  if (import.meta.env.PROD) {
    return `http://${serviceName}:${port}`; // Internal K8s Service DNS
  }
  return `http://localhost:${port}`; // Local development
};

export const API_URLS = {
  AUTH: import.meta.env.VITE_AUTH_URL || getApiUrl(3001, "cascade-auth"),
  BOARD_COMMAND:
    import.meta.env.VITE_BOARD_COMMAND_URL ||
    getApiUrl(3002, "cascade-board-command"),
  BOARD_QUERY:
    import.meta.env.VITE_BOARD_QUERY_URL ||
    getApiUrl(3003, "cascade-board-query"),
};
