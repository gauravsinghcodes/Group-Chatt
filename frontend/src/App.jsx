import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { connectWS } from './ws';

export default function App() {
  const timer = useRef(null);
  const socket = useRef(null);
  const [userName, setUserName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showConfigPopup, setShowConfigPopup] = useState(true);
  const [inputName, setInputName] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [typers, setTypers] = useState([]);
  const [members, setMembers] = useState([]); // { phone, isOnline }
  const [userRooms, setUserRooms] = useState([]); 

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showRoomsSidebar, setShowRoomsSidebar] = useState(false);
  const [showMembersSidebar, setShowMembersSidebar] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4600/api';

  useEffect(() => {
    if (!roomId || !phoneNumber) return;

    socket.current = connectWS();

    socket.current.on('connect', () => {
      socket.current.emit('joinRoom', { roomId, phone: phoneNumber, userName });

      socket.current.on('roomNotice', (uName) => {
        console.log(`${uName} joined to group!`);
      });

      socket.current.on('chatMessage', (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.current.on('typing', (uName) => {
        setTypers((prev) => {
          if (!prev.includes(uName)) return [...prev, uName];
          return prev;
        });
      });

      socket.current.on('stopTyping', (uName) => {
        setTypers((prev) => prev.filter((typer) => typer !== uName));
      });

      socket.current.on('userListUpdate', (userList) => {
        setMembers(userList);
      });

      socket.current.on('error', (err) => {
        alert(err);
        setShowConfigPopup(true);
      });
    });

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_BASE}/rooms/${roomId}/messages`);
        setMessages(res.data);
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    };

    fetchMessages();

    return () => {
      if (socket.current) {
        socket.current.off('roomNotice');
        socket.current.off('chatMessage');
        socket.current.off('typing');
        socket.current.off('stopTyping');
        socket.current.off('userListUpdate');
        socket.current.off('error');
      }
    };
  }, [roomId, phoneNumber, userName]);

  useEffect(() => {
    if (text && roomId) {
      socket.current.emit('typing', { roomId, userName });
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      if (roomId) socket.current.emit('stopTyping', { roomId, userName });
    }, 1000);

    return () => {
      clearTimeout(timer.current);
    };
  }, [text, userName, roomId]);

  // FORMAT TIMESTAMP TO HH:MM FOR MESSAGES
  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // SUBMIT NAME TO GET STARTED, OPEN CHAT WINDOW WITH INITIAL MESSAGE
  async function handleCreateRoom(e) {
    e.preventDefault();
    const name = inputName.trim();
    const phone = inputPhone.trim();
    const rName = inputRoomId.trim();
    if (!name || !phone || !rName) return;
    try {
      const res = await axios.post(`${API_BASE}/rooms`, { 
        name: rName, 
        phone,
        userName: name
      });
      setRoomId(res.data.roomId);
      setRoomName(res.data.name);
      setUserName(name);
      setPhoneNumber(phone);
      setShowConfigPopup(false);
    } catch (err) {
      alert('Failed to create room');
    }
  }

  async function handleJoinRoom(e) {
    e.preventDefault();
    const name = inputName.trim();
    const phone = inputPhone.trim();
    const rId = inputRoomId.trim();
    if (!name || !phone || !rId) return;
    try {
      const res = await axios.post(`${API_BASE}/rooms/join`, { 
        roomId: rId, 
        phone,
        userName: name
      });
      setRoomId(res.data.roomId);
      setRoomName(res.data.name);
      setUserName(name);
      setPhoneNumber(phone);
      setShowConfigPopup(false);
    } catch (err) {
      alert('Failed to join room. Make sure ID is correct.');
    }
  }

  async function fetchUserRooms(phone) {
    try {
      const res = await axios.get(`${API_BASE}/users/${phone}/rooms`);
      setUserRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch user rooms', err);
    }
  }

  function switchRoom(room) {
    setRoomId(room.roomId);
    setRoomName(room.name);
    setShowRoomsSidebar(false); // Close sidebar on mobile after switch
  }

  useEffect(() => {
    if (phoneNumber) {
      fetchUserRooms(phoneNumber);
    }
  }, [phoneNumber, roomId]); // Refetch when joining/creating a new room

  // SEND MESSAGE FUNCTION
  function sendMessage() {
    const t = text.trim();
    if (!t || !roomId) return;

    const msg = {
      id: Date.now(),
      roomId,
      sender: userName,
      phone: phoneNumber,
      text: t,
      ts: Date.now(),
    };
    setMessages((m) => [...m, msg]);

    socket.current.emit('chatMessage', msg);
    setText('');
  }

  // HANDLE ENTER KEY TO SEND MESSAGE
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4 font-inter">
      {showConfigPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-40 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h1 className="text-xl font-semibold text-black">Welcome to Group Chat</h1>
            <p className="text-sm text-gray-500 mt-1">
              Enter details to start chatting.
            </p>
            <div className="mt-4 space-y-4">
              <input
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 outline-green-500 placeholder-gray-400"
                placeholder="Your name"
              />
              <input
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 outline-green-500 placeholder-gray-400"
                placeholder="Phone number"
              />
              <input
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 outline-green-500 placeholder-gray-400"
                placeholder="Room ID or New Room Name"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoom}
                  className="flex-1 px-4 py-2 rounded-full bg-blue-500 text-white font-medium">
                  Create Room
                </button>
                <button
                  onClick={handleJoinRoom}
                  className="flex-1 px-4 py-2 rounded-full bg-green-500 text-white font-medium">
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHAT WINDOW */}
      {!showConfigPopup && (
        <div className="w-full max-w-6xl h-screen md:h-[90vh] bg-white rounded-none md:rounded-2xl shadow-2xl flex overflow-hidden border border-zinc-200">
          {/* ROOMS SIDEBAR */}
          <div className={`${showRoomsSidebar ? 'flex' : 'hidden'} lg:flex absolute lg:static inset-0 z-30 w-full lg:w-64 border-r border-gray-100 bg-white flex-col`}>
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                My Rooms
              </div>
              <button onClick={() => setShowRoomsSidebar(false)} className="lg:hidden text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {userRooms.map((r) => (
                <button
                  key={r.roomId}
                  onClick={() => switchRoom(r)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    r.roomId === roomId 
                      ? 'bg-green-50 text-green-700 font-semibold border-l-4 border-green-500 shadow-sm' 
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    r.roomId === roomId ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left truncate text-sm">
                    {r.name}
                  </div>
                  {r.roomId === roomId && (
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                  )}
                </button>
              ))}
              <button 
                onClick={() => setShowConfigPopup(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 text-blue-500 text-sm font-medium transition-colors border border-dashed border-blue-200 mt-4"
              >
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-lg">+</div>
                Join New Room
              </button>
            </div>
          </div>

          {/* MAIN CHAT AREA */}
          <div className="flex-1 flex flex-col relative bg-zinc-50 min-w-0">
            {/* CHAT HEADER */}
            <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 bg-white border-b border-gray-100 shadow-sm z-10">
              <button 
                onClick={() => setShowRoomsSidebar(true)}
                className="lg:hidden p-2 hover:bg-zinc-100 rounded-lg text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-green-500 to-[#075E54] flex items-center justify-center text-white font-bold shadow-md shrink-0">
                {roomName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm md:text-base font-bold text-gray-800 truncate">
                  {roomName}
                </div>
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-[9px] md:text-[10px] py-0.5 px-2 bg-zinc-100 text-zinc-500 rounded-full font-mono shrink-0">
                    ID: {roomId}
                  </span>
                  {typers.length > 0 && (
                    <span className="text-[10px] md:text-xs text-green-500 font-medium animate-pulse truncate">
                      {typers.join(', ')} typing...
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1 md:py-1.5 bg-zinc-50 rounded-full border border-zinc-100">
                <div className="hidden sm:block text-xs font-medium text-gray-600 truncate max-w-[80px]">
                   {userName}
                </div>
                <div className="h-6 w-6 rounded-full bg-green-100 text-[#075E54] flex items-center justify-center text-[10px] font-bold shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
              
              <button 
                onClick={() => setShowMembersSidebar(true)}
                className="xl:hidden p-2 hover:bg-zinc-100 rounded-lg text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </button>
            </div>

            {/* MESSAGE LIST */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
              {messages.map((m) => {
                const mine = m.phone === phoneNumber;
                return (
                  <div
                    key={m.id || m._id}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div
                      className={`max-w-[85%] md:max-w-[75%] p-3 md:p-4 rounded-2xl text-sm shadow-sm transition-all duration-300 ${mine
                          ? 'bg-[#00A884] text-white rounded-tr-none'
                          : 'bg-white text-gray-800 rounded-tl-none border border-zinc-100'
                        }`}>
                      {!mine && (
                         <div className="text-[10px] font-bold text-green-600 mb-1">{m.sender}</div>
                      )}
                      <div className="break-words leading-relaxed whitespace-pre-wrap">
                        {m.text}
                      </div>
                      <div className={`text-[9px] mt-2 text-right opacity-60 font-medium`}>
                        {formatTime(m.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* INPUT AREA */}
            <div className="px-3 md:px-6 py-3 md:py-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2 md:gap-3 p-1 bg-zinc-50 rounded-2xl border border-zinc-200 ring-offset-2 focus-within:ring-2 ring-green-500 transition-all">
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent resize-none px-3 md:px-4 py-2 md:py-3 text-sm outline-none placeholder-zinc-400"
                />
                <button
                  onClick={sendMessage}
                  className="bg-[#00A884] hover:bg-[#008f6f] text-white h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 -rotate-45 relative left-0.5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* MEMBERS SIDEBAR */}
          <div className={`${showMembersSidebar ? 'flex' : 'hidden'} xl:flex absolute xl:static inset-0 z-30 w-full xl:w-72 border-l border-gray-100 bg-white flex-col`}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 text-sm">Room Members</h3>
                <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  {members.filter(m => m.isOnline).length}
                </span>
              </div>
              <button onClick={() => setShowMembersSidebar(false)} className="xl:hidden text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {members.map((m) => (
                <div key={m.phone} className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-50 transition-all border border-transparent hover:border-zinc-100">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-600 flex items-center justify-center text-sm font-bold shadow-inner">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${m.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-300'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5 truncate">
                      {m.name}
                      {m.phone === phoneNumber && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-bold uppercase transition-all whitespace-nowrap">You</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-medium font-mono">
                      {m.phone}
                    </div>
                    <div className={`text-[10px] mt-0.5 font-semibold ${m.isOnline ? 'text-green-500' : 'text-zinc-400'}`}>
                      {m.isOnline ? 'Active Now' : 'Last seen recently'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}