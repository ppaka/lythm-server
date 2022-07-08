class RoomInfo{
    constructor(name, level, owner, maxPlayers, roomCode){
        this.name = name;
        this.level = level;
        this.owner = owner;
        this.maxPlayers = maxPlayers;
        this.curPlayers = 0;
        this.players = [];
        this.roomCode = roomCode;
    }
}