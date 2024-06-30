/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as cheerio from "cheerio";
import {parse} from "date-fns";
import {it} from "date-fns/locale";

admin.initializeApp();

const db = admin.firestore();

interface Event {
  name: string;
  date: Date;
  location: string;
}

export const scrapeEvents = functions
  .region("europe-west1")
  .pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const url = "https://www.sansirostadium.com/live/I-grandi-concerti-di-San-Siro";
    const formatString = "d MMMM yyyy";

    try {
      const {data} = await axios.get(url);
      const $ = cheerio.load(data);

      const events: Event[] = [];

      $(".container")
        .find(".row.row0.row-eq-height")
        .each((i: any, element: any) => {
          const name = $(element)
            .find(".boxNota")
            .find(".titolo.alignTextCenter div")
            .text().trim();
          console.log(name);

          const stringedDate = $(element)
            .find(".boxNota")
            .find(".titolo span.uppercase")
            .text().trim();
          console.log(stringedDate);
          const dateWithoutDay = stringedDate.replace(/^[a-zA-ZàèìòùÀÈÌÒÙ]+\s/, "");
          console.log(dateWithoutDay);
          const date = parse(dateWithoutDay, formatString, new Date(),
            {locale: it});
          console.log(date);
          const timestamp = date.getTime();
          console.log(timestamp);

          const location = "Stadio San Siro";

          if (name && date) {
            events.push({
              name,
              date,
              location,
            });
          }
        });

      // Salva gli eventi in Firestore
      const batch = db.batch();
      events.forEach((event) => {
        const docRef = db.collection("events").doc();
        batch.set(docRef, event);
      });
      await batch.commit();

      console.log(`Scraped and saved ${events.length} events.`);
      return null;
    } catch (error) {
      console.error("Error scraping San Siro events:", error);
      throw new functions.https.HttpsError("internal", "Error scraping events");
    }
  });
