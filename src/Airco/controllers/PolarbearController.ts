import ModbusClient from '../clients/ModbusClient';
import PolarbearService from '../services/PolarbearService';
import {
  AircopanelRepository,
  Device,
} from '../repositories/WallpanelRepository';

export default class PolarbearController {
  private client: ModbusClient;
  private service: PolarbearService;

  constructor(
    private timeout: number,
    private repository: AircopanelRepository,
  ) {
    this.client = new ModbusClient(this.timeout);
    this.service = new PolarbearService(this.client);
  }

  async connect(host: string, port: number): Promise<void> {
    await this.client.connect(host, port);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  handleReconnect(): void {
    this.client.handleReconnect();
  }

  async setTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    await this.service.setSetpoint(unitId, zone, temperature);
  }

  async getTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getSetpoint(unitId, zone);
  }

  async getVirtualTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getVirtualTemperature(unitId, zone);
  }

  async setVirtualTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    await this.service.setVirtualTemperature(unitId, zone, temperature);
  }

  async getDevices() {
    return this.repository.getDevices();
  }

  async addDevice(device: Device & { zoneId: string; roomId: string }) {
    return this.repository.addDevice(device);
  }

  async getDeviceById(deviceId: string) {
    return this.repository.getDeviceById(deviceId);
  }

  async deleteDevice(deviceId: string) {
    return this.repository.deleteDevice(deviceId);
  }

  async updateDevice(device: Device) {
    return this.repository.updateDevice(device);
  }

  async getFanSpeed(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getFanSpeed(unitId, zone);
  }

  async setFanSpeed(unitId: number, zone: 1 | 2, speed: number): Promise<void> {
    await this.service.setFanSpeed(unitId, zone, speed);
  }

  async getFanMode(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getFanMode(unitId, zone);
  }

  async setFanMode(unitId: number, zone: 1 | 2, mode: number): Promise<void> {
    await this.service.setFanMode(unitId, zone, mode);
  }
}
