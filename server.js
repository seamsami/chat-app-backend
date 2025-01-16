const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'));

// Message Schema
const messageSchema = new mongoose.Schema({
    sender: String,
    recipient: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

let onlineUsers = {}; // Store online users

// Handle Socket.IO Connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Register a new user
    socket.on('newUser', (username) => {
        onlineUsers[socket.id] = username;
        io.emit('users', Object.values(onlineUsers)); // Broadcast online users
    });

    // Handle messages
    socket.on('sendMessage', (data) => {
        const { sender, recipient, message } = data;

        // Save message to DB
        const newMessage = new Message({ sender, recipient, message });
        newMessage.save();

        // Find recipient socket ID
        const recipientSocketId = Object.keys(onlineUsers).find(
            (key) => onlineUsers[key] === recipient
        );

        // Send message to recipient
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('receiveMessage', data);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('users', Object.values(onlineUsers)); // Update online users
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
