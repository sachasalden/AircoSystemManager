import ModbusClient from '../clients/ModbusClient';
import PolarbearService from '../services/PolarbearService';
import {
  AircopanelRepository,
  Device,
} from '../repositories/WallpanelRepository.ts';

export default class PolarbearController {
  private client: ModbusClient;
  private service: PolarbearService;
  private repository: AircopanelRepository;

  constructor(timeout = 10000, mongoUri: string) {
    this.client = new ModbusClient(timeout);
    this.service = new PolarbearService(this.client);
    this.repository = new AircopanelRepository(mongoUri);
  }

  async connect(host: string, port: number): Promise<void> {
    await this.client.connect(host, port);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async handleReconnect(): Promise<void> {
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
    return await this.service.getSetpoint(unitId, zone);
  }

  async getVirtualTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    return await this.service.getVirtualTemperature(unitId, zone);
  }

  async setVirtualTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    await this.service.setVirtualTemperature(unitId, zone, temperature);
  }

  async getDevices() {
    return await this.repository.getDevices();
  }

  async addDevice(device: any) {
    return await this.repository.addDevice(device);
  }

  async getDeviceById(deviceId: string) {
    return await this.repository.getDeviceById(deviceId);
  }

  async deleteDevice(deviceId: string) {
    return await this.repository.deleteDevice(deviceId);
  }

  async updateDevice(device: any) {
    return await this.repository.updateDevice(device);
  }

  // Fan speed / fan mode helpers
  async getFanSpeed(unitId: number, zone: 1 | 2): Promise<number> {
    return await this.service.getFanSpeed(unitId, zone);
  }

  async setFanSpeed(unitId: number, zone: 1 | 2, speed: number): Promise<void> {
    await this.service.setFanSpeed(unitId, zone, speed);
  }

  async getFanMode(unitId: number, zone: 1 | 2): Promise<number> {
    return await this.service.getFanMode(unitId, zone);
  }

  async setFanMode(unitId: number, zone: 1 | 2, mode: number): Promise<void> {
    await this.service.setFanMode(unitId, zone, mode);
  }
}
