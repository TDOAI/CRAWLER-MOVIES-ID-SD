require('dotenv').config();
const axios = require("axios"); 
const cheerio = require("cheerio");
const mongoose = require('mongoose');
const randomUseragent = require('random-useragent');
const Movie = require("./model/movies");
const Manual_Entry = require('./model/manual_entries');
const _headers = require ('./_headers');

const authority = process.env.AUTHORITY;
const referer = process.env.REFERER;
const domain = process.env.DOMAIN;
const url = process.env.URL;
const DB = process.env.MONGODB;

const backup = [];

async function headers() {
    const config = _headers.config_0;
    config.headers['authority'] = authority;
    config.headers['referer'] = referer;
    return config;
}

async function pagination() {
    try {
        await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true }, function(){
            console.log("CONNECTED TO MONGODB");
          });
        const config = await headers();
        const useragent = randomUseragent.getRandom(function (ua) {
            return ua.browserName === 'Chrome';});
        config.headers['user-agent'] = useragent;
        const pageHTML = await axios.get(url, config);
        const $ = cheerio.load(pageHTML.data);
        const last = $("#main-wrapper > div > section > div:nth-child(5) > nav > ul > li:nth-child(5) > a");
        const last_page = $(last).attr("href");
        const pages_count = last_page.substring(last_page.lastIndexOf('=') + 1);
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

async function cards_link(paginationArray) {
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
                pages.push(id);
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

async function VerifyIfCardsinDB(cardsArray, n) {
    try {
        const cards = [];
        const clean = (cardsArray || []).map(async card => {
            const cardsFromDb = await Movie.findOne({ stream_id: card.substring(n) });
            if (!cardsFromDb) {
                const link = `${domain}` + `${card}`;
                cards.push(link)
            }
        });
        await Promise.all(clean);
        console.log(cards.length+" "+"IDS TO ADD TO DB");
        console.log("GETTING IDS>>>>>>>>")
        return cards
    }
    catch (error) {
        console.log(error);
    }
};

async function id(verifiedCards) {
    try {
        const timer = ms => new Promise(res => setTimeout(res, ms))
        const cards = [];
        for(i = 0; i < verifiedCards.length; i++) {
            const config = await headers();
            const useragent = randomUseragent.getRandom(function (ua) {
                return ua.browserName === 'Chrome';});
            config.headers['user-agent'] = useragent;
            const pageHTML = await axios.get(verifiedCards[i], config);
            if (!pageHTML.data.includes("container-404 text-center") && !pageHTML.data.includes("Moved Permanently. Redirecting to")) {
                const $ = cheerio.load(pageHTML.data);
                const tmdb_id = $(".watching_player-area").attr("data-tmdb-id");
                const url_path = $("head > meta:nth-child(11)");
                const url = $(url_path).attr("content");
                const stream_id = url.substring(url.lastIndexOf('/') + 1);
                const card = { tmdb_id, stream_id };
                cards.push(card);
                await timer(700);
                // console.log(card);
            }
            else {
                const link = { Link: verifiedCards[i] }
                backup.push(link);
            }
        }
        console.log("SCRAPING COMPLETED");
        // console.log(cards);
        return cards;
    }
    catch (error) {
        console.log(error);
    }
};

async function insertCardsInMongoDb(ids_full) {
    try {
        const cards = [];
        const promises = (ids_full || []).map(async card => {
        const cardsFromDb = await Movie.findOne({ stream_id: card.stream_id });
        if (!cardsFromDb) {
            const newCard = new Movie(card);
            cards.push(card);
            // console.log(card);
            return newCard.save();
        }
        });
        await Promise.all(promises);
        console.log(cards.length+" "+"ID ADDED TO DB");
    }
    catch (error) {
        console.log(error);
    }
};

async function insertLinkWithError() {
    try {
        const cards = [];
        const promises = (backup || []).map(async card => {
            const link = await card.Link;
            const format = await link.substring(link.lastIndexOf('/') + 1);
            const cardsFromDbManual = await Manual_Entry.findOne({ Link: card.Link });
            const cardsFromDb = await Movie.findOne({ stream_id: format });
            if (!cardsFromDb && !cardsFromDbManual) {
                const newCard = new Manual_Entry(card);
                cards.push(card);
                // console.log(card);
                return newCard.save();
            }
        });
        await Promise.all(promises);
        console.log(cards.length+" "+"ID SAVE TO ADD MANUALLY");
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
        const paginationArray = await pagination();
        const cardsArray = await cards_link(paginationArray);
        const verifiedCards = await VerifyIfCardsinDB(cardsArray, 7);//IF MOVIE=>(CardsArray, 7) IF TV=>(CardsArray, 4)
        const ids_full = await id(verifiedCards);
        await insertCardsInMongoDb(ids_full);
        await insertLinkWithError();
        mongoose.disconnect(function(){
            console.log("SUCCESSFULLY DISCONNECTED FROM MONGODB!");
        });
    }
    catch (error) {
        console.log(error);
    }
};

main();



