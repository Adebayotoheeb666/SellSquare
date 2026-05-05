const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DraftSchema = new Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  data: { type: Object, required: true },
});

const Draft = mongoose.model("Draft", DraftSchema);

module.exports = Draft;
