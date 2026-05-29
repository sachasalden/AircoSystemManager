import { MongoClient, ObjectId, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import { CONFIG } from "../../config/runtime.config";
import type { ClimatezoneDocument, DbAircoPanel, DbAirconditioner, DbRoom, EnvironmentAircoDeviceDocument, RuntimeSettings, SettingsPatch } from "../../types/shared.types";
import { applyRuntimeSettings, defaultPanelTypeForUnit, log, normalizeModbusUnits, toPositiveInt, toZones } from "../../utils/helpers";

export class ConfigRepository {
  private client?: MongoClient;
  private database?: Db;

  async connect(): Promise<void> {
    this.client = new MongoClient(CONFIG.database.uri);
    await this.client.connect();
    this.database = this.client.db(CONFIG.database.name);
    log(`mongodb connected database=${CONFIG.database.name}`);
  }

  async close(): Promise<void> {
    await this.client?.close();
  }

  async loadAndApply(): Promise<RuntimeSettings> {
    const settings = await this.getSettings();
    applyRuntimeSettings(settings);

    log(
      `config loaded from mongodb panel=${settings.wallpanel.host}:${settings.wallpanel.port} airco=${settings.airco.host}:${settings.airco.port}`,
    );

    return settings;
  }

  async getSettings(): Promise<RuntimeSettings> {
    const database = this.getDatabase();
    const climatezone = await database
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .findOne({ "rooms.aircopanels.0": { $exists: true } });

    if (!climatezone) {
      throw new Error("no climatezone found with aircopanel ");
    }

    const room = this.findConfigRoom(climatezone);
    const panel = room.aircopanels?.[0];
    const airconditioner = room.airconditioners?.[0];

    if (!panel) {
      throw new Error("no aircopanel found in climatezone room");
    }

    if (!airconditioner?.data?.deviceId) {
      throw new Error("no airconditioner deviceId found in climatezone room ");
    }

    const device = await database
      .collection<EnvironmentAircoDeviceDocument>(
        CONFIG.database.aircoDevicesCollection,
      )
      .findOne({ id: airconditioner.data.deviceId });

    if (!device) {
      throw new Error(
        `no airco device found for id=${airconditioner.data.deviceId}`,
      );
    }

    const units = normalizeModbusUnits(panel);

    return {
      climatezoneId: climatezone._id.toHexString(),
      climatezoneName: climatezone.name,
      roomId: room.id,
      roomName: String(room.name ?? ""),
      wallpanel: {
        id: panel.id,
        name: String(panel.name ?? ""),
        host: panel.ip,
        port: toPositiveInt(panel.port, CONFIG.wallpanel.port),
        units,
      },
      airco: {
        airconditionerId: airconditioner.id,
        deviceId: device.id,
        name: String(device.name ?? airconditioner.name ?? ""),
        host: device.ip,
        port: toPositiveInt(device.port, CONFIG.airco.port),
        model: String(airconditioner.deviceType ?? CONFIG.airco.model),
        unitId: toPositiveInt(
          airconditioner.data.deviceTerminalId,
          CONFIG.airco.unitId,
        ),
        bidirectional: device.bidirectional !== false,
      },
    };
  }

  async updateSettings(patch: SettingsPatch): Promise<RuntimeSettings> {
    const current = await this.getSettings();
    const next = this.mergeSettings(current, patch);
    const database = this.getDatabase();
    const climatezoneObjectId = new ObjectId(next.climatezoneId);

    await database.collection(CONFIG.database.climatezonesCollection).updateOne(
      {
        _id: climatezoneObjectId,
        "rooms.id": next.roomId,
      },
      {
        $set: {
          "rooms.$[room].aircopanels.$[panel].ip": next.wallpanel.host,
          "rooms.$[room].aircopanels.$[panel].port": next.wallpanel.port,
          "rooms.$[room].aircopanels.$[panel].ids": next.wallpanel.units.map(
            (unit) => unit.id,
          ),
          "rooms.$[room].aircopanels.$[panel].type":
            next.wallpanel.units[0]?.type ?? "polarbear-v1",
          "rooms.$[room].aircopanels.$[panel].modbusUnits":
          next.wallpanel.units,
          "rooms.$[room].airconditioners.$[airco].deviceType":
          next.airco.model,
          "rooms.$[room].airconditioners.$[airco].data.deviceTerminalId":
            String(next.airco.unitId),
        },
      },
      {
        arrayFilters: [
          { "room.id": next.roomId },
          { "panel.id": next.wallpanel.id },
          { "airco.id": next.airco.airconditionerId },
        ],
      },
    );

    await database
      .collection(CONFIG.database.aircoDevicesCollection)
      .updateOne(
        { id: next.airco.deviceId },
        {
          $set: {
            ip: next.airco.host,
            port: String(next.airco.port),
            bidirectional: next.airco.bidirectional,
          },
        },
      );

    applyRuntimeSettings(next);

    return next;
  }

  async getFrontendZones(): Promise<unknown[]> {
    const database = this.getDatabase();
    const zones = await database
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .find({})
      .toArray();

    return zones.map((zone) => ({
      id: zone._id.toHexString(),
      _id: zone._id.toHexString(),
      name: zone.name,
      rooms: (zone.rooms ?? []).map((room) => ({
        id: room.id,
        name: room.name ?? "",
        aircopanels: (room.aircopanels ?? []).map((panel) => ({
          ...panel,
          zoneId: zone._id.toHexString(),
          roomId: room.id,
          port: toPositiveInt(panel.port, CONFIG.wallpanel.port),
          ids: (panel.ids ?? []).map((id) => toPositiveInt(id, 0)).filter(Boolean),
          modbusUnits: normalizeModbusUnits(panel),
        })),
        airconditioners: (room.airconditioners ?? []).map((airco) => ({
          ...airco,
          zoneId: zone._id.toHexString(),
          roomId: room.id,
        })),
      })),
    }));
  }

  async getEnvironmentDevices(): Promise<unknown[]> {
    return this.getDatabase()
      .collection<EnvironmentAircoDeviceDocument>(CONFIG.database.aircoDevicesCollection)
      .find({})
      .toArray();
  }

  async addEnvironmentDevice(device: Partial<EnvironmentAircoDeviceDocument>): Promise<unknown> {
    const next = {
      id: String(device.id ?? randomUUID()),
      name: String(device.name ?? "New"),
      type: String(device.type ?? "HeinAndHopmanIpSystem"),
      ip: String(device.ip ?? ""),
      port: String(device.port ?? "502"),
      bidirectional: device.bidirectional !== false,
    };

    await this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .insertOne(next);

    return next;
  }

  async updateEnvironmentDevice(
    id: string,
    patch: Partial<EnvironmentAircoDeviceDocument>,
  ): Promise<unknown> {
    await this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .updateOne(
        { id },
        {
          $set: {
            name: patch.name,
            type: patch.type,
            ip: patch.ip,
            port: String(patch.port ?? ""),
            bidirectional: patch.bidirectional,
          },
        },
      );

    return this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .findOne({ id });
  }

  async deleteEnvironmentDevice(id: string): Promise<void> {
    await this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .deleteOne({ id });
  }

  async addPanel(panel: Partial<DbAircoPanel> & { zoneId: string; roomId: string }): Promise<unknown> {
    const next = this.normalizePanelForDb(panel);

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: new ObjectId(panel.zoneId), "rooms.id": panel.roomId },
        { $push: { "rooms.$.aircopanels": next } } as any,
      );

    return { ...next, zoneId: panel.zoneId, roomId: panel.roomId };
  }

  async updatePanel(id: string, panel: Partial<DbAircoPanel>): Promise<unknown> {
    const zones = await this.getDatabase()
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .find({ "rooms.aircopanels.id": id })
      .toArray();
    const zone = zones[0];
    const room = zone?.rooms?.find((candidate) =>
      candidate.aircopanels?.some((item) => item.id === id),
    );

    if (!zone || !room) {
      throw new Error(`aircopanel not found: ${id}`);
    }

    const next = this.normalizePanelForDb({ ...panel, id });

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: zone._id },
        { $set: { "rooms.$[room].aircopanels.$[panel]": next } },
        { arrayFilters: [{ "room.id": room.id }, { "panel.id": id }] },
      );

    return { ...next, zoneId: zone._id.toHexString(), roomId: room.id };
  }

  async deletePanel(id: string): Promise<void> {
    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { "rooms.aircopanels.id": id },
        { $pull: { "rooms.$[].aircopanels": { id } } } as any,
      );
  }

  async addAirconditioner(
    airco: Partial<DbAirconditioner> & { zoneId: string; roomId: string },
  ): Promise<unknown> {
    const next = this.normalizeAirconditionerForDb(airco);

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: new ObjectId(airco.zoneId), "rooms.id": airco.roomId },
        { $push: { "rooms.$.airconditioners": next } } as any,
      );

    return { ...next, zoneId: airco.zoneId, roomId: airco.roomId };
  }

  async updateAirconditioner(id: string, airco: Partial<DbAirconditioner>): Promise<unknown> {
    const zones = await this.getDatabase()
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .find({ "rooms.airconditioners.id": id })
      .toArray();
    const zone = zones[0];
    const room = zone?.rooms?.find((candidate) =>
      candidate.airconditioners?.some((item) => item.id === id),
    );

    if (!zone || !room) {
      throw new Error(`airconditioner not found: ${id}`);
    }

    const next = this.normalizeAirconditionerForDb({ ...airco, id });

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: zone._id },
        { $set: { "rooms.$[room].airconditioners.$[airco]": next } },
        { arrayFilters: [{ "room.id": room.id }, { "airco.id": id }] },
      );

    return { ...next, zoneId: zone._id.toHexString(), roomId: room.id };
  }

  async deleteAirconditioner(id: string): Promise<void> {
    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { "rooms.airconditioners.id": id },
        { $pull: { "rooms.$[].airconditioners": { id } } } as any,
      );
  }

  private getDatabase(): Db {
    if (!this.database) {
      throw new Error("mongodb is not connected");
    }

    return this.database;
  }

  private normalizePanelForDb(panel: Partial<DbAircoPanel>): DbAircoPanel {
    const id = String(panel.id ?? randomUUID());
    const modbusUnits = normalizeModbusUnits({
      id,
      name: panel.name,
      ip: String(panel.ip ?? ""),
      type: panel.type,
      port: panel.port ?? CONFIG.wallpanel.port,
      ids: panel.ids,
      modbusUnits: panel.modbusUnits,
    });

    return {
      id,
      name: String(panel.name ?? ""),
      ip: String(panel.ip ?? ""),
      type: String(panel.type ?? modbusUnits[0]?.type ?? "moxa"),
      model: String(panel.model ?? ""),
      port: toPositiveInt(panel.port, CONFIG.wallpanel.port),
      ids: modbusUnits.map((unit) => unit.id),
      modbusUnits,
    };
  }

  private normalizeAirconditionerForDb(airco: Partial<DbAirconditioner>): DbAirconditioner {
    return {
      ...(airco as DbAirconditioner),
      id: String(airco.id ?? randomUUID()),
      name: String(airco.name ?? ""),
      deviceType: String(airco.deviceType ?? CONFIG.airco.model),
      data: {
        deviceId: String(airco.data?.deviceId ?? ""),
        type: String(airco.data?.type ?? "HeinAndHopmanIpSystem"),
        deviceTerminalId: String(airco.data?.deviceTerminalId ?? CONFIG.airco.unitId),
        ...airco.data,
      },
    };
  }

  private findConfigRoom(climatezone: ClimatezoneDocument): DbRoom {
    const room = climatezone.rooms?.find(
      (candidate) =>
        (candidate.aircopanels?.length ?? 0) > 0 &&
        (candidate.airconditioners?.length ?? 0) > 0,
    );

    if (!room) {
      throw new Error("no room found with aircopanel and airconditioner ");
    }

    return room;
  }

  private mergeSettings(
    current: RuntimeSettings,
    patch: SettingsPatch,
  ): RuntimeSettings {
    const patchedUnits =
      patch.wallpanel?.units?.map((unit, index) => {
        const previous =
          current.wallpanel.units[index] ??
          current.wallpanel.units[current.wallpanel.units.length - 1];
        const id = toPositiveInt(unit.id, previous?.id ?? index + 1);
        const type = String(
          unit.type ?? previous?.type ?? defaultPanelTypeForUnit(id),
        );

        return {
          id,
          name: String(unit.name ?? previous?.name ?? type),
          type,
          zones: toZones(unit.zones, previous?.zones ?? [1]),
        };
      }) ?? current.wallpanel.units;

    return {
      ...current,
      wallpanel: {
        ...current.wallpanel,
        host: String(patch.wallpanel?.host ?? current.wallpanel.host),
        port: toPositiveInt(patch.wallpanel?.port, current.wallpanel.port),
        units: patchedUnits,
      },
      airco: {
        ...current.airco,
        host: String(patch.airco?.host ?? current.airco.host),
        port: toPositiveInt(patch.airco?.port, current.airco.port),
        model: String(patch.airco?.model ?? current.airco.model),
        unitId: toPositiveInt(patch.airco?.unitId, current.airco.unitId),
        bidirectional:
          patch.airco?.bidirectional ?? current.airco.bidirectional,
      },
    };
  }
}
