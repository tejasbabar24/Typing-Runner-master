// Single-player Lobby Logic (no sockets)
const lobby = document.getElementById("lobby");
const status = document.getElementById("status");
const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCode");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const inputEl = document.getElementById("input");
const banner = document.getElementById("banner");
const waitingRoom = document.getElementById("waitingRoom");
const playerListDiv = document.getElementById("playerList");
const startBtn = document.getElementById("startBtn");

// let myName = "";
// let myRoom = "";
let playerName = "";
// let playerList = [];
// let playerStates = {};

function generateRoomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  return (
    letters.charAt(Math.floor(Math.random() * letters.length)) +
    letters.charAt(Math.floor(Math.random() * letters.length)) +
    digits.charAt(Math.floor(Math.random() * digits.length)) +
    digits.charAt(Math.floor(Math.random() * digits.length))
  );
}

// createBtn.addEventListener("click", () => {
//   const name = playerNameInput.value.trim();
//   if (!name) return (status.textContent = "Please enter your name.");
//   const room = generateRoomCode();
//   myName = name;
//   myRoom = room;
//   status.textContent = `Creating room...`;
//   roomCodeDisplay.textContent = `Room Code: ${room}`;
//    lobby.style.display = "none";
//   banner.style.display = "none";
//   inputEl.value = "";
//   status.textContent = "";
//   // prepare single-player list and notify main.js that game has started
//   playerList = [{ name: myName, ready: true }];
//   window.dispatchEvent(new CustomEvent("single-game-start", {
//     detail: {
     
//     }
//   }));
// }
// );

// joinBtn.addEventListener("click", () => {
//   const name = playerNameInput.value.trim();
//   const room = roomCodeInput.value.trim().toUpperCase();
//   if (!name || !room) return (status.textContent = "Please enter name and room code.");
//   myName = name;
//   myRoom = room;
//   status.textContent = `Joining room ${room} ...`;
//   roomCodeDisplay.textContent = `Room Code: ${room}`;
//   // start single-player immediately
//   playerList = [{ name: myName, ready: true }];
//   lobby.style.display = "none";
//   banner.style.display = "none";
//   inputEl.value = "";
//   status.textContent = "";
//   window.dispatchEvent(new CustomEvent("multiplayer-game-start", {
//     detail: { paragraph: "", playerList, myName, myRoom }
//   }));
// });

startBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        status.textContent = "Enter your name to survive.";
        return;
    }

    playerName = name;

    // reuse existing create-room / start logic
    window.dispatchEvent(new CustomEvent("single-game-start"));
    document.getElementById("lobby").style.display = "none";
});


// Hide ready/start socket-driven controls in single-player
// readyBtn.style.display = "none";
// startBtn.style.display = "inline-block";

// window.socket.on("game-start", ({ paragraph }) => {
//  );

// Send live stats to main.js (call this when stats update)
function sendLiveStatsToMain(stats) {
  window.dispatchEvent(new CustomEvent("multiplayer-stats-update", {
    detail: stats
  }));
}
// Example usage: sendLiveStatsToMain({ wpm: 50, acc: 0.98, playerNo: 1, allPlayers: playerList });
// single-player: main.js will handle game-over UI locally