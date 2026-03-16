import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  members: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  sender: { type: String, required: true }, // Name or phone number
  phone: { type: String }, // Phone number for identification
  text: { type: String, required: true },
  ts: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Messages expire after 24 hours (86400 seconds)
});

export const Room = mongoose.model('Room', roomSchema);
export const Message = mongoose.model('Message', messageSchema);
