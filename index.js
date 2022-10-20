require('dotenv').config();
const axios = require("axios"); 
const cheerio = require("cheerio");
const mongoose = require('mongoose');
const randomUseragent = require('random-useragent');
const Movie = require("./model/movies");
const _headers = require ('./_headers');

const authority = process.env.AUTHORITY;
const referer = process.env.REFERER;
const domain = process.env.DOMAIN;
const url = process.env.URL;
const DB = process.env.MONGODB;

async function headers() {
    const config = _headers.config_0;
    config.headers['authority'] = authority;
    config.headers['referer'] = referer;
    return config;
}

async function pagination() {
    try {
        const config = await headers();
        const useragent = randomUseragent.getRandom(function (ua) {
            return ua.browserName === 'Chrome';});
        config.headers['user-agent'] = useragent;
        const pageHTML = await axios.get(url, config);
        const $ = cheerio.load(pageHTML.data);
        const last = $("#main-wrapper > div > section > div:nth-child(5) > nav > ul > li:nth-child(5) > a");
        const last_page = $(last).attr("href");
        const pages_count = last_page.substring(74);
        const page_count = parseInt(pages_count);
        const pages = [];
        for (let index = 1; index <= page_count; index = index + 1) {
            const page_url = `${url}` + index;
            pages.push(page_url);
        }
        // const sliced = pages.slice(3, 5);
        console.log("PAGINATION DONE");
        return pages;
    }
    catch (error) {
        console.log(error);
    }
};

async function flix_id(paginationArray) {
    try {
        const pages = [];
        for(i = 0; i < paginationArray.length; i++) {
            const config = await headers();
            const useragent = randomUseragent.getRandom(function (ua) {
                return ua.browserName === 'Chrome';});
            config.headers['user-agent'] = useragent;
            const pageHTML = await axios.get(paginationArray[i], config);
            const $ = cheerio.load(pageHTML.data);
            $(".flw-item").map( (i, element) => {
                const film = $(element).find(".film-poster");
                const id = $(film).find("a").attr("href");
                const link =`${domain}` + `${id}`;
                pages.push(link);
                }).get();
        }
        console.log("ALMOST DONE....");
        console.log(pages.length+" "+"ID TO PROCESS");
        return pages;
    }
    catch (error) {
        console.log(error);
    }
};

async function tmdb_id (cardsArray) {
    try {
        const cards = [];
        for(i = 0; i < cardsArray.length; i++) {
            const config = await headers();
            const useragent = randomUseragent.getRandom(function (ua) {
                return ua.browserName === 'Chrome';});
            config.headers['user-agent'] = useragent;
            const pageHTML = await axios.get(cardsArray[i], config);
            const $ = cheerio.load(pageHTML.data);
            const tmdb_id = $(".watching_player-area").attr("data-tmdb-id");
            const url_path = $("head > meta:nth-child(11)");
            const url = $(url_path).attr("content");
            const stream_id = url.substring(url.lastIndexOf('/') + 1);
            const card = { tmdb_id, stream_id };
            cards.push(card);
            // console.log(card);
        }
        console.log("SCRAPING COMPLETED");
        // console.log(cards);
        return cards;
    }
    catch (error) {
        console.log(error);
    }
};

async function insertCardsInMongoDb(tmdb) {
    try {
        const cards = [];
        const promises = (tmdb || []).map(async card => {
        const cardsFromDb = await Movie.findOne({ stream_id: card.stream_id });
        if (!cardsFromDb) {
            const newCard = new Movie(card);
            cards.push(card);
            // console.log(card);
            return newCard.save();
        }
        });
        await Promise.all(promises);
        console.log(cards.length+" "+"MOVIES ADDED TO DB");
    }
    catch (error) {
        console.log(error);
    }
};


async function main() {
    try {
        const date = new Date();
        const time = date.toUTCString();
        console.log(time);
        await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true }, function(){
            console.log("CONNECTED TO MONGODB");
          });
        const paginationArray = await pagination();
        const cardsArray = await flix_id(paginationArray);
        const tmdb = await tmdb_id(cardsArray);
        const result = await insertCardsInMongoDb(tmdb);
        mongoose.disconnect(function(){
            console.log("SUCCESSFULLY DISCONNECTED FROM MONGODB!");
        });
        return result;
    }
    catch (error) {
        console.log(error);
    }
};

main();



