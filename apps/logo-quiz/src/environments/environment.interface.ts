interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export interface Environment {
  production: boolean;
  apiUrl: string;
  webSocketUrl?: string; // API Gateway WebSocket URL (optional - falls back to Socket.io if not set)
  firebase: FirebaseConfig;
}
