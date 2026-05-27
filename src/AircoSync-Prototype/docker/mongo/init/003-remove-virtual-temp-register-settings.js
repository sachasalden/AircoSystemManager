const database = db.getSiblingDB("wallpanel_sync");

database.Climatezones.updateMany(
  {},
  {
    $unset: {
      "rooms.$[].aircopanels.$[].modbusUnits.$[].virtualTempRegister": "",
    },
  },
);

print("Removed configurable virtualTempRegister fields");
