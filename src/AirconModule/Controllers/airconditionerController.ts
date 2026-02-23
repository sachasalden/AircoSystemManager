import { Airconditioner } from ../../../custom_typings/entities;

interface AirconditionerController {
  setTemperature(airconditionerId: Airconditioner, newTemperature: Number): Promise <Airconditioner>;
  getTemperature(airconditionerId: Airconditioner): Promise <Airconditioner>;

  setFanSpeed(airconditionerId: Airconditioner, newFanSpeed: Number): Promise <Airconditioner>;
  getFanSpeed(airconditionerId: Airconditioner): Promise <Airconditioner>;

  getAllData(airconditionerId: Airconditioner): Promise <Airconditioner>;

  getDeviceId(): String;

}

export default AirconditionerController;

