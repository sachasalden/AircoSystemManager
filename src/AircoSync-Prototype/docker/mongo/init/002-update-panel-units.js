const database = db.getSiblingDB("wallpanel_sync");

database.Climatezones.updateOne(
  { "rooms.aircopanels.id": "eca18883-942c-486f-981b-eca7f853797b" },
  {
    $set: {
      "rooms.$[room].aircopanels.$[panel].ids": [1, 2],
      "rooms.$[room].aircopanels.$[panel].modbusUnits": [
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
  },
  {
    arrayFilters: [
      { "room.id": "2134af85-4377-2330-af2d-72143bec6574" },
      { "panel.id": "eca18883-942c-486f-981b-eca7f853797b" },
    ],
  },
);

print("Updated wallpanel modbus unit versions");
