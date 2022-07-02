const http = require('http');
const socket = require('socket.io');
const server = http.createServer();
const port = 11100;

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

  socket.on('createRoom', async (data) => {
    console.log(`Received: [createRoom] ${socket.id} -> "${data}"`);
    var code = data;
    if (code === '-1') {
      do {
        var randnum = createRandNum(1, 999999);
        code = fillZero(6, String(randnum));
      }
      while (io.sockets.adapter.rooms.has(code));

      console.log(`Working: [createRoom] ${socket.id} -> "${code}"`);
      await socket.join(code);
      const sockets = await io.in(code).fetchSockets();
      var clientsOnRoom = [];
      for (const socket of sockets) {
        clientsOnRoom.push(socket.id);
      }
      await socket.emit('joinRoomSuccess', { date: new Date().getTime(), code: code, users: clientsOnRoom });
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
        var clientsOnRoom = [];
        for (const socket of sockets) {
          clientsOnRoom.push(socket.id);
        }
        await socket.emit('joinRoomSuccess', { date: new Date().getTime(), code: code, users: clientsOnRoom });
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
      var clientsOnRoom = [];
      for (const socket of sockets) {
        clientsOnRoom.push(socket.id);
      }
      socket.emit('joinRoomSuccess', { date: new Date().getTime(), code: code, users: clientsOnRoom });
      socket.to(code).emit('roomUserList', { date: new Date().getTime(), code: code, users: clientsOnRoom })
    }
  });

  socket.on('leaveRoom', (code) => {
    if (code === '') {
      console.log(`Error: [leaveRoom] cannot leave room ${socket.id} -> "${code}"`);
    }
    else {
      console.log(`Working: [leaveRoom] ${socket.id} -> "${code}"`);
      socket.leave(code);
      socket.emit('leaveRoomSuccess', { date: new Date().getTime(), code: code });
      socket.to(code).emit('roomUserLeft', socket.id);
    }
  });

  socket.on('disconnecting', (reason) => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        console.log(`Emit: [roomUserLeft] ${socket.id} -> "${room}"`);
        socket.to(room).emit('roomUserLeft', socket.id);
      }
    }
  });
});


server.listen(port, () => {
  console.log('listening on *:' + port);
});