import { createServer } from 'node:http';
import express from 'express';
import { Server } from "socket.io";
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import connectDB from './db.js';
import { Room, Message } from './models.js';

// Connect to Database
await connectDB();
console.log('Database operation ready');

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Map to track online users: socketId -> { roomId, phone, userName }
const onlineUsers = new Map();

async function broadcastUserList(roomId) {
  try {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    // Get phone numbers of users currently online in this room
    const onlinePhonesInRoom = Array.from(onlineUsers.values())
      .filter(u => u.roomId === roomId)
      .map(u => u.phone);

    // Prepare list of all members with their status
    const memberList = room.members.map(member => {
      const isString = typeof member === 'string';
      const phone = isString ? member : member.phone;
      const name = isString ? member : (member.name || member.phone);
      
      return {
        name,
        phone,
        isOnline: onlinePhonesInRoom.includes(phone)
      };
    });

    io.to(roomId).emit('userListUpdate', memberList);
  } catch (err) {
    console.error('Error broadcasting user list:', err);
  }
}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  socket.on('joinRoom', async ({ roomId, phone, userName }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      // Safe check for membership handling both strings and objects
      const memberExists = room.members.find(m => {
        if (typeof m === 'string') return m === phone;
        return m.phone === phone;
      });

      if (!memberExists) {
        socket.emit('error', 'Not a member of this room');
        return;
      }

      await socket.join(roomId);
      
      // Track online user
      onlineUsers.set(socket.id, { roomId, phone, userName });
      console.log(`${userName} (${phone}) joined room ${roomId}`);

      socket.to(roomId).emit('roomNotice', userName);
      
      // Update everyone in the room with the new user list
      await broadcastUserList(roomId);
    } catch (err) {
      console.error(err);
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('disconnect', async () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      const { roomId, userName } = user;
      onlineUsers.delete(socket.id);
      console.log(`${userName} disconnected from room ${roomId}`);
      
      // Update everyone in the room
      await broadcastUserList(roomId);
    }
  });

  socket.on('chatMessage', async (msg) => {
    try {
      const { roomId, sender, phone, text, ts } = msg;
      
      // Persist to DB
      const newMessage = new Message({ roomId, sender, phone, text, ts });
      await newMessage.save();

      socket.to(roomId).emit('chatMessage', msg);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('typing', ({ roomId, userName }) => {
    socket.to(roomId).emit('typing', userName);
  });

  socket.on('stopTyping', ({ roomId, userName }) => {
    socket.to(roomId).emit('stopTyping', userName);
  });
});

// API Routes
app.post('/api/rooms', async (req, res) => {
  const { name, phone, userName } = req.body; // userName is the creator's name
  const roomId = uuidv4().substring(0, 8);
  try {
    const room = new Room({ 
      roomId, 
      name, 
      members: [{ phone, name: userName }] 
    });
    await room.save();
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.post('/api/rooms/join', async (req, res) => {
  try {
    const { roomId, phone, userName } = req.body;
    console.log(`[JOIN] Request: roomId="${roomId}", user="${userName}", phone="${phone}"`);
    
    if (!roomId || !phone || !userName) {
      console.log('[JOIN] Error: Missing fields');
      return res.status(400).json({ error: 'Missing name, phone or room ID' });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      console.log(`[JOIN] Error: Room not found: ${roomId}`);
      return res.status(404).json({ error: 'Room not found' });
    }

    // Ensure members is an array (safety for legacy data issues)
    if (!Array.isArray(room.members)) {
      console.log('[JOIN] Warning: members was not an array, initializing...');
      room.members = [];
    }

    // Check membership safely
    const alreadyMember = room.members.find(m => {
      if (typeof m === 'string') return m === phone.trim();
      if (m && typeof m === 'object') return m.phone === phone.trim();
      return false;
    });

    if (!alreadyMember) {
      console.log(`[JOIN] Adding new member: ${userName}`);
      room.members.push({ phone: phone.trim(), name: userName.trim() });
      room.markModified('members'); // Crucial for Mixed types in Mongoose
      await room.save();
    } else {
      console.log(`[JOIN] Member already exists: ${phone}`);
    }

    res.json(room);
  } catch (err) {
    console.error('[JOIN] FATAL ERROR:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.get('/api/users/:phone/rooms', async (req, res) => {
  const { phone } = req.params;
  try {
    // Search for rooms where any member's phone matches
    const rooms = await Room.find({
      'members.phone': phone.trim()
    });
    res.json(rooms);
  } catch (err) {
    console.error('[MY ROOMS] Error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.get('/api/rooms/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;
  try {
    const messages = await Message.find({ roomId }).sort({ ts: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

const PORT = process.env.PORT || 4600;
server.listen(PORT, () => {
  console.log(`server running at http://localhost:${PORT}`);
});








