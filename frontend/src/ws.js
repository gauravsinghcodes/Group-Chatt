import { io } from 'socket.io-client';

export function connectWS() {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4600';
    return io(socketUrl);
}