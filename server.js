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

// Connect to MongoDB with error handling
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

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
        if (!username) {
            return socket.emit('error', 'Username is required');
        }
        onlineUsers[socket.id] = username;
        io.emit('users', Object.values(onlineUsers)); // Broadcast online users
    });

    // Handle messages
    socket.on('sendMessage', async (data) => {
        const { sender, recipient, message } = data;

        if (!sender || !recipient || !message) {
            return socket.emit('error', 'Sender, recipient, and message are required');
        }

        try {
            // Save message to DB
            const newMessage = new Message({ sender, recipient, message });
            await newMessage.save();

            // Find recipient socket ID
            const recipientSocketId = Object.keys(onlineUsers).find(
                (key) => onlineUsers[key] === recipient
            );

            // Send message to recipient
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('receiveMessage', data);
            } else {
                console.log(`Recipient ${recipient} not online`);
            }
        } catch (error) {
            console.error('Error saving message:', error);
            socket.emit('error', 'Failed to send message');
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
