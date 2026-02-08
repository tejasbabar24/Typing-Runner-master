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

let lobbyBGM = new Audio("/start-bgm.mpeg");
lobbyBGM.loop = true;
lobbyBGM.volume = 0;        // start muted
lobbyBGM.muted = true;

// START ON PAGE LOAD
window.addEventListener("load", () => {
  lobbyBGM.play().catch(() => {
    // browser may still block, handled below
  });
});

function unlockLobbyBGM() {
  lobbyBGM.muted = false;

  // smooth fade-in
  let v = 0;
  lobbyBGM.volume = 0;
  const target = 0.45;

  function fade() {
    v += 0.02;
    lobbyBGM.volume = Math.min(v, target);
    if (v < target) requestAnimationFrame(fade);
  }
  fade();

  document.removeEventListener("click", unlockLobbyBGM);
  document.removeEventListener("keydown", unlockLobbyBGM);
  document.removeEventListener("touchstart", unlockLobbyBGM);
}

document.addEventListener("click", unlockLobbyBGM);
document.addEventListener("keydown", unlockLobbyBGM);
document.addEventListener("touchstart", unlockLobbyBGM);


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

    // fade out lobby BGM
  const startVol = lobbyBGM.volume;
  const start = performance.now();

  function fadeOut(now) {
    const t = Math.min((now - start) / 400, 1);
    lobbyBGM.volume = startVol * (1 - t);
    if (t < 1) requestAnimationFrame(fadeOut);
    else {
      lobbyBGM.pause();
      lobbyBGM.currentTime = 0;
    }
  }
  requestAnimationFrame(fadeOut);
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