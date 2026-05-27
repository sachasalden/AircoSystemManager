const database = db.getSiblingDB("wallpanel_sync");

database.Climatezones.deleteMany({});
database.enviormentsaircodevices.deleteMany({});

database.Climatezones.insertMany([
  {
    _id: ObjectId("691ee9f917ddcc79daf9fe84"),
    name: "Sacha",
    rooms: [
      {
        id: "2134af85-4377-2330-af2d-72143bec6574",
        name: "new",
        airconditioners: [
          {
            id: "33bd6161-b12b-448c-a14b-0fb6423674e7",
            name: "bathroom",
            deviceType: "FC-500PC/FC-1100PC",
            minTemperature: 16,
            maxTemperature: 30,
            minSetTemperature: 16,
            maxSetTemperature: 30,
            setTemperature: 16,
            currentTemperature: 23,
            currentFanspeed: 2,
            minFanspeed: 0,
            maxFanspeed: 6,
            data: {
              deviceId: "456daa52-4e99-2b48-66c7-e4940cbfd071",
              type: "HeinAndHopmanIpSystem",
              deviceTerminalId: "1",
              roomTemparatureAddress: "",
              roomTemparatureSetPointAddress: "",
              fanspeedAddress: "",
              fanspeedSetPointAddress: "",
            },
          },
        ],
        groups: [],
        aircopanels: [
          {
            id: "eca18883-942c-486f-981b-eca7f853797b",
            name: "Bathroom",
            ip: "192.168.55.97",
            type: "polarbear-v1",
            model: "",
            port: 4001,
            ids: [1, 2],
            modbusUnits: [
              {
                id: 1,
                name: "v1",
                type: "polarbear-v1",
                zones: [1],
              },
              {
                id: 2,
                name: "v3",
                type: "polarbear-v3",
                zones: [1],
              },
            ],
          },
        ],
      },
      {
        id: "1457ab80-07d0-d2f3-cdbd-bd92ea9b753e",
        name: "new",
        airconditioners: [],
        groups: [],
        aircopanels: [],
      },
    ],
  },
]);

database.enviormentsaircodevices.insertMany([
  {
    _id: ObjectId("69a823513023202cb41f214b"),
    id: "456daa52-4e99-2b48-66c7-e4940cbfd071",
    name: "DEV Server emulator",
    type: "HeinAndHopmanIpSystem",
    ip: "192.168.55.10",
    port: "502",
    bidirectional: true,
  },
]);

database.Climatezones.createIndex({ name: 1 });
database.Climatezones.createIndex({ "rooms.id": 1 });
database.Climatezones.createIndex({ "rooms.airconditioners.id": 1 });
database.Climatezones.createIndex({ "rooms.airconditioners.data.deviceId": 1 });
database.enviormentsaircodevices.createIndex({ id: 1 }, { unique: true });

print("Seeded wallpanel_sync.Climatezones and wallpanel_sync.enviormentsaircodevices");
