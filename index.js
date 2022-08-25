const http = require('http');
const socket = require('socket.io');
const server = http.createServer();
const port = 11100;

var createdRooms = {};

class RoomInfo {
  constructor(name, level, owner, maxPlayers, roomCode) {
    this.name = name;
    this.level = level;
    this.owner = owner;
    this.maxPlayers = maxPlayers;
    this.curPlayers = 0;
    this.players = [];
    this.roomCode = roomCode;
  }
}

class Player {
  constructor(socketId) {
    this.socketId = socketId;
    this.score = 0;
    this.state = "NotReady";
  }
}

function randomValueFromArray(array) {
  const random = Math.floor(Math.random() * array.length);
  return array[random];
}

function roomInfoUpdate(code, roomInfo) {
  io.to(code).emit('roomUpdate', { date: new Date().getTime(), room: roomInfo });
}

function createRandNum(min, max) {
  var ntemp = Math.floor(Math.random() * (max - min + 1)) + min;
  return ntemp;
}

function fillZero(width, str) {
  return str.length >= width ? str : new Array(width - str.length + 1).join('0') + str;//남는 길이만큼 0으로 채움
}

var io = socket(server, {
  pingInterval: 10000,
  pingTimeout: 5000
});

io.use((socket, next) => {
  if (socket.handshake.query.token === `UNITY`) {
    next();
  } else {
    next(new Error(`Authentication error`));
  }
});

io.on('connection', socket => {
  console.log(`[connection] ${socket.id}`);

  setTimeout(() => {
    socket.emit('connection', { date: new Date().getTime(), data: `Hello Unity` })
  }, 1000);

  socket.on('createRoom', async (roomCode, levelCode) => {
    console.log(`Request: [createRoom] ${socket.id} -> "${roomCode}"`);
    var code = roomCode;
    if (code === '-1') {
      do {
        var randnum = createRandNum(1, 999999);
        code = fillZero(6, String(randnum));
      }
      while (io.sockets.adapter.rooms.has(code));

      console.log(`Working: [createRoom] ${socket.id} -> "${code}"`);

      var roomInfo = new RoomInfo('', levelCode, '', 8, code);

      await socket.join(code);
      const sockets = await io.in(code).fetchSockets();
      var playersOnRoom = [];
      for (const socket of sockets) {
        playersOnRoom.push(new Player(socket.id));
      }

      roomInfo.owner = socket.id;
      roomInfo.curPlayers = playersOnRoom.length;
      roomInfo.players = playersOnRoom;
      createdRooms[code] = roomInfo;
      roomInfoUpdate(code, roomInfo);
    }
    else {
      code = fillZero(6, code);
      if (io.sockets.adapter.rooms.has(code)) {
        console.log(`Fail: [createRoom] ${socket.id} -> "${code}" is already created`);
        socket.emit('roomCreateError', { date: new Date().getTime(), code: code });
      }
      else {
        console.log(`Working: [createRoom] ${socket.id} -> ${code}`);

        await socket.join(code);
        const sockets = await io.in(code).fetchSockets();
        var playersOnRoom = [];
        for (const socket of sockets) {
          playersOnRoom.push(new Player(socket.id));
        }

        roomInfo.owner = socket.id;
        roomInfo.curPlayers = playersOnRoom.length;
        roomInfo.players = playersOnRoom;
        createdRooms[code] = roomInfo;

        roomInfoUpdate(code, roomInfo);
      }
    }
  });

  socket.on('joinRoom', async (code) => {
    if (!io.sockets.adapter.rooms.has(code)) {
      console.log(`Fail: [joinRoom] ${socket.id} -> There is no room match with code "${code}"`);
      socket.emit('roomJoinError', { date: new Date().getTime(), code: code });
    }
    else {
      await socket.join(code);
      console.log(`Working: [joinRoom] ${socket.id} -> "${code}"`);
      const sockets = await io.in(code).fetchSockets();
      var playersOnRoom = [];
      for (const socket of sockets) {
        playersOnRoom.push(new Player(socket.id));
      }

      var roomInfo = createdRooms[code];
      roomInfo.curPlayers = playersOnRoom.length;
      roomInfo.players = playersOnRoom;
      createdRooms[code] = roomInfo;

      roomInfoUpdate(code, roomInfo);
    }
  });

  socket.on('roomSelectedLevel', (code, levelCode) => {
    if (code === '') {
      console.log(`Error: [roomSelectedLevel] cannot send to others levelCode[${levelCode}] ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomSelectedLevel] levelCode[${levelCode}] ${socket.id} -> "${code}"`);

      var roomInfo = createdRooms[code];
      roomInfo.level = levelCode;
      createdRooms[code] = roomInfo;

      roomInfoUpdate(code, roomInfo);
    }
  });

  socket.on('leaveRoom', async (code) => {
    if (code === '') {
      console.log(`Error: [leaveRoom] cannot leave room ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [leaveRoom] ${socket.id} -> "${code}"`);
      await socket.leave(code);
      await socket.emit('leaveRoomSuccess', { date: new Date().getTime(), code: code });

      const sockets = await io.in(code).fetchSockets();

      if (sockets.length == 0) {
        delete createdRooms[code];
      }
      else {
        var playersOnRoom = [];
        for (const socket of sockets) {
          playersOnRoom.push(new Player(socket.id));
        }
        var roomInfo = createdRooms[code];

        roomInfo.curPlayers = playersOnRoom.length;
        roomInfo.players = playersOnRoom;
        if (roomInfo.owner === socket.id) {
          roomInfo.owner = randomValueFromArray(roomInfo.players).socketId;
        }
        createdRooms[code] = roomInfo;

        roomInfoUpdate(code, roomInfo);
      }
    }
  });

  socket.on('roomPlayerReady', (code) => {
    if (code === '') {
      console.log(`Error: [roomPlayerReady] cannot Player Ready ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomPlayerReady] ${socket.id} -> "${code}"`);
      var roomInfo = createdRooms[code];

      const index = roomInfo.players.findIndex((element) => {
        if (element.socketId === socket.id) {
          return true;
        }
      });

      roomInfo.players[index].state = "Ready";

      createdRooms[code] = roomInfo;
      roomInfoUpdate(code, createdRooms[code]);
    }
  });

  socket.on('roomPlayerReadyCancel', (code) => {
    if (code === '') {
      console.log(`Error: [roomPlayerReadyCancel] cannot Cancel Player Ready ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomPlayerReadyCancel] ${socket.id} -> "${code}"`);
      var roomInfo = createdRooms[code];

      const index = roomInfo.players.findIndex((element) => {
        if (element.socketId === socket.id) {
          return true;
        }
      });

      roomInfo.players[index].state = "NotReady";

      createdRooms[code] = roomInfo;
      roomInfoUpdate(code, createdRooms[code]);
    }
  });

  socket.on('roomChangeOwner', (code, newOwner) => {
    if (newOwner === '') {
      console.log(`Error: [roomChangeOwner] cannot ChangeOwner ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomChangeOwner] ${socket.id} -> "${code}"`);

      var roomInfo = createdRooms[code];
      roomInfo.owner = newOwner;
      createdRooms[code] = roomInfo;
      roomInfoUpdate(code, createdRooms[code]);
    }
  });

  socket.on('roomStartGame', (code) => {
    if (code === '') {
      console.log(`Error: [roomStartGame] cannot Start Game ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomStartGame] ${socket.id} -> "${code}"`);

      var roomInfo = createdRooms[code];
      for (let index = 0; index < roomInfo.players.length; index++) {
        if (roomInfo.players[index].state === "Ready") {
          roomInfo.players[index].state = "Loading";
        }
      }
      createdRooms[code] = roomInfo;
      roomInfoUpdate(code, createdRooms[code]);

      io.to(code).emit('roomStartGame', { date: new Date().getTime(), room: createdRooms[code] });
    }
  });

  socket.on('roomStartGamePlayerReady', (code) => {
    if (code === '') {
      console.log(`Error: [roomStartGamePlayerReady] cannot Ready Game ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomStartGamePlayerReady] ${socket.id} -> "${code}"`);

      var roomInfo = createdRooms[code];
      if (roomInfo == null) return;

      for (let index = 0; index < roomInfo.players.length; index++) {
        if (roomInfo.players[index].socketId === socket.id) {
          roomInfo.players[index].state = "Playing";
        }
      }
      createdRooms[code] = roomInfo;
      roomInfoUpdate(code, createdRooms[code]);
    }
  });

  socket.on('roomPlayerState', (code, state) => {
    if (code === '') {
      console.log(`Error: [roomPlayerState] cannot set state ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [roomPlayerState] {${state}} ${socket.id} -> "${code}"`);

      if (state === 'Result') {
        var roomInfo = createdRooms[code];
        if (roomInfo == null) return;

        for (let index = 0; index < roomInfo.players.length; index++) {
          if (roomInfo.players[index].socketId === socket.id) {
            roomInfo.players[index].state = "Result";
          }
        }
        createdRooms[code] = roomInfo;
        roomInfoUpdate(code, createdRooms[code]);
      }
      else if (state === 'NotReady') {
        var roomInfo = createdRooms[code];
        if (roomInfo == null) return;

        for (let index = 0; index < roomInfo.players.length; index++) {
          if (roomInfo.players[index].socketId === socket.id) {
            roomInfo.players[index].state = "NotReady";
          }
        }
        createdRooms[code] = roomInfo;
        roomInfoUpdate(code, createdRooms[code]);
      }
    }
  });

  socket.on('roomPlayerScoreUpdate', (roomCode, score) => {
    if (roomCode === '') {
      console.log(`Error: [roomPlayerScoreUpdate] cannot update score ${score} -> "${socket.id}"`);
    }
    var roomInfo = createdRooms[roomCode];
    if (roomInfo == null) return;

    for (let index = 0; index < roomInfo.players.length; index++) {
      if (roomInfo.players[index].socketId === socket.id) {
        roomInfo.players[index].score = score;
      }
    }
    createdRooms[roomCode] = roomInfo;
    roomInfoUpdate(roomCode, createdRooms[roomCode]);
  });

  socket.on('disconnecting', async (reason) => {
    console.log(`[disconnect] ${socket.id}`);

    for (const room of socket.rooms) {
      if (room !== socket.id) {
        console.log(`Emit: [roomUserLeft] ${socket.id} -> "${room}"`);
        socket.leave(room);

        const sockets = await io.in(room).fetchSockets();

        if (sockets.length == 0) {
          delete createdRooms[room];
        }
        else {
          var playersOnRoom = [];
          for (const socket of sockets) {
            playersOnRoom.push(new Player(socket.id));
          }
          var roomInfo = createdRooms[room];

          roomInfo.curPlayers = playersOnRoom.length;
          roomInfo.players = playersOnRoom;
          if (roomInfo.owner === socket.id) {
            roomInfo.owner = randomValueFromArray(roomInfo.players).socketId;
          }
          createdRooms[room] = roomInfo;

          roomInfoUpdate(room, roomInfo);
        }
      }
    }
  });
});


server.listen(port, () => {
  console.log('listening on *:' + port);
});