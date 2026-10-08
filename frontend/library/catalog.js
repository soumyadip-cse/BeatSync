const rows = [
  ["English","Blinding Lights","The Weeknd"],["English","Shape of You","Ed Sheeran"],["English","Believer","Imagine Dragons"],["English","Rolling in the Deep","Adele"],["English","Bad Guy","Billie Eilish"],["English","Uptown Funk","Mark Ronson feat. Bruno Mars"],["English","Dance Monkey","Tones and I"],["English","Someone Like You","Adele"],
  ["Hindi","Kesariya","Arijit Singh"],["Hindi","Tum Hi Ho","Arijit Singh"],["Hindi","Channa Mereya","Arijit Singh"],["Hindi","Agar Tum Saath Ho","Alka Yagnik, Arijit Singh"],["Hindi","Tujh Mein Rab Dikhta Hai","Roop Kumar Rathod"],["Hindi","Kal Ho Naa Ho","Sonu Nigam"],["Hindi","Galliyan","Ankit Tiwari"],["Hindi","Apna Bana Le","Arijit Singh"],
  ["Punjabi","Brown Munde","AP Dhillon, Gurinder Gill, Shinda Kahlon"],["Punjabi","Excuses","AP Dhillon"],["Punjabi","Insane","AP Dhillon"],["Punjabi","Lover","Diljit Dosanjh"],["Punjabi","G.O.A.T.","Diljit Dosanjh"],["Punjabi","Born to Shine","Diljit Dosanjh"],["Punjabi","295","Sidhu Moose Wala"],["Punjabi","So High","Sidhu Moose Wala"],
  ["Bhojpuri","Lollipop Lagelu","Pawan Singh"],["Bhojpuri","Raate Diya Butake","Pawan Singh, Indu Sonali"],["Bhojpuri","Chhalakata Hamro Jawaniya","Pawan Singh, Priyanka Singh"],["Bhojpuri","Palang Sagwan Ke","Khesari Lal Yadav, Indu Sonali"],["Bhojpuri","Piyawa Se Pahile","Pawan Singh"],["Bhojpuri","Jab Lagawelu Lipistic","Pawan Singh, Kalpana"],["Bhojpuri","Saj Ke Sawar Ke","Khesari Lal Yadav"],["Bhojpuri","Nathuniya","Khesari Lal Yadav"],
  ["Bengali","Amake Amar Moto Thakte Dao","Anupam Roy"],["Bengali","Tomake Chai","Arijit Singh"],["Bengali","Bhalobashar Morshum","Arijit Singh, Shreya Ghoshal"],["Bengali","Bojhena Shey Bojhena","Arijit Singh"],["Bengali","Tumi Jake Bhalobasho","Iman Chakraborty"],["Bengali","Ekhon Onek Raat","Anupam Roy"],["Bengali","Amar Bhindeshi Tara","Chandrabindoo"],["Bengali","Ekla Cholo Re","Rabindranath Tagore"],
];

export const TEST_CATALOG = Object.freeze(rows.map(([language, title, artist], index) => Object.freeze({
  id: "bs-" + String(index + 1).padStart(2, "0"),
  language,
  title,
  artist,
  album: "",
  durationSeconds: null,
  musicBrainzRecordingId: null,
  mediaBundled: false,
})));

