class ServiceSocketManager {
  constructor() {
    this.byServiceId = {};
    this.eventServiceMap = {};
    this.bySocketId = {};
    // this.nodeIp = ip.address()
    // console.log(this.nodeIp)
  }

  map(socket, serviceConfig) {
    this.bySocketId[socket.id] = serviceConfig.id;
    this.byServiceId[serviceConfig.id] = {
      config: serviceConfig,
      socket: socket,
    };
    this.remapEvents();
    console.log("mapped", socket.id);
  }

  unmap(socket) {
    let service = this.getServiceBySocketId(socket.id);
    if (service) {
      delete this.byServiceId[service.config.id];
    }
    delete this.bySocketId[socket.id];
    this.remapEvents();
    console.log("unmapped", socket.id);
  }

  remapEvents() {
    this.eventServiceMap = {};
    Object.keys(this.byServiceId).map((serviceId) => {
      let service = this.byServiceId[serviceId];
      if (
        "eventMap" in service.config ||
        Object.keys(service.config.eventMap).length > 0
      ) {
        Object.keys(service.config.eventMap).map((eventName) => {
          if (!(eventName in this.eventServiceMap)) {
            this.eventServiceMap[eventName] = [];
          }
          this.eventServiceMap[eventName].push(service.config.id);
          console.log(eventName, service.config.id);
        });
      }
    });
  }

  getServiceById(id) {
    if (id in this.byServiceId) {
      return this.byServiceId[id];
    }
    return false;
  }

  getServiceBySocketId(id) {
    if (id in this.bySocketId) {
      let serviceId = this.bySocketId[id];
      return this.getServiceById(serviceId);
    }
    return false;
  }

  getSocketsForEvent(eventName) {
    if (!(eventName in this.eventServiceMap)) {
      return [];
    }
    let sockets = [];
    this.eventServiceMap[eventName].map((serviceId) => {
      let service = this.getServiceById(serviceId);
      if (service) {
        sockets.push(service.socket);
      }
    });
    return sockets;
  }

  hasService(serviceId) {
    if (serviceId in this.byServiceId) {
      return this.byServiceId[serviceId].socket;
    }
    return false;
  }
}

module.exports = ServiceSocketManager;
