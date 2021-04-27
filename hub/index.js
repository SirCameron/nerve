var http = require("http");
var socketio = require("socket.io");
var socketioClient = require("socket.io-client");
var fs = require("fs");
const ServiceSocketManager = require("./ServiceSocketManager");

class Node {
  constructor(config) {
    this.server = null;
    this.config = {
      port: null,
    };
    if (!("file" in config)) {
      this.config.file = null;
    } else {
      this.config.file = config.file;
    }

    this.serviceSocketManager = new ServiceSocketManager();
    this.loadConfigs();

    if ("port" in config) {
      this.config.port = config.port;
    }
    // this.start();
  }

  loadConfigs() {
    if (!this.config.file) {
      return;
    }
    // let dir = this.config.configdir;
    // let files = fs.readdirSync(this.config.configdir);
    // files.map((file) => {
    // if (this.config.file.substr(-5) == ".json") {
    //   let data = fs.readFileSync(`${__dirname}/${this.config.file}`);
    //   try {
    //     data = JSON.parse(data);
    //     Object.keys(data).map((key) => {
    //       if (Array.isArray(data[key])) {
    //         if (!(key in this.config)) {
    //           this.config[key] = [];
    //         }
    //         data[key].map((item) => {
    //           this.config[key].push(item);
    //         });
    //       } else {
    //         this.config[key] = data[key];
    //       }
    //     });
    //   } catch (err) {
    //     console.log(err);
    //   }
    // }
    // });
  }

  start() {
    this.server = http.createServer();
    this.io = socketio(this.server);
    if (this.config.port) {
      this.server.listen(this.config.port, this.listenHandler.bind(this));
    } else {
      this.server.listen(null, this.listenHandler.bind(this));
    }

    this.io.on("connect", (socket) => {
      console.log("something touched me");
      socket.on("activate", (serviceConfig) => {
        this.activateService(socket, serviceConfig);
      });
      socket.on("disconnect", () => {
        this.deactivateService(socket);
      });
      socket.on("message", (message) => {
        this.handleIncoming(socket, message);
      });

      //peers
      socket.on("join", (nodeConfig) => {
        console.log(nodeConfig);
      });
    });
  }

  listenHandler() {
    // get node address and port..
    // create table of services operating on this node and their ids.
    // distribute to other nodes.
    // use this table to determine which node to send response messages to...
    console.log("listening", this.server.address());
    // if ('peers' in this.config){
    //     this.config.peers.map((ip) => {
    //         console.log(`${ip}:${this.config.port}`)
    //         let peerSocket = socketioClient(`${ip}:${this.config.port}`)
    //         if (peerSocket.connected){
    //             console.log('asdad')
    //             peerSocket.emit('join',{services:[]})
    //         }
    //     })
    // }
  }

  activateService(socket, serviceConfig) {
    try {
      this.serviceSocketManager.map(socket, serviceConfig);
      // this.emitToPeers(this.serviceSocketManager.getServiceTable())
    } catch (err) {
      socket.emit("reject", err.message);
    }
  }

  deactivateService(socket) {
    this.serviceSocketManager.unmap(socket);
  }

  /**
   * leter this should enqueue the message... but for now, immediately emit it.
   * also will communicate with other nodes in a ring
   * @param  {[type]} socket  [description]
   * @param  {[type]} message [description]
   * @return {[type]}         [description]
   */
  handleIncoming(socket, message) {
    //create message queue... just get service names from the ssocketmanager and place message in the queue for that service...
    console.log("INCOMING");
    if ("event" in message) {
      let sockets = this.serviceSocketManager.getSocketsForEvent(message.event);
      sockets.map((socket) => {
        console.log("sending to", socket.id);
        socket.emit("message", message);
      });
    }
    console.log(message);
    if ("to" in message) {
      // is service on this hub
      //      send
      // else
      //  get routing table
      //      if this hub has that service id, pass on,
      //      if does not have that service,
      let socket = this.serviceSocketManager.hasService(message.to);
      if (socket) {
        socket.emit("reply", message);
      }
    }
  }

  disconnect() {
    this.io.emit("node-disconnect", {});
    this.io.close();
  }
}

module.exports = Node;
