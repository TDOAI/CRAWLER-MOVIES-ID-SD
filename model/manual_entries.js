const mongoose = require("mongoose");

const manual_entriesSchema = new mongoose.Schema({
    Link: { type: String, index: true }
},{versionKey: false})

const Manual_Entry = mongoose.model("Manual_Entry", manual_entriesSchema);

module.exports = Manual_Entry;