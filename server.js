// ...existing code...
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
app.use(cors({
	origin: "http://localhost:5173",
	methods: ["GET", "POST"],
	credentials: true
}));
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: process.env.URL || "*", // Allow configured URL or all origins as fallback
		methods: ["GET", "POST"],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"]
	},
});

// Serve static files directly from root directory
app.use(express.static(__dirname));

// Import and initialize game socket logic

// --- Multiplayer Game Logic (from gameSocket.js) ---
// If you want to keep database saving, add this at the top:
// const Game = require("./models/Game");

const paragraphs = [
	"The quick brown fox jumps over the lazy dog.",
	"Typing speed is a useful skill for programmers.",
	"Socket.IO enables real-time communication.",
	"Practice makes perfect in every typing race."
];

const rooms = {};

function getRandomParagraph() {
	return paragraphs[Math.floor(Math.random() * paragraphs.length)];
}

function calculateSpeed(wpm, acc) {
	if (wpm < 10 || acc < 0.5) return 0;
	const accFactor = Math.pow(acc, 2.2);
	const wpmFactor = Math.min(wpm / 100, 2.0);
	return wpmFactor * accFactor * 2.0;
}

io.on("connection", (socket) => {
	console.log("Player connected:", socket.id);

	socket.on("join-game", ({ roomId, name }) => {
    console.log("Joining...");
		if (!/^[A-Z]{2}[0-9]{2}$/.test(roomId)) {
			socket.emit("error-message", "Room ID must be 2 letters + 2 numbers (e.g. AB12).");
			console.log("Invalid room ID:", roomId , name);
			return;
		}
		if (!name || rooms[roomId]?.some(p => p.name === name)) {
			socket.emit("error-message", "Name is required and must be unique in the room.");
			return;
		}
		if (!rooms[roomId]) rooms[roomId] = [];
		// If room already exists, reset any leftover stats from previous unfinished games
		if (rooms[roomId].length > 0) {
			rooms[roomId].forEach(p => {
				p.progress = 0;
				p.wpm = 0;
				p.acc = 1;
				p.speed = 0;
				p.ready = false;
			});
		}
		if (rooms[roomId].length >= 4) {
			socket.emit("error-message", "Room is full (max 4 players)." );
			return;
		}
		rooms[roomId].push({
			name,
			progress: 0,
			wpm: 0,
			acc: 1,
			speed: 0,
			socketId: socket.id,
			ready: false,
		});
		socket.join(roomId);
		io.to(roomId).emit("player-list", rooms[roomId]);
	});

	// Allow clients to explicitly leave a room (clean up state immediately)
	socket.on("leave-game", ({ roomId, name }) => {
		const arr = rooms[roomId];
		if (!arr) return;
		const idx = arr.findIndex(p => p.socketId === socket.id || p.name === name);
		if (idx !== -1) {
			arr.splice(idx, 1);
		}
		socket.leave(roomId);
		if (arr.length === 0) {
			delete rooms[roomId];
		} else {
			io.to(roomId).emit("player-list", arr);
		}
	});

	socket.on("player-ready", ({ roomId, name }) => {
		const player = rooms[roomId]?.find(p => p.name === name);
		if (player) {
			player.ready = true;
			io.to(roomId).emit("player-list", rooms[roomId]);
		}
	});

	socket.on("start-game", ({ roomId }) => {
		if (rooms[roomId] && rooms[roomId].length > 0 && rooms[roomId].every(p => p.ready)) {
			const paragraph = getRandomParagraph();
			rooms[roomId].forEach(p => { p.progress = 0; p.ready = false; });
			io.to(roomId).emit("game-start", { paragraph });
		} else {
			socket.emit("error-message", "All players must be ready to start the game.");
		}
	});

	socket.on("progress-update", ({ roomId, name, progress, speed }) => {
		// console.log("Progress update:", roomId, name, progress, speed, rooms);
		const player = rooms[roomId]?.find(p => p.name == name);
		// console.log("Out player", name, player, rooms, roomId);
		if (player) {
			// console.log("In player");
			player.progress = progress;
			// player.wpm = wpm;
			// player.acc = acc;
			player.speed = speed;
			// Broadcast updated stats to all players in the room
			io.to(roomId).emit("leaderboard-update", { players: rooms[roomId], ts: Date.now() });
		}
	});

	socket.on("game-over", ({ roomId, winner }) => {
		io.to(roomId).emit("game-over", { winner });
		// If you want to save to database, uncomment below:
		// const Game = require("./models/Game");
		// const game = new Game({
		//   roomId,
		//   players: rooms[roomId],
		//   paragraph: "", // Optional: store actual paragraph
		//   winner,
		// });
		// game.save();
	});

	socket.on("disconnect", () => {
		for (const roomId in rooms) {
			const idx = rooms[roomId].findIndex(p => p.socketId === socket.id);
			if (idx !== -1) {
				rooms[roomId].splice(idx, 1);
				if (rooms[roomId].length === 0) {
					delete rooms[roomId];
				} else {
					io.to(roomId).emit("player-list", rooms[roomId]);
				}
			}
		}
	});
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running at http://0.0.0.0:${PORT} (accessible on your network)`);
});