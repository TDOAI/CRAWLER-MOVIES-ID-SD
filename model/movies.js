const mongoose = require("mongoose");

const MoviesSchema = new mongoose.Schema({
    tmdb_id: String,
    stream_id: { type: String, index: true }
},{versionKey: false})

const Movie = mongoose.model("Movie", MoviesSchema);

module.exports = Movie;